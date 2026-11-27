import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { isVoiceSynthesisConfigured, synthesizeVoiceLine } from './server/voiceService.ts';
import type {
  ClientToServerMessage,
  RoomSummary,
  ServerToClientMessage,
} from './src/game/netTypes.ts';
import { ArenaSimulation } from './src/game/sim.ts';
import type { Difficulty, HeroId, Team } from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD =
  process.env.NODE_ENV === 'production' ||
  process.env.npm_lifecycle_event === 'start';

interface ConnectedClient {
  ws: WebSocket;
  roomId: string;
  heroEntityId: string;
  heroId: HeroId;
  playerName: string;
  team: Team;
}

interface GameRoom {
  roomId: string;
  sim: ArenaSimulation;
  clients: Map<WebSocket, ConnectedClient>;
  lastTickAt: number;
  tickAccumulator: number;
  broadcastCounter: number;
  idleSince: number | null;
}

const rooms = new Map<string, GameRoom>();
const VALID_HEROES = new Set<HeroId>([
  'marrow',
  'seraph',
  'korak',
  'vorg',
  'bastion',
  'vexia',
  'xylar',
  'caldris',
  'vespra',
  'vale',
]);
const VALID_DIFFS = new Set<Difficulty>(['casual', 'standard', 'veteran']);

function sanitizeRoomId(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
  return cleaned.length >= 2 ? cleaned : 'SANCTUM-1';
}

function getOrCreateRoom(roomId: string, difficulty: Difficulty, initialHeroId: HeroId): GameRoom {
  let room = rooms.get(roomId);
  if (!room) {
    const sim = new ArenaSimulation(initialHeroId, difficulty, false);
    room = {
      roomId,
      sim,
      clients: new Map(),
      lastTickAt: performance.now(),
      tickAccumulator: 0,
      broadcastCounter: 0,
      idleSince: null,
    };
    rooms.set(roomId, room);
  }
  return room;
}

function sendJson(ws: WebSocket, msg: ServerToClientMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Authoritative 60Hz simulation tick + 30Hz state broadcast across all active rooms
const FIXED_DT = 1 / 60;
setInterval(() => {
  const now = performance.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.clients.size === 0) {
      if (room.idleSince === null) room.idleSince = now;
      if (now - room.idleSince > 45000) {
        rooms.delete(roomId);
      }
      continue;
    }
    room.idleSince = null;

    const elapsed = Math.min(0.08, (now - room.lastTickAt) / 1000);
    room.lastTickAt = now;
    room.tickAccumulator += elapsed;

    let stepped = false;
    try {
      while (room.tickAccumulator >= FIXED_DT) {
        room.sim.step(FIXED_DT);
        room.tickAccumulator -= FIXED_DT;
        stepped = true;
      }
    } catch (err) {
      console.error(`[Room ${roomId}] simulation step error:`, err);
      room.tickAccumulator = 0;
    }

    if (stepped) {
      room.broadcastCounter += 1;
      if (room.broadcastCounter >= 2) {
        room.broadcastCounter = 0;
        const snapshot = room.sim.buildSnapshot(true);
        const payload = JSON.stringify({ type: 'state', snapshot } satisfies ServerToClientMessage);
        for (const ws of room.clients.keys()) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        }
      }
    }
  }
}, 16);

