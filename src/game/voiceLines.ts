import type { HeroId } from './types.ts';

export type VoiceSpeakerId = HeroId | 'announcer';

export type PrebuiltVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export type ChampionVoiceTrigger =
  | 'select'
  | 'spawn'
  | 'skill1'
  | 'skill2'
  | 'kill'
  | 'upgrade'
  | 'recall'
  | 'victory'
  | 'defeat';

export type AnnouncerVoiceTrigger =
  | 'match_start'
  | 'first_blood'
  | 'tower_down'
  | 'core_exposed'
  | 'victory'
  | 'defeat';

export type VoiceTrigger = ChampionVoiceTrigger | AnnouncerVoiceTrigger;

export interface VoiceLineEntry {
  id: string;
  trigger: VoiceTrigger;
  text: string;
}

export interface SpeakerVoiceProfile {
  speakerId: VoiceSpeakerId;
  displayName: string;
  title: string;
  accentColor: string;
  voiceName: PrebuiltVoiceName;
  style: string;
  lines: VoiceLineEntry[];
}

export const SPEAKER_VOICE_PROFILES: Record<VoiceSpeakerId, SpeakerVoiceProfile> = {
  announcer: {
    speakerId: 'announcer',
    displayName: 'Cathedral Herald',
    title: 'ARBITER OF THE SHATTERED SUN',
    accentColor: '#FBBF24',
    voiceName: 'Charon',
    style:
      'Monumental, thunderous Gothic-cathedral battle announcer with solemn gravitas, resonant echoic authority, and dramatic pacing',
    lines: [
      {
        id: 'ann_match_start_1',
        trigger: 'match_start',
        text: 'The bells of the Shattered Sun toll! Champions, descend and claim the Reliquary!',
      },
      {
        id: 'ann_first_blood_1',
        trigger: 'first_blood',
        text: 'First blood consecrates the Nave!',
      },
      {
        id: 'ann_tower_down_1',
        trigger: 'tower_down',
        text: 'A Reliquary Tower has fallen to ruin!',
      },
      {
        id: 'ann_tower_down_2',
        trigger: 'tower_down',
        text: 'Stone and steel shatter! A bastion crumbles!',
      },
      {
        id: 'ann_core_exposed_1',
        trigger: 'core_exposed',
        text: 'The Ancient Core stands exposed! Strike the heart of the Cathedral!',
      },
      {
        id: 'ann_victory_1',
        trigger: 'victory',
        text: 'Victory! The Ancient Core is shattered, and the Cathedral sings your name!',
      },
      {
        id: 'ann_defeat_1',
        trigger: 'defeat',
        text: 'Defeat. Your Reliquary has fallen silent into ash.',
      },
    ],
  },

  marrow: {
    speakerId: 'marrow',
    displayName: 'Marrow-Hook',
    title: 'THE ABYSSAL BUTCHER',
    accentColor: '#10B981',
    voiceName: 'Fenrir',
    style:
      'Gruff, guttural, menacing plague-butcher growl with heavy breathing weight and grim dark amusement',
    lines: [
      {
        id: 'marrow_select_1',
        trigger: 'select',
        text: 'Chain oiled. Cleaver hungry. Drag me to the slaughter.',
      },
      {
        id: 'marrow_select_2',
        trigger: 'select',
        text: 'Run all you like. My winch reaches farther than your prayers.',
      },
      {
        id: 'marrow_spawn_1',
        trigger: 'spawn',
        text: 'Fresh meat on the Cathedral floor!',
      },
      {
        id: 'marrow_skill1_1',
        trigger: 'skill1',
        text: 'Get over here!',
      },
      {
        id: 'marrow_skill1_2',
        trigger: 'skill1',
        text: 'Hooked tight!',
      },
      {
        id: 'marrow_skill2_1',
        trigger: 'skill2',
        text: 'Breathe the furnace!',
      },
      {
        id: 'marrow_kill_1',
        trigger: 'kill',
        text: 'Carved clean to the marrow.',
      },
      {
        id: 'marrow_kill_2',
        trigger: 'kill',
        text: 'Another carcass for the heap!',
      },
      {
        id: 'marrow_upgrade_1',
        trigger: 'upgrade',
        text: 'Heavier iron. Deeper cuts.',
      },
      {
        id: 'marrow_recall_1',
        trigger: 'recall',
        text: 'Back to the altar to whet the blade.',
      },
      {
        id: 'marrow_victory_1',
        trigger: 'victory',
        text: 'Nothing left standing. Just how the butcher likes it.',
      },
      {
        id: 'marrow_defeat_1',
        trigger: 'defeat',
        text: 'Rust and rot... the chain snapped too soon.',
      },
    ],
  },

  seraph: {
    speakerId: 'seraph',
    displayName: 'Seraph-9',
    title: 'CYBER-SERAPH',
    accentColor: '#F59E0B',
    voiceName: 'Kore',
    style:
      'Luminous, commanding angelic warrior with clear ceremonial cadence, serene conviction, and radiant authority',
    lines: [
      {
        id: 'seraph_select_1',
        trigger: 'select',
        text: 'Wings calibrated. Halo ignited. Judgment descends from above.',
      },
      {
        id: 'seraph_select_2',
        trigger: 'select',
        text: 'By sacred light and hard-light steel, the Nave shall hold.',
      },
      {
        id: 'seraph_spawn_1',
        trigger: 'spawn',
        text: 'Behold the dawn of the Ninth Choir!',
      },
      {
        id: 'seraph_skill1_1',
        trigger: 'skill1',
        text: 'Spear of Judgment!',
      },
      {
        id: 'seraph_skill1_2',
        trigger: 'skill1',
        text: 'Be pierced by the light!',
      },
      {
        id: 'seraph_skill2_1',
        trigger: 'skill2',
        text: 'Aegis upon the faithful!',
      },
      {
        id: 'seraph_kill_1',
        trigger: 'kill',
        text: 'Absolution delivered.',
      },
      {
        id: 'seraph_kill_2',
        trigger: 'kill',
        text: 'Your shadow fades before the sun.',
      },
      {
        id: 'seraph_upgrade_1',
        trigger: 'upgrade',
        text: 'My radiance intensifies.',
      },
      {
        id: 'seraph_recall_1',
        trigger: 'recall',
        text: 'Ascending to the Sanctuary Altar.',
      },
      {
        id: 'seraph_victory_1',
        trigger: 'victory',
        text: 'The Cathedral is consecrated in golden fire!',
      },
      {
        id: 'seraph_defeat_1',
        trigger: 'defeat',
        text: 'Even fallen angels rise again at first light.',
      },
    ],
  },

  korak: {
    speakerId: 'korak',
    displayName: 'Korak',
    title: 'PURE WITCH DOCTOR',
    accentColor: '#34D399',
    voiceName: 'Puck',
    style:
      'Mischievous, eerie swamp witch-doctor with playful rhythmic cadence, mystical glee, and dry chuckling energy',
    lines: [
      {
        id: 'korak_select_1',
        trigger: 'select',
        text: 'Heheh! No alien metal for Korak—just old bone and older spirits!',
      },
      {
        id: 'korak_select_2',
        trigger: 'select',
        text: 'The swamp remembers every soul. Let us wake the ancestors!',
      },
      {
        id: 'korak_spawn_1',
        trigger: 'spawn',
        text: 'Shake the rattles! The spirits are hungry tonight!',
      },
      {
        id: 'korak_skill1_1',
        trigger: 'skill1',
        text: 'Rise, spirit totem!',
      },
      {
        id: 'korak_skill2_1',
        trigger: 'skill2',
        text: 'Fly, little skulls! Go bite!',
      },
      {
        id: 'korak_kill_1',
        trigger: 'kill',
        text: 'Ooh, another bright spirit for my jar!',
      },
      {
        id: 'korak_kill_2',
        trigger: 'kill',
        text: 'The hex always collects its due!',
      },
      {
        id: 'korak_upgrade_1',
        trigger: 'upgrade',
        text: 'Stronger juju! Better brew!',
      },
      {
        id: 'korak_recall_1',
        trigger: 'recall',
        text: 'Slipping back through the mist...',
      },
      {
        id: 'korak_victory_1',
        trigger: 'victory',
        text: 'Haha! Ancient magic beats shiny machines every single time!',
      },
      {
        id: 'korak_defeat_1',
        trigger: 'defeat',
        text: 'Hmph. The bones warned me, and I did not listen.',
      },
    ],
  },

  vorg: {
    speakerId: 'vorg',
    displayName: 'Vorg',
    title: 'PURE WARLOCK',
    accentColor: '#A855F7',
    voiceName: 'Charon',
    style:
      'Brooding, velvet-dark occult warlock with ominous calm, menacing whisper-intensity, and arcane disdain',
    lines: [
      {
        id: 'vorg_select_1',
        trigger: 'select',
        text: 'Neither prayer nor machine can save them from the Abyss.',
      },
      {
        id: 'vorg_select_2',
        trigger: 'select',
        text: 'The pact is sealed in shadow. Lead me to their souls.',
      },
      {
        id: 'vorg_spawn_1',
        trigger: 'spawn',
        text: 'Darkness spills across the Nave.',
      },
      {
        id: 'vorg_skill1_1',
        trigger: 'skill1',
        text: 'Through the rift!',
      },
      {
        id: 'vorg_skill2_1',
        trigger: 'skill2',
        text: 'Drown in the maelstrom!',
      },
      {
        id: 'vorg_kill_1',
        trigger: 'kill',
        text: 'Your essence feeds the pact.',
      },
      {
        id: 'vorg_kill_2',
        trigger: 'kill',
        text: 'Consumed by the void.',
      },
      {
        id: 'vorg_upgrade_1',
        trigger: 'upgrade',
        text: 'Deeper forbidden power.',
      },
      {
        id: 'vorg_recall_1',
        trigger: 'recall',
        text: 'Returning to the dark sanctum.',
      },
      {
        id: 'vorg_victory_1',
        trigger: 'victory',
        text: 'The Cathedral bows before the old dark.',
      },
      {
        id: 'vorg_defeat_1',
        trigger: 'defeat',
        text: 'A temporary eclipse. The void waits patiently.',
      },
    ],
  },

  bastion: {
    speakerId: 'bastion',
    displayName: 'Brother Bastion',
    title: 'PURE TEMPLAR',
    accentColor: '#F59E0B',
    voiceName: 'Fenrir',
    style:
      'Booming, heroic, steadfast cathedral knight-paladin with warm noble resonance and unshakable iron resolve',
    lines: [
      {
        id: 'bastion_select_1',
        trigger: 'select',
        text: 'Stand behind my shield! Not one stone of this Cathedral yields today!',
      },
      {
        id: 'bastion_select_2',
        trigger: 'select',
        text: 'Mortar primed. Oath unbroken. Brother Bastion marches!',
      },
      {
        id: 'bastion_spawn_1',
        trigger: 'spawn',
        text: 'For the Sanctum! Forward into the breach!',
      },
      {
        id: 'bastion_skill1_1',
        trigger: 'skill1',
        text: 'Hammer of the Faith!',
      },
      {
        id: 'bastion_skill2_1',
        trigger: 'skill2',
        text: 'Unbreakable Bastion!',
      },
      {
        id: 'bastion_kill_1',
        trigger: 'kill',
        text: 'Struck down by righteous steel!',
      },
      {
        id: 'bastion_kill_2',
        trigger: 'kill',
        text: 'None shall break our line!',
      },
      {
        id: 'bastion_upgrade_1',
        trigger: 'upgrade',
        text: 'Tempered in the Relic Forge!',
      },
      {
        id: 'bastion_recall_1',
        trigger: 'recall',
        text: 'Holding position... returning to the Altar.',
      },
      {
        id: 'bastion_victory_1',
        trigger: 'victory',
        text: 'Glory to the Order! The bells ring victorious!',
      },
      {
        id: 'bastion_defeat_1',
        trigger: 'defeat',
        text: 'My armor cracks... forgive me, brothers.',
      },
    ],
  },

  vexia: {
    speakerId: 'vexia',
    displayName: 'Sister Vexia',
    title: 'XENO-INQUISITOR',
    accentColor: '#38BDF8',
    voiceName: 'Kore',
    style:
      'Sharp, ruthless, coldly focused witch-hunter inquisitor with crisp tactical intensity and zero mercy',
    lines: [
      {
        id: 'vexia_select_1',
        trigger: 'select',
        text: 'Heresy spotted. Rail-crossbow locked. Grant me clearance.',
      },
      {
        id: 'vexia_select_2',
        trigger: 'select',
        text: 'I turn alien steel against its own masters. Let the hunt begin.',
      },
      {
        id: 'vexia_spawn_1',
        trigger: 'spawn',
        text: 'Targets acquired. Begin the purge.',
      },
      {
        id: 'vexia_skill1_1',
        trigger: 'skill1',
        text: 'Fire in the hole!',
      },
      {
        id: 'vexia_skill2_1',
        trigger: 'skill2',
        text: 'Unleash the siege ram!',
      },
      {
        id: 'vexia_kill_1',
        trigger: 'kill',
        text: 'Sentence executed.',
      },
      {
        id: 'vexia_kill_2',
        trigger: 'kill',
        text: 'Clean shot. Next heretic.',
      },
      {
        id: 'vexia_upgrade_1',
        trigger: 'upgrade',
        text: 'Higher caliber. Faster verdict.',
      },
      {
        id: 'vexia_recall_1',
        trigger: 'recall',
        text: 'Repositioning to base.',
      },
      {
        id: 'vexia_victory_1',
        trigger: 'victory',
        text: 'The Inquisition leaves no threat breathing.',
      },
      {
        id: 'vexia_defeat_1',
        trigger: 'defeat',
        text: 'Tactical failure. Mark them for the next crusade.',
      },
    ],
  },

  xylar: {
    speakerId: 'xylar',
    displayName: 'Xylar',
    title: 'PURE XENO-TECH',
    accentColor: '#818CF8',
    voiceName: 'Zephyr',
    style:
      'Sleek, detached, hyper-calm extraterrestrial stealth assassin with crisp clinical precision and subtle alien poise',
    lines: [
      {
        id: 'xylar_select_1',
        trigger: 'select',
        text: 'Phase cloak nominal. Gravity core armed. Primitives will not see me coming.',
      },
      {
        id: 'xylar_select_2',
        trigger: 'select',
        text: 'Silent entry. Singular lethality. Initiating infiltration.',
      },
      {
        id: 'xylar_spawn_1',
        trigger: 'spawn',
        text: 'Touchdown confirmed. Entering shadow vector.',
      },
      {
        id: 'xylar_skill1_1',
        trigger: 'skill1',
        text: 'Singularity deployed.',
      },
      {
        id: 'xylar_skill2_1',
        trigger: 'skill2',
        text: 'Vanishing from spectrum.',
      },
      {
        id: 'xylar_kill_1',
        trigger: 'kill',
        text: 'Target erased.',
      },
      {
        id: 'xylar_kill_2',
        trigger: 'kill',
        text: 'Inefficient defense. Terminated.',
      },
      {
        id: 'xylar_upgrade_1',
        trigger: 'upgrade',
        text: 'Systems overclocked.',
      },
      {
        id: 'xylar_recall_1',
        trigger: 'recall',
        text: 'Extracting to orbital beacon.',
      },
      {
        id: 'xylar_victory_1',
        trigger: 'victory',
        text: 'Mission complete. Superior technology prevails.',
      },
      {
        id: 'xylar_defeat_1',
        trigger: 'defeat',
        text: 'Anomaly detected. Recalculating invasion protocol.',
      },
    ],
  },

  caldris: {
    speakerId: 'caldris',
    displayName: 'Arch-Lich Caldris',
    title: 'CYBER-NECROMANCER',
    accentColor: '#2DD4BF',
    voiceName: 'Charon',
    style:
      'Imperious, ancient, aristocratic undead cyber-necromancer with icy theatrical grandeur and commanding malice',
    lines: [
      {
        id: 'caldris_select_1',
        trigger: 'select',
        text: 'Death is merely an outdated operating system. Let us upgrade them.',
      },
      {
        id: 'caldris_select_2',
        trigger: 'select',
        text: 'Orbital spires aligned. My bone-borg legion awaits command.',
      },
      {
        id: 'caldris_spawn_1',
        trigger: 'spawn',
        text: 'Kneel before the Undying Architect!',
      },
      {
        id: 'caldris_skill1_1',
        trigger: 'skill1',
        text: 'Orbital Spire, obliterate!',
      },
      {
        id: 'caldris_skill2_1',
        trigger: 'skill2',
        text: 'Arise, my servitors!',
      },
      {
        id: 'caldris_kill_1',
        trigger: 'kill',
        text: 'Your soul joins the archive.',
      },
      {
        id: 'caldris_kill_2',
        trigger: 'kill',
        text: 'How fragile mortal flesh remains.',
      },
      {
        id: 'caldris_upgrade_1',
        trigger: 'upgrade',
        text: 'Perfection approaches eternity.',
      },
      {
        id: 'caldris_recall_1',
        trigger: 'recall',
        text: 'Withdrawing to the phylactery.',
      },
      {
        id: 'caldris_victory_1',
        trigger: 'victory',
        text: 'At last, the silence of eternal dominion.',
      },
      {
        id: 'caldris_defeat_1',
        trigger: 'defeat',
        text: 'Impossible! My phylactery cannot fail!',
      },
    ],
  },

  vespra: {
    speakerId: 'vespra',
    displayName: 'Plague-Cantor Vespra',
    title: 'BLIGHT ALCHEMIST',
    accentColor: '#84CC16',
    voiceName: 'Zephyr',
    style:
      'Cultured, eerie, feverishly scholarly Gothic plague-doctor apothecary with lyrical poise and unsettling fascination',
    lines: [
      {
        id: 'vespra_select_1',
        trigger: 'select',
        text: 'Ah, a fresh ward of patients. Shall we begin the distillation?',
      },
      {
        id: 'vespra_select_2',
        trigger: 'select',
        text: 'One drop humbles a knight. Five drops dissolve an empire.',
      },
      {
        id: 'vespra_spawn_1',
        trigger: 'spawn',
        text: 'Breathe deeply. My finest vintage fills the air.',
      },
      {
        id: 'vespra_skill1_1',
        trigger: 'skill1',
        text: 'Let the miasma bloom!',
      },
      {
        id: 'vespra_skill2_1',
        trigger: 'skill2',
        text: 'Contagion, rupture now!',
      },
      {
        id: 'vespra_kill_1',
        trigger: 'kill',
        text: 'Terminal prognosis confirmed.',
      },
      {
        id: 'vespra_kill_2',
        trigger: 'kill',
        text: 'Exquisite reaction. Truly lethal.',
      },
      {
        id: 'vespra_upgrade_1',
        trigger: 'upgrade',
        text: 'A far more virulent formula.',
      },
      {
        id: 'vespra_recall_1',
        trigger: 'recall',
        text: 'Returning to the apothecary.',
      },
      {
        id: 'vespra_victory_1',
        trigger: 'victory',
        text: 'The Cathedral is cured—by absolute eradication.',
      },
      {
        id: 'vespra_defeat_1',
        trigger: 'defeat',
        text: 'Curious... they developed a resistance.',
      },
    ],
  },

  vale: {
    speakerId: 'vale',
    displayName: 'Solarion Vale',
    title: 'CHRONO-DUELIST',
    accentColor: '#F59E0B',
    voiceName: 'Puck',
    style:
      'Charismatic, witty, razor-confident gilded chronomancer duelist with brisk heroic swagger and stylish charm',
    lines: [
      {
        id: 'vale_select_1',
        trigger: 'select',
        text: 'Right on schedule. Let us bend a few seconds and break a few crowns!',
      },
      {
        id: 'vale_select_2',
        trigger: 'select',
        text: 'They fight in the present. I already won three seconds ago.',
      },
      {
        id: 'vale_spawn_1',
        trigger: 'spawn',
        text: 'Clock is ticking, champions—try to keep up!',
      },
      {
        id: 'vale_skill1_1',
        trigger: 'skill1',
        text: 'Sundial Flare—burn bright!',
      },
      {
        id: 'vale_skill2_1',
        trigger: 'skill2',
        text: 'Blink and you missed me!',
      },
      {
        id: 'vale_kill_1',
        trigger: 'kill',
        text: 'Out of time, friend.',
      },
      {
        id: 'vale_kill_2',
        trigger: 'kill',
        text: 'Flawless timing, as usual.',
      },
      {
        id: 'vale_upgrade_1',
        trigger: 'upgrade',
        text: 'Now we are ahead of the curve!',
      },
      {
        id: 'vale_recall_1',
        trigger: 'recall',
        text: 'Rewinding back to base.',
      },
      {
        id: 'vale_victory_1',
        trigger: 'victory',
        text: 'Another timeless masterpiece! Who is next?',
      },
      {
        id: 'vale_defeat_1',
        trigger: 'defeat',
        text: 'Give me a second—I can rewind this, right?',
      },
    ],
  },
};

export function findVoiceLine(
  speakerId: string,
  lineId: string
): { profile: SpeakerVoiceProfile; line: VoiceLineEntry } | null {
  const profile = SPEAKER_VOICE_PROFILES[speakerId as VoiceSpeakerId];
  if (!profile) return null;
  const line = profile.lines.find((l) => l.id === lineId);
  if (!line) return null;
  return { profile, line };
}

export function pickVoiceLine(
  speakerId: VoiceSpeakerId,
  trigger: VoiceTrigger,
  lastLineId?: string | null
): VoiceLineEntry | null {
  const profile = SPEAKER_VOICE_PROFILES[speakerId];
  if (!profile) return null;
  const matches = profile.lines.filter((l) => l.trigger === trigger);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const filtered = lastLineId ? matches.filter((m) => m.id !== lastLineId) : matches;
  const pool = filtered.length > 0 ? filtered : matches;
  return pool[Math.floor(Math.random() * pool.length)];
}
