import type { HeroId } from './types';

export interface ProcessedSprite {
  canvas: HTMLCanvasElement;
  flashCanvas: HTMLCanvasElement;
  width: number;
  height: number;
  aspect: number;
}

export interface ArenaArtAssets {
  bgSanctum: HTMLImageElement | null;
  bgCrypt: HTMLImageElement | null;
  bgInvasion: HTMLImageElement | null;
  stonePattern: CanvasPattern | null;
  stoneImage: HTMLImageElement | null;
  platformStoneLedge: ProcessedSprite | null;
  platformGlassBridge: ProcessedSprite | null;
  cathedralPillar: ProcessedSprite | null;
  jumpPad: ProcessedSprite | null;
  healingAltar: ProcessedSprite | null;
  relicShard: ProcessedSprite | null;
  dropPod: ProcessedSprite | null;
  heroes: Partial<Record<HeroId, ProcessedSprite>>;
  tower: ProcessedSprite | null;
  core: ProcessedSprite | null;
  trooper: ProcessedSprite | null;
  boneBorg: ProcessedSprite | null;
  cryptSpirit: ProcessedSprite | null;
}

const HERO_SPRITE_URLS: Record<HeroId, string> = {
  marrow: '/src/assets/images/sprite_marrow_1795469572432.jpg',
  seraph: '/src/assets/images/sprite_seraph_1795469572429.jpg',
  korak: '/src/assets/images/sprite_korak_1795469573103.jpg',
  vorg: '/src/assets/images/sprite_vorg_1795469572381.jpg',
  bastion: '/src/assets/images/sprite_bastion_1795469572005.jpg',
  vexia: '/src/assets/images/sprite_vexia_1795469572384.jpg',
  xylar: '/src/assets/images/sprite_xylar_1795469572612.jpg',
  caldris: '/src/assets/images/sprite_caldris_1795469572613.jpg',
  vespra: '/src/assets/images/sprite_vespra_1795485513446.jpg',
  vale: '/src/assets/images/sprite_vale_1795485513074.jpg',
};

const WORLD_SPRITE_URLS = {
  tower: '/src/assets/images/sprite_reliquary_tower_1795469572263.jpg',
  core: '/src/assets/images/sprite_ancient_core_1795469571672.jpg',
  trooper: '/src/assets/images/sprite_lane_trooper_1795469572691.jpg',
  boneBorg: '/src/assets/images/sprite_bone_borg_1795469572424.jpg',
  cryptSpirit: '/src/assets/images/sprite_crypt_spirit_1795469572383.jpg',
  platformStoneLedge: '/src/assets/images/platform_stone_ledge_1795469950932.jpg',
  platformGlassBridge: '/src/assets/images/platform_glass_bridge_1795469949609.jpg',
  cathedralPillar: '/src/assets/images/sprite_cathedral_pillar_1795469951946.jpg',
  jumpPad: '/src/assets/images/sprite_jump_pad_1795469951140.jpg',
  healingAltar: '/src/assets/images/sprite_healing_altar_1795469951823.jpg',
  relicShard: '/src/assets/images/sprite_relic_shard_1795469951438.jpg',
  dropPod: '/src/assets/images/sprite_drop_pod_1795470020626.jpg',
};

const BACKDROP_URLS = {
  sanctum: '/src/assets/images/arena_bg_sanctum_1795466270937.jpg',
  crypt: '/src/assets/images/arena_bg_crypt_1795466270148.jpg',
  invasion: '/src/assets/images/arena_bg_invasion_1795466271278.jpg',
  stone: '/src/assets/images/arena_stone_texture_1795466271187.jpg',
};

const assets: ArenaArtAssets = {
  bgSanctum: null,
  bgCrypt: null,
  bgInvasion: null,
  stonePattern: null,
  stoneImage: null,
  platformStoneLedge: null,
  platformGlassBridge: null,
  cathedralPillar: null,
  jumpPad: null,
  healingAltar: null,
  relicShard: null,
  dropPod: null,
  heroes: {},
  tower: null,
  core: null,
  trooper: null,
  boneBorg: null,
  cryptSpirit: null,
};

let preloadStarted = false;

/**
 * Converts a white-backdrop inked sprite JPEG into a razor-sharp transparent cutout
 * with zero white halo fringe, trimmed to tight content bounds, plus a pre-baked
 * pure-white hit-flash silhouette canvas.
 */
