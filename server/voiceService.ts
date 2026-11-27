import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { findVoiceLine } from '../src/game/voiceLines.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VOICE_CACHE_DIR = path.resolve(__dirname, '..', '.cache', 'voices');
const TTS_MODEL = 'gemini-3.8-flash-lite-tts';

const memoryCache = new Map<string, Buffer>();
const inflightRequests = new Map<string, Promise<Buffer>>();

let cachedClient: GoogleGenAI | null = null;
let cachedKey = '';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured on the server.');
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedKey = apiKey;
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export function isVoiceSynthesisConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * Safety helper: unary gemini-3.8-flash-lite-tts returns a complete 24kHz mono 16-bit WAV file.
 * Only wrap with a RIFF header if an upstream response ever arrives as raw L16 PCM without RIFF.
 */
function ensureWavBuffer(raw: Buffer): Buffer {
  if (raw.length >= 4 && raw.subarray(0, 4).toString('ascii') === 'RIFF') {
    return raw;
  }
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + raw.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(raw.length, 40);
  return Buffer.concat([header, raw]);
}

function cacheFilePath(cacheKey: string): string {
  const safeName = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(VOICE_CACHE_DIR, `${safeName}.wav`);
}

export async function synthesizeVoiceLine(speakerId: string, lineId: string): Promise<Buffer> {
  const match = findVoiceLine(speakerId, lineId);
  if (!match) {
    const err = new Error(`Unknown voice line: ${speakerId}/${lineId}`);
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const cacheKey = `${match.profile.speakerId}__${match.line.id}`;

  // 1. Hot in-memory cache (~0.2ms)
  const memHit = memoryCache.get(cacheKey);
  if (memHit) return memHit;

  // 2. Persistent disk cache (~2ms across server restarts)
  const filePath = cacheFilePath(cacheKey);
  try {
    const diskHit = await fs.readFile(filePath);
    if (diskHit.length > 44) {
      memoryCache.set(cacheKey, diskHit);
      return diskHit;
    }
  } catch {
    // Cache miss; proceed to Gemini TTS
  }

  // 3. Deduplicate concurrent requests for the exact same voice line
  const existing = inflightRequests.get(cacheKey);
  if (existing) return existing;

  const job = (async () => {
    const ai = getGeminiClient();

    // gemini-3.8-flash-lite-tts supports speechMetadata.style per part and returns a full 24kHz WAV
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: match.line.text,
            speechMetadata: {
              style: match.profile.style,
            },
          },
        ],
      },
    ] as unknown as Parameters<typeof ai.models.generateContent>[0]['contents'];

    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: match.profile.voiceName,
            },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((p) => p.inlineData?.data);
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
      const err = new Error(`Voice synthesis returned no audio payload for ${cacheKey}.`);
      (err as Error & { statusCode?: number }).statusCode = 502;
      throw err;
    }

    const wavBuffer = ensureWavBuffer(Buffer.from(base64Audio, 'base64'));
    memoryCache.set(cacheKey, wavBuffer);

    try {
      await fs.mkdir(VOICE_CACHE_DIR, { recursive: true });
      await fs.writeFile(filePath, wavBuffer);
    } catch (diskErr) {
      console.warn(`[VoiceService] Failed to persist disk cache for ${cacheKey}:`, diskErr);
    }

    return wavBuffer;
  })();

  inflightRequests.set(cacheKey, job);
  try {
    return await job;
  } finally {
    inflightRequests.delete(cacheKey);
  }
}
