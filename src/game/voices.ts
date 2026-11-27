import { gameAudio } from './audio';
import { HERO_MAP } from './heroes';
import type { HeroId } from './types';
import {
  pickVoiceLine,
  SPEAKER_VOICE_PROFILES,
  type AnnouncerVoiceTrigger,
  type ChampionVoiceTrigger,
  type VoiceSpeakerId,
  type VoiceTrigger,
} from './voiceLines';

export interface ActiveVoiceSubtitle {
  id: number;
  speakerId: VoiceSpeakerId;
  speakerName: string;
  speakerTitle: string;
  text: string;
  portrait: string | null;
  accentColor: string;
  isAnnouncer: boolean;
  loading: boolean;
}

type SubtitleListener = (sub: ActiveVoiceSubtitle | null) => void;
type ErrorListener = (err: string | null) => void;

const TRIGGER_COOLDOWN_MS: Record<VoiceTrigger, number> = {
  select: 400,
  spawn: 6000,
  skill1: 11000,
  skill2: 11000,
  kill: 4200,
  upgrade: 8500,
  recall: 8000,
  victory: 2000,
  defeat: 2000,
  match_start: 5000,
  first_blood: 5000,
  tower_down: 4500,
  core_exposed: 8000,
};

const TRIGGER_PRIORITY: Record<VoiceTrigger, number> = {
  select: 2,
  spawn: 1,
  skill1: 0,
  skill2: 0,
  kill: 1,
  upgrade: 0,
  recall: 0,
  victory: 3,
  defeat: 3,
  match_start: 3,
  first_blood: 3,
  tower_down: 3,
  core_exposed: 3,
};

class VoiceManager {
  private wavCache = new Map<string, ArrayBuffer>();
  private inflightFetch = new Map<string, Promise<ArrayBuffer>>();
  private lastLineByKey = new Map<string, string>();
  private lastTriggerAt = new Map<string, number>();

  private activePriority = -1;
  private activeToken = 0;
  private hideTimer: number | null = null;
  private currentSubtitle: ActiveVoiceSubtitle | null = null;
  private lastError: string | null = null;

  private subtitleListeners = new Set<SubtitleListener>();
  private errorListeners = new Set<ErrorListener>();

  public subscribeSubtitle(listener: SubtitleListener): () => void {
    this.subtitleListeners.add(listener);
    listener(this.currentSubtitle);
    return () => {
      this.subtitleListeners.delete(listener);
    };
  }

  public subscribeError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    listener(this.lastError);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  private emitSubtitle(sub: ActiveVoiceSubtitle | null): void {
    this.currentSubtitle = sub;
    for (const cb of this.subtitleListeners) {
      cb(sub);
    }
  }