async function bootstrap() {
  const app = express();
  app.use(express.json());

  // Live rooms directory API (includes takenHeroes for zero-duplicate selection)
  app.get('/api/rooms', (_req, res) => {
    const list: RoomSummary[] = [];
    for (const room of rooms.values()) {
      if (room.clients.size === 0) continue;
      list.push({
        roomId: room.roomId,
        humans: room.clients.size,
        maxHumans: 6,
        matchTime: Math.floor(room.sim.matchTime),
        difficulty: room.sim.difficulty,
        phase: room.sim.phase,
        takenHeroes: room.sim.getHumanTakenHeroes(),
      });
    }
    list.sort((a, b) => b.humans - a.humans);
    res.json({ rooms: list });
  });

  // Champion & Announcer Voice Line Synthesis API (Gemini 3.8 Flash Lite TTS + server cache)
  app.get('/api/voice/status', (_req, res) => {
    res.json({ available: isVoiceSynthesisConfigured() });
  });

  app.post('/api/voice/line', async (req, res) => {
    const body = (req.body ?? {}) as { speakerId?: unknown; lineId?: unknown };
    const speakerId = typeof body.speakerId === 'string' ? body.speakerId.trim() : '';
    const lineId = typeof body.lineId === 'string' ? body.lineId.trim() : '';
    if (!speakerId || !lineId) {
      res.status(400).json({ error: 'speakerId and lineId are required.' });
      return;
    }

    try {
      const wavBuffer = await synthesizeVoiceLine(speakerId, lineId);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', String(wavBuffer.length));
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(wavBuffer);
    } catch (err) {
      const status =
        typeof (err as { statusCode?: number })?.statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
      const message =
        err instanceof Error ? err.message : 'Failed to synthesize champion voice line.';
      console.error(`[VoiceAPI] ${speakerId}/${lineId} error:`, message);
      res.status(status).json({ error: message });
    }
  });

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);

  // Raw low-latency WebSocket server routed exclusively on /ws so reverse proxies & Vite never collide
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
  });

  server.on('upgrade', (req, socket, head) => {
    const urlPath = (req.url || '').split('?')[0];
    if (urlPath === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // Periodic WebSocket keepalive ping so Cloud Run / Render proxies keep connections alive
  setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.ping();
        } catch {
          // Ignore closed socket
        }
      }
    }
  }, 15000);

  wss.on('connection', (ws, req) => {
    req.socket?.setNoDelay(true);

    let boundClient: ConnectedClient | null = null;

    const detachClient = () => {
      if (!boundClient) return;
      const room = rooms.get(boundClient.roomId);
      if (room) {
        room.clients.delete(ws);
        room.sim.removeHumanPlayer(boundClient.heroEntityId);
      }
      boundClient = null;
    };

    ws.on('message', (raw) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientToServerMessage;
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        sendJson(ws, { type: 'pong', clientTime: msg.clientTime, serverTime: Date.now() });
        return;
      }

      if (msg.type === 'join') {
        detachClient();
        const heroId: HeroId = VALID_HEROES.has(msg.heroId) ? msg.heroId : 'marrow';
        const difficulty: Difficulty = VALID_DIFFS.has(msg.difficulty) ? msg.difficulty : 'standard';
        const roomId = sanitizeRoomId(msg.roomId || 'SANCTUM-1');
        const playerName = (msg.playerName || 'Champion').trim().slice(0, 16) || 'Champion';

        const room = getOrCreateRoom(roomId, difficulty, heroId);
        // Never trap a player joining an idle or finished match — reset cleanly!
        if (room.sim.phase !== 'PLAYING') {
          for (const staleWs of Array.from(room.clients.keys())) {
            if (staleWs !== ws) {
              sendJson(staleWs, {
                type: 'return_to_lobby',
                roomId,
                reason: `New match started in Room ${roomId}.`,
              });
            }
          }
          room.clients.clear();
          room.sim.initMatch(heroId, difficulty, false);
          room.lastTickAt = performance.now();
          room.tickAccumulator = 0;
        } else if (room.clients.size === 0) {
          // Fresh match when re-entering an empty room so you don't spawn into a half-finished bot game
          room.sim.initMatch(heroId, difficulty, false);
          room.lastTickAt = performance.now();
          room.tickAccumulator = 0;
        }

        const joined = room.sim.addHumanPlayer(heroId, playerName, msg.preferredTeam);
        if (!joined) {
          sendJson(ws, { type: 'error', message: `Room ${roomId} is full (6/6 champions).` });
          return;
        }

        boundClient = {
          ws,
          roomId,
          heroEntityId: joined.hero.id,
          heroId: joined.assignedHeroId,
          playerName,
          team: joined.hero.team,
        };
        room.clients.set(ws, boundClient);

        sendJson(ws, {
          type: 'joined',
          roomId,
          playerEntityId: joined.hero.id,
          assignedHeroId: joined.assignedHeroId,
          team: joined.hero.team,
          snapshot: room.sim.buildSnapshot(false),
        });
        return;
      }

      if (!boundClient) return;
      const room = rooms.get(boundClient.roomId);
      if (!room) return;

      if (msg.type === 'input') {
        room.sim.setHumanInput(boundClient.heroEntityId, msg.input);
      } else if (msg.type === 'buy_upgrade') {
        room.sim.buyUpgradeForHero(boundClient.heroEntityId, msg.upgradeId);
      } else if (msg.type === 'switch_hero') {
        const nextHeroId: HeroId = VALID_HEROES.has(msg.heroId) ? msg.heroId : boundClient.heroId;
        const switched = room.sim.switchHumanHero(boundClient.heroEntityId, nextHeroId);
        if (!switched) {
          sendJson(ws, {
            type: 'error',
            message: 'That champion is already controlled by another player in this match.',
          });
          return;
        }
        boundClient.heroId = switched.assignedHeroId;
        sendJson(ws, {
          type: 'joined',
          roomId: room.roomId,
          playerEntityId: switched.hero.id,
          assignedHeroId: switched.assignedHeroId,
          team: switched.hero.team,
          snapshot: room.sim.buildSnapshot(false),
        });
      } else if (msg.type === 'requeue_lobby') {
        if (room.sim.phase !== 'PLAYING') {
          const targetRoomId = room.roomId;
          const requester = boundClient.playerName;
          const allSockets = Array.from(room.clients.keys());
          rooms.delete(targetRoomId);
          for (const clientWs of allSockets) {
            sendJson(clientWs, {
              type: 'return_to_lobby',
              roomId: targetRoomId,
              reason: `${requester} returned Room ${targetRoomId} to Champion Select — pick your next Champion!`,
            });
          }
        }
      } else if (msg.type === 'restart') {
        if (room.sim.phase !== 'PLAYING') {
          const heroId: HeroId = VALID_HEROES.has(msg.heroId) ? msg.heroId : boundClient.heroId;
          const existingClients = Array.from(room.clients.values());
          room.sim.initMatch(heroId, room.sim.difficulty, false);
          for (const c of existingClients) {
            const nextHeroId = c.ws === ws ? heroId : c.heroId;
            const slot = room.sim.addHumanPlayer(nextHeroId, c.playerName, c.team);
            if (slot) {
              c.heroEntityId = slot.hero.id;
              c.heroId = slot.assignedHeroId;
              c.team = slot.hero.team;
              sendJson(c.ws, {
                type: 'joined',
                roomId: room.roomId,
                playerEntityId: slot.hero.id,
                assignedHeroId: slot.assignedHeroId,
                team: slot.hero.team,
                snapshot: room.sim.buildSnapshot(false),
              });
            }
          }
        }
      }
    });

    ws.on('close', detachClient);
    ws.on('error', detachClient);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Solarnauts Arena Server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