function processInkedSprite(
  img: HTMLImageElement,
  maxDim: number,
  removeInteriorWhiteHoles = true,
  padHorizontal = true
): ProcessedSprite | null {
  if (typeof document === 'undefined' || img.naturalWidth === 0 || img.naturalHeight === 0) {
    return null;
  }

  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(16, Math.round(img.naturalWidth * scale));
  const h = Math.max(16, Math.round(img.naturalHeight * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (!wctx) return null;

  wctx.imageSmoothingEnabled = true;
  wctx.imageSmoothingQuality = 'high';
  wctx.drawImage(img, 0, 0, w, h);

  const imgData = wctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;

  // Mask of pixels marked as background (1 = cleared)
  const bg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  const isOuterWhite = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
    const sat = maxC - minC;
    const lum = (r * 77 + g * 150 + b * 29) >> 8;
    return lum >= 216 && sat <= 42;
  };

  // Seed BFS from all 4 image edges
  const pushEdge = (x: number, y: number) => {
    const idx = y * w + x;
    if (bg[idx] === 0 && isOuterWhite(idx)) {
      bg[idx] = 1;
      queue[qTail++] = idx;
    }
  };
  for (let x = 0; x < w; x++) {
    pushEdge(x, 0);
    pushEdge(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    pushEdge(0, y);
    pushEdge(w - 1, y);
  }

  // Pass 1: Exterior flood fill
  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % w;
    const y = (idx - x) / w;

    if (x > 0) {
      const n = idx - 1;
      if (bg[n] === 0 && isOuterWhite(n)) {
        bg[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (x < w - 1) {
      const n = idx + 1;
      if (bg[n] === 0 && isOuterWhite(n)) {
        bg[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (y > 0) {
      const n = idx - w;
      if (bg[n] === 0 && isOuterWhite(n)) {
        bg[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (y < h - 1) {
      const n = idx + w;
      if (bg[n] === 0 && isOuterWhite(n)) {
        bg[n] = 1;
        queue[qTail++] = n;
      }
    }
  }

  // Pass 2: Remove enclosed pure-white holes (gaps inside arches, between arms/legs/chains)
  // Heavy black ink borders keep actual interior ivory/gold armor completely untouched.
  if (removeInteriorWhiteHoles) {
    const visited = new Uint8Array(total);
    const region = new Int32Array(total);

    const isPureHoleWhite = (idx: number): boolean => {
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
      const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
      return minC >= 234 && maxC - minC <= 18;
    };

    for (let i = 0; i < total; i++) {
      if (bg[i] === 1 || visited[i] === 1 || !isPureHoleWhite(i)) continue;
      let rHead = 0;
      let rTail = 0;
      visited[i] = 1;
      region[rTail++] = i;

      while (rHead < rTail) {
        const cur = region[rHead++];
        const x = cur % w;
        const y = (cur - x) / w;
        const neighbors = [
          x > 0 ? cur - 1 : -1,
          x < w - 1 ? cur + 1 : -1,
          y > 0 ? cur - w : -1,
          y < h - 1 ? cur + w : -1,
        ];
        for (let k = 0; k < 4; k++) {
          const n = neighbors[k];
          if (n >= 0 && bg[n] === 0 && visited[n] === 0 && isPureHoleWhite(n)) {
            visited[n] = 1;
            region[rTail++] = n;
          }
        }
      }

      // Only clear genuine holes (>= 16 px) so tiny eye/weapon specular dots stay bright
      if (rTail >= 16) {
        for (let k = 0; k < rTail; k++) {
          bg[region[k]] = 1;
        }
      }
    }
  }

  // Pass 3: Apply transparency + 2-ring anti-aliased white-fringe despill
  for (let i = 0; i < total; i++) {
    if (bg[i] === 1) {
      data[i * 4 + 3] = 0;
    }
  }

  // Soften light anti-aliased edge pixels immediately bordering transparent background
  for (let pass = 0; pass < 2; pass++) {
    const fringe: number[] = [];
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const idx = row + x;
        const a = data[idx * 4 + 3];
        if (a === 0) continue;

        const hasClearNeighbor =
          data[(idx - 1) * 4 + 3] < 40 ||
          data[(idx + 1) * 4 + 3] < 40 ||
          data[(idx - w) * 4 + 3] < 40 ||
          data[(idx + w) * 4 + 3] < 40;

        if (!hasClearNeighbor) continue;

        const p = idx * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
        const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
        const sat = maxC - minC;
        const lum = (r * 77 + g * 150 + b * 29) >> 8;

        if (lum > 180 && sat < 45) {
          fringe.push(idx);
        } else if (lum > 120 && sat < 35 && pass === 0) {
          // Darken light gray AA border into crisp black ink edge
          const keep = Math.max(0.25, 1 - (lum - 110) / 145);
          data[p] = Math.round(r * keep * 0.55);
          data[p + 1] = Math.round(g * keep * 0.55);
          data[p + 2] = Math.round(b * keep * 0.65);
          data[p + 3] = Math.round(a * keep);
        }
      }
    }
    for (let i = 0; i < fringe.length; i++) {
      data[fringe[i] * 4 + 3] = 0;
    }
  }

  wctx.putImageData(imgData, 0, 0);

  // Compute tight opaque bounding box so feet/bases align precisely to platforms
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (data[(row + x) * 4 + 3] > 28) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return null;

  const padX = padHorizontal ? 2 : 0;
  const padY = 2;
  const sx = Math.max(0, minX - padX);
  const sy = Math.max(0, minY - padY);
  const sw = Math.min(w - sx, maxX - minX + 1 + padX * 2);
  const sh = Math.min(h - sy, maxY - minY + 1 + padY * 2);

  const trimmed = document.createElement('canvas');
  trimmed.width = sw;
  trimmed.height = sh;
  const tctx = trimmed.getContext('2d');
  if (!tctx) return null;
  tctx.drawImage(work, sx, sy, sw, sh, 0, 0, sw, sh);

  // Pre-bake pure white hit-flash silhouette
  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = sw;
  flashCanvas.height = sh;
  const fctx = flashCanvas.getContext('2d');
  if (fctx) {
    fctx.drawImage(trimmed, 0, 0);
    fctx.globalCompositeOperation = 'source-in';
    fctx.fillStyle = '#FFFFFF';
    fctx.fillRect(0, 0, sw, sh);
  }

  return {
    canvas: trimmed,
    flashCanvas,
    width: sw,
    height: sh,
    aspect: sw / sh,
  };
}

function loadRawImage(url: string, onLoad: (img: HTMLImageElement) => void): void {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.decoding = 'async';
  img.crossOrigin = 'anonymous';
  img.onload = () => onLoad(img);
  img.onerror = () => {
    // Graceful fallback: procedural renderer covers any unloaded image
  };
  img.src = url;
}

export function ensureArenaArtLoaded(ctx?: CanvasRenderingContext2D): ArenaArtAssets {
  if (!preloadStarted && typeof window !== 'undefined') {
    preloadStarted = true;

    loadRawImage(BACKDROP_URLS.sanctum, (img) => {
      assets.bgSanctum = img;
    });
    loadRawImage(BACKDROP_URLS.crypt, (img) => {
      assets.bgCrypt = img;
    });
    loadRawImage(BACKDROP_URLS.invasion, (img) => {
      assets.bgInvasion = img;
    });
    loadRawImage(BACKDROP_URLS.stone, (img) => {
      assets.stoneImage = img;
    });

    (Object.keys(HERO_SPRITE_URLS) as HeroId[]).forEach((heroId) => {
      loadRawImage(HERO_SPRITE_URLS[heroId], (img) => {
        const processed = processInkedSprite(img, 360, true);
        if (processed) assets.heroes[heroId] = processed;
      });
    });

    loadRawImage(WORLD_SPRITE_URLS.tower, (img) => {
      assets.tower = processInkedSprite(img, 380, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.core, (img) => {
      assets.core = processInkedSprite(img, 440, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.trooper, (img) => {
      assets.trooper = processInkedSprite(img, 240, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.boneBorg, (img) => {
      assets.boneBorg = processInkedSprite(img, 240, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.cryptSpirit, (img) => {
      assets.cryptSpirit = processInkedSprite(img, 240, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.platformStoneLedge, (img) => {
      assets.platformStoneLedge = processInkedSprite(img, 680, true, false);
    });
    loadRawImage(WORLD_SPRITE_URLS.platformGlassBridge, (img) => {
      assets.platformGlassBridge = processInkedSprite(img, 680, true, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.cathedralPillar, (img) => {
      assets.cathedralPillar = processInkedSprite(img, 480, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.jumpPad, (img) => {
      assets.jumpPad = processInkedSprite(img, 320, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.healingAltar, (img) => {
      assets.healingAltar = processInkedSprite(img, 440, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.relicShard, (img) => {
      assets.relicShard = processInkedSprite(img, 180, true);
    });
    loadRawImage(WORLD_SPRITE_URLS.dropPod, (img) => {
      assets.dropPod = processInkedSprite(img, 280, true);
    });
  }

  // Create tiled stone CanvasPattern lazily once image is ready
  if (ctx && assets.stoneImage && !assets.stonePattern) {
    // Downscale stone tile into a crisp 256x144 repeatable tile so masonry bricks are true-to-scale
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 144;
    const tctx = tile.getContext('2d');
    if (tctx) {
      tctx.drawImage(assets.stoneImage, 0, 0, tile.width, tile.height);
      assets.stonePattern = ctx.createPattern(tile, 'repeat');
    }
  }

  return assets;
}