  private emitError(msg: string | null): void {
    this.lastError = msg;
    for (const cb of this.errorListeners) {
      cb(msg);
    }
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  public stop(): void {
    this.activeToken += 1;
    this.activePriority = -1;
    this.clearHideTimer();
    gameAudio.stopCurrentVoice();
    this.emitSubtitle(null);
  }

  private async fetchLineWav(speakerId: VoiceSpeakerId, lineId: string): Promise<ArrayBuffer> {
    const key = `${speakerId}__${lineId}`;
    const cached = this.wavCache.get(key);
    if (cached) return cached;

    const pending = this.inflightFetch.get(key);
    if (pending) return pending;

    const req = (async () => {
      const res = await fetch('/api/voice/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerId, lineId }),
      });

      if (!res.ok) {
        let errText = `Voice service unavailable (${res.status})`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) errText = data.error;
        } catch {
          // Ignore non-JSON error body
        }
        throw new Error(errText);
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength < 44) {
        throw new Error('Voice service returned an empty audio clip.');
      }
      this.wavCache.set(key, buf);
      this.emitError(null);
      return buf;
    })();

    this.inflightFetch.set(key, req);
    try {
      return await req;
    } finally {
      this.inflightFetch.delete(key);
    }
  }

  /** Background-prefetch key combat lines for the active champion so mid-fight lines fire instantly. */
  public prefetchHeroVoices(heroId: HeroId): void {
    if (gameAudio.isMuted() || gameAudio.isVoicesMuted()) return;
    const profile = SPEAKER_VOICE_PROFILES[heroId];
    if (!profile) return;

    const priorityTriggers: ChampionVoiceTrigger[] = ['spawn', 'skill1', 'skill2', 'kill'];
    const queue: Array<{ speakerId: VoiceSpeakerId; lineId: string }> = [];
    for (const trig of priorityTriggers) {
      const line = profile.lines.find((l) => l.trigger === trig);
      if (line && !this.wavCache.has(`${heroId}__${line.id}`)) {
        queue.push({ speakerId: heroId, lineId: line.id });
      }
    }

    // Also warm up the announcer match_start & first_blood lines gently
    const annProfile = SPEAKER_VOICE_PROFILES.announcer;
    for (const trig of ['match_start', 'first_blood', 'tower_down'] as AnnouncerVoiceTrigger[]) {
      const line = annProfile.lines.find((l) => l.trigger === trig);
      if (line && !this.wavCache.has(`announcer__${line.id}`)) {
        queue.push({ speakerId: 'announcer', lineId: line.id });
      }
    }

    // Stagger prefetches sequentially to keep network & API polite
    void (async () => {
      for (const item of queue) {
        if (gameAudio.isMuted() || gameAudio.isVoicesMuted()) break;
        try {
          await this.fetchLineWav(item.speakerId, item.lineId);
        } catch {
          // Stop prefetching on error (e.g. missing key)
          break;
        }
      }
    })();
  }

  public playChampionLine(
    heroId: HeroId,
    trigger: ChampionVoiceTrigger,
    opts?: { force?: boolean; chance?: number }
  ): void {
    void this.playLine(heroId, trigger, opts);
  }

  public playAnnouncerLine(
    trigger: AnnouncerVoiceTrigger,
    opts?: { force?: boolean }
  ): void {
    void this.playLine('announcer', trigger, opts);
  }

  private async playLine(
    speakerId: VoiceSpeakerId,
    trigger: VoiceTrigger,
    opts?: { force?: boolean; chance?: number }
  ): Promise<void> {
    if (gameAudio.isMuted() || gameAudio.isVoicesMuted()) return;

    if (opts?.chance !== undefined && Math.random() > opts.chance) return;

    const priority = TRIGGER_PRIORITY[trigger];
    const now = performance.now();
    const cdKey = `${speakerId}:${trigger}`;
    const lastAt = this.lastTriggerAt.get(cdKey) ?? 0;
    const minCd = TRIGGER_COOLDOWN_MS[trigger] ?? 4000;

    if (!opts?.force && now - lastAt < minCd) return;
    if (!opts?.force && this.activePriority > priority) return;
    // Don't interrupt same-priority in-flight speech unless forced (e.g. clicking new champion)
    if (!opts?.force && this.activePriority === priority && priority < 2) return;

    const profile = SPEAKER_VOICE_PROFILES[speakerId];
    if (!profile) return;

    const lastId = this.lastLineByKey.get(cdKey) ?? null;
    const line = pickVoiceLine(speakerId, trigger, lastId);
    if (!line) return;

    this.lastTriggerAt.set(cdKey, now);
    this.lastLineByKey.set(cdKey, line.id);

    const token = ++this.activeToken;
    this.activePriority = priority;
    this.clearHideTimer();

    const isAnnouncer = speakerId === 'announcer';
    const portrait = !isAnnouncer ? HERO_MAP[speakerId as HeroId]?.portrait ?? null : null;
    const isCached = this.wavCache.has(`${speakerId}__${line.id}`);

    const subtitle: ActiveVoiceSubtitle = {
      id: token,
      speakerId,
      speakerName: profile.displayName,
      speakerTitle: profile.title,
      text: line.text,
      portrait,
      accentColor: profile.accentColor,
      isAnnouncer,
      loading: !isCached,
    };

    // Show subtitle right away if cached or for select/announcer lines
    if (isCached || priority >= 2) {
      this.emitSubtitle(subtitle);
    }

    try {
      const wavBuffer = await this.fetchLineWav(speakerId, line.id);
      if (token !== this.activeToken || gameAudio.isMuted() || gameAudio.isVoicesMuted()) {
        return;
      }

      this.emitSubtitle({ ...subtitle, loading: false });
      await gameAudio.playVoiceWavBuffer(wavBuffer, { isAnnouncer });

      if (token === this.activeToken) {
        this.activePriority = -1;
        this.hideTimer = window.setTimeout(() => {
          if (token === this.activeToken) {
            this.emitSubtitle(null);
          }
        }, 700);
      }
    } catch (err) {
      if (token === this.activeToken) {
        this.activePriority = -1;
        this.emitSubtitle(null);
        const msg = err instanceof Error ? err.message : 'Unable to play voice line.';
        this.emitError(msg);
      }
    }
  }
}

export const gameVoices = new VoiceManager();
