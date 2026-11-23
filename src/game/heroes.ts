import type { ComputedHeroStats, HeroDefinition, HeroId } from './types.ts';

export const KEY_ART_URL = '/src/assets/images/citadel_title_keyart_1795462454803.jpg';

const SERAPH_PORTRAIT = '/src/assets/images/hero_seraph9_1795462455777.jpg';
const KORAK_PORTRAIT = '/src/assets/images/hero_korak_1795462455331.jpg';
const VORG_PORTRAIT = '/src/assets/images/hero_vorg_1795462456095.jpg';
const BASTION_PORTRAIT = '/src/assets/images/hero_bastion_1795462455516.jpg';
const MARROW_PORTRAIT = '/src/assets/images/hero_marrowhook_1795462456608.jpg';
const VEXIA_PORTRAIT = '/src/assets/images/hero_vexia_1795462455518.jpg';
const XYLAR_PORTRAIT = '/src/assets/images/hero_xylar_1795462456090.jpg';
const CALDRIS_PORTRAIT = '/src/assets/images/hero_caldris_1795462456859.jpg';

export const HERO_LIST: HeroDefinition[] = [
  {
    id: 'marrow',
    name: 'Marrow-Hook',
    codename: 'THE ABYSSAL BUTCHER',
    faction: 'Primordial Pact',
    purity: 'hybrid',
    disciplineLabel: 'Hybrid · Primordial × Cyber',
    craftSummary: 'Plague-cursed executioner fused with alien pneumatic chain-winches and a plasma cleaver.',
    role: 'Hook Bruiser',
    mobilityLabel: 'Heavy Stride',
    portrait: MARROW_PORTRAIT,
    accentColor: '#10B981',
    secondaryColor: '#F59E0B',
    baseHp: 365,
    baseSpeed: 248,
    jumpForce: 548,
    maxJumps: 1,
    canHover: false,
    hoverGravityScale: 1,
    width: 44,
    height: 54,
    primary: {
      name: 'Plasma Cleaver',
      keyLabel: 'LMB',
      description: 'Sweeping close-range piercing cleave that slices through crowds and drains essence.',
      cooldown: 0.42,
      icon: 'bite',
    },
    skill1: {
      name: 'Abyssal Chain Hook',
      keyLabel: 'Q / RMB',
      description: 'Launches a long-range barbed chain through platforms, stunning and yanking the first enemy straight to you.',
      cooldown: 7.8,
      icon: 'hook',
    },
    skill2: {
      name: 'Blight Furnace',
      keyLabel: 'E / SHIFT',
      description: 'Ignites a pressurized plague aura for 4.2s that continuously rots & slows nearby enemies while granting armor.',
      cooldown: 9.5,
      icon: 'rot',
    },
    upgrades: [
      {
        id: 'mh_p1',
        row: 'primary',
        aspect: 'cyber',
        archetype: 'Executioner',
        name: 'Serrated Gore-Saw',
        cost: 135,
        maxRank: 2,
        summary: 'Superheats cleaver teeth to tear into hooked prey.',
        perRankText: '+7 cleave dmg',
        capstoneText: 'Cleaver strikes slow targets for 0.8s so hooked prey cannot escape.',
        icon: 'damage',
      },
      {
        id: 'mh_p2',
        row: 'primary',
        aspect: 'primordial',
        archetype: 'Plague Juggernaut',
        name: 'Butcher Feast',
        cost: 140,
        maxRank: 2,
        summary: 'Cleaver strikes siphon blood back into Marrow-Hook.',
        perRankText: '+14% lifesteal',
        capstoneText: 'Cleaving an enemy hero grants +30 Bone Shield per strike.',
        icon: 'heal',
      },
      {
        id: 'mh_p3',
        row: 'primary',
        aspect: 'cyber',
        archetype: 'Executioner',
        name: 'Pneumatic Rend',
        cost: 150,
        maxRank: 2,
        summary: 'Accelerates hydraulic swing pistons.',
        perRankText: '+18% swing speed',
        capstoneText: 'Every 3rd Cleaver unleashes a wide extended shock-cleave (+90px reach).',
        icon: 'speed',
      },
      {
        id: 'mh_q1',
        row: 'skill1',
        aspect: 'cyber',
        archetype: 'Sniper Hook',
        name: 'Abyssal Long-Spool',
        cost: 145,
        maxRank: 2,
        summary: 'Extends alien alloy chain length to snag enemies across lanes.',
        perRankText: '+120 hook range',
        capstoneText: 'Hook launches 35% faster and reels captured victims in rapidly.',
        icon: 'range',
      },
      {
        id: 'mh_q2',
        row: 'skill1',
        aspect: 'primordial',
        archetype: 'Plague Juggernaut',
        name: 'Gore-Claw Ignition',
        cost: 165,
        maxRank: 2,
        summary: 'Barbed bone claws shred flesh and extend capture stun.',
        perRankText: '+24 dmg · +0.25s stun',
        capstoneText: 'Hooking an enemy hero automatically ignites a free 2.2s Blight Furnace.',
        icon: 'burst',
      },
      {
        id: 'mh_q3',
        row: 'skill1',
        aspect: 'cyber',
        archetype: 'Sniper Hook',
        name: 'Reset Winch',
        cost: 150,
        maxRank: 2,
        summary: 'Recycles chain recoil for relentless pick pressure.',
        perRankText: '-1.2s hook CD',
        capstoneText: 'Hooking an enemy champion immediately refunds 45% of Hook cooldown.',
        icon: 'cooldown',
      },
      {
        id: 'mh_e1',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Plague Juggernaut',
        name: 'Pestilent Miasma',
        cost: 145,
        maxRank: 2,
        summary: 'Thickens blight fumes for wider, deadlier rot ticks.',
        perRankText: '+8 rot/tick · +24 radius',
        capstoneText: 'Blight Furnace siphons 35% of all rot damage dealt back as health.',
        icon: 'burst',
      },
      {
        id: 'mh_e2',
        row: 'skill2',
        aspect: 'cyber',
        archetype: 'Plague Juggernaut',
        name: 'Boiler Overpressure',
        cost: 155,
        maxRank: 2,
        summary: 'Reinforces chest boiler plating while Blight Furnace burns.',
        perRankText: '+14% armor · +1.0s dur',
        capstoneText: 'Gain +26% Move Speed while Blight Furnace is active to run prey down.',
        icon: 'shield',
      },
      {
        id: 'mh_e3',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Executioner',
        name: 'Plague Vent',
        cost: 155,
        maxRank: 2,
        summary: 'Vents boiler heat faster between fights.',
        perRankText: '-1.4s Furnace CD',
        capstoneText: 'When Blight Furnace ends, it detonates in a 65 dmg toxic stun nova.',
        icon: 'special',
      },
      {
        id: 'mh_u1',
        row: 'utility',
        aspect: 'primordial',
        archetype: 'Plague Juggernaut',
        name: 'Stitched Flesh Heap',
        cost: 135,
        maxRank: 2,
        summary: 'Thickens grafted hide with raw primordial mass.',
        perRankText: '+55 Max HP',
        capstoneText: 'Every enemy champion kill permanently adds +25 Max HP for the match.',
        icon: 'shield',
      },
      {
        id: 'mh_u2',
        row: 'utility',
        aspect: 'cyber',
        archetype: 'Sniper Hook',
        name: 'Hydraulic Vault Boots',
        cost: 130,
        maxRank: 2,
        summary: 'Upgrades heavy leg pistons for agile lane flanks.',
        perRankText: '+11% speed & jump',
        capstoneText: 'Unlocks a 2nd Heavy Leap (Double Jump) for high-rafter hook ambushes.',
        icon: 'speed',
      },
      {
        id: 'mh_u3',
        row: 'utility',
        aspect: 'primordial',
        archetype: 'Plague Juggernaut',
        name: 'Carrion Harvester',
        cost: 120,
        maxRank: 2,
        summary: 'Harvests battle essence from the slaughterhouse floor.',
        perRankText: '+3.5 Relic/s · +3 HP/s',
        capstoneText: 'Every enemy creep kill instantly restores +18 HP to Marrow-Hook.',
        icon: 'solar',
      },
    ],
  },
  {
    id: 'seraph',
    name: 'Seraph-9',
    codename: 'CYBER-SERAPH',
    faction: 'Sacred Order',
    purity: 'hybrid',
    disciplineLabel: 'Hybrid · Sacred × Cyber',
    craftSummary: 'Consecrated angel who can forge into either a Pure Holy Sky-DPS or a Winged Sanctuary Support.',
    role: 'Sky DPS / Support',
    mobilityLabel: 'Halo Hover',
    portrait: SERAPH_PORTRAIT,
    accentColor: '#F59E0B',
    secondaryColor: '#38BDF8',
    baseHp: 255,
    baseSpeed: 270,
    jumpForce: 560,
    maxJumps: 1,
    canHover: true,
    hoverGravityScale: 0.24,
    width: 34,
    height: 48,
    primary: {
      name: 'Radiant Glaive',
      keyLabel: 'LMB',
      description: 'Fires swift golden-cyan plasma lances—upgradeable for triple-shot Holy DPS or ally-mending light.',
      cooldown: 0.24,
      icon: 'spear',
    },
    skill1: {
      name: 'Judgment Spear',
      keyLabel: 'Q / RMB',
      description: 'Hurls a consecrated rail-spear that detonates in holy AoE—morph into Twin Lances or a Beacon of Grace.',
      cooldown: 6.5,
      icon: 'spear',
    },
    skill2: {
      name: 'Aegis Descent',
      keyLabel: 'E / SHIFT',
      description: 'Erupts in a radiant cyber-halo—build into full-team Sanctuary Shields or a Pure Holy Supernova.',
      cooldown: 10.5,
      icon: 'aegis',
    },
    upgrades: [
      {
        id: 'sr_p1',
        row: 'primary',
        aspect: 'sacred',
        archetype: 'Holy DPS',
        name: 'Sunforged Fan',
        cost: 135,
        maxRank: 2,
        summary: 'Infuses glaive lances with searing solar fire.',
        perRankText: '+4 glaive dmg',
        capstoneText: 'Every 3rd Radiant Glaive fires a 3-bolt golden spread volley.',
        icon: 'damage',
      },
      {
        id: 'sr_p2',
        row: 'primary',
        aspect: 'sacred',
        archetype: 'Sanctuary Support',
        name: 'Merciful Light',
        cost: 140,
        maxRank: 2,
        summary: 'Attunes glaive fire rate to soothe allied wounds.',
        perRankText: '+14% fire rate · +10 ally heal',
        capstoneText: 'Radiant Glaive passes through allies, healing +24 HP and granting +20 Shield.',
        icon: 'heal',
      },
      {
        id: 'sr_p3',
        row: 'primary',
        aspect: 'cyber',
        archetype: 'Holy DPS',
        name: 'Hard-Light Piercer',
        cost: 150,
        maxRank: 2,
        summary: 'Accelerates rail coils for long-range sky sniping.',
        perRankText: '+65 range · +80 bolt speed',
        capstoneText: 'Glaive bolts pierce straight through all enemies and slow for 0.6s.',
        icon: 'range',
      },
      {
        id: 'sr_q1',
        row: 'skill1',
        aspect: 'cyber',
        archetype: 'Holy DPS',
        name: 'Twin Lance Array',
        cost: 155,
        maxRank: 2,
        summary: 'Overcharges spear warheads for heavy sky-burst.',
        perRankText: '+20 spear dmg',
        capstoneText: 'Hurls 2 Judgment Spears side-by-side in a double rail volley.',
        icon: 'burst',
      },
      {
        id: 'sr_q2',
        row: 'skill1',
        aspect: 'sacred',
        archetype: 'Sanctuary Support',
        name: 'Beacon of Grace',
        cost: 145,
        maxRank: 2,
        summary: 'Turns Judgment Spear into a ranged lifesaving benediction.',
        perRankText: '-1.0s Spear CD',
        capstoneText: 'Spear detonation heals all nearby allies for +65 HP & +45 Shield.',
        icon: 'heal',
      },
      {
        id: 'sr_q3',
        row: 'skill1',
        aspect: 'sacred',
        archetype: 'Control',
        name: 'Pinning Consecration',
        cost: 145,
        maxRank: 2,
        summary: 'Widens consecrated shockwave around the spear impact.',
        perRankText: '+22 radius · +0.2s stun',
        capstoneText: 'Extends Spear stun by +0.45s and blasts victims skyward.',
        icon: 'special',
      },
      {
        id: 'sr_e1',
        row: 'skill2',
        aspect: 'sacred',
        archetype: 'Sanctuary Support',
        name: 'Archangel Choir',
        cost: 150,
        maxRank: 2,
        summary: 'Transforms Aegis Descent into an unstoppable team-wide barrier.',
        perRankText: '+38 shield · +28 ally heal',
        capstoneText: 'Grants EVERY nearby allied champion +90 Aegis Shield on cast.',
        icon: 'shield',
      },
      {
        id: 'sr_e2',
        row: 'skill2',
        aspect: 'cyber',
        archetype: 'Holy DPS',
        name: 'Wrathful Supernova',
        cost: 155,
        maxRank: 2,
        summary: 'Overloads halo capacitors for pure offensive devastation.',
        perRankText: '+26 blast dmg · +26 radius',
        capstoneText: 'Supernova adds +75 Holy burst damage & stuns enemies for 0.65s.',
        icon: 'burst',
      },
      {
        id: 'sr_e3',
        row: 'skill2',
        aspect: 'cyber',
        archetype: 'Holy DPS',
        name: 'Halo Reset Matrix',
        cost: 145,
        maxRank: 2,
        summary: 'Cycles halo thrusters rapidly for constant dive combos.',
        perRankText: '-1.5s Aegis CD',
        capstoneText: 'Casting Aegis Descent instantly resets Judgment Spear cooldown.',
        icon: 'cooldown',
      },
      {
        id: 'sr_u1',
        row: 'utility',
        aspect: 'cyber',
        archetype: 'Sky Mobility',
        name: 'Perpetual Seraph Wings',
        cost: 130,
        maxRank: 2,
        summary: 'Upgrades hard-light wing lift and flight agility.',
        perRankText: '+10% speed & jump',
        capstoneText: 'Infinite Halo Hover — airborne hover fuel never depletes.',
        icon: 'speed',
      },
      {
        id: 'sr_u2',
        row: 'utility',
        aspect: 'sacred',
        archetype: 'Sanctuary Support',
        name: 'Martyr’s Aura',
        cost: 135,
        maxRank: 2,
        summary: 'Wards chassis with cathedral gold and gentle restoration.',
        perRankText: '+42 Max HP · +3 HP/s',
        capstoneText: 'Passively pulses +14 HP healing every 2.5s to nearby injured allies.',
        icon: 'heal',
      },
      {
        id: 'sr_u3',
        row: 'utility',
        aspect: 'sacred',
        archetype: 'Holy DPS',
        name: 'Zealot’s Momentum',
        cost: 120,
        maxRank: 2,
        summary: 'Channels sacred zeal into rapid battlefield scaling.',
        perRankText: '+4 Relic/sec',
        capstoneText: 'Hero kills restore 25% HP and trim all ability cooldowns by 3.0s.',
        icon: 'solar',
      },
    ],
  },
  {
    id: 'korak',
    name: 'Korak',
    codename: 'PURE WITCH DOCTOR',
    faction: 'Primordial Pact',
    purity: 'purist',
    disciplineLabel: 'Purist · Pure Primordial',
    craftSummary: 'Unaugmented master of bone, swamp hexes, and ancestral spirits. Zero alien tech.',
    role: 'Spirit Healer / Hex',
    mobilityLabel: 'Spirit Glide',
    portrait: KORAK_PORTRAIT,
    accentColor: '#34D399',
    secondaryColor: '#A78BFA',
    baseHp: 245,
    baseSpeed: 258,
    jumpForce: 560,
    maxJumps: 1,
    canHover: true,
    hoverGravityScale: 0.28,
    width: 34,
    height: 48,
    primary: {
      name: 'Hex-Mender Wave',
      keyLabel: 'LMB',
      description: 'Pure spirit bolt that mends allied flesh and curses enemies on impact.',
      cooldown: 0.27,
      icon: 'beam',
    },
    skill1: {
      name: 'Skull Spirit Totem',
      keyLabel: 'Q / RMB',
      description: 'Plants an ancestral bone totem pulsing continuous healing to allies and hex-slowing foes.',
      cooldown: 11.0,
      icon: 'totem',
    },
    skill2: {
      name: 'Ancestral Skulls',
      keyLabel: 'E / SHIFT',
      description: 'Summons an orbiting spirit skull (max 3) that spits curses; at 3 skulls, launches them all as exploding hexes.',
      cooldown: 5.0,
      icon: 'drone',
    },
    upgrades: [
      {
        id: 'kr_p1',
        row: 'primary',
        aspect: 'primordial',
        archetype: 'Spirit Healer',
        name: 'Swamp Balm',
        cost: 130,
        maxRank: 2,
        summary: 'Deepens ancestral spirit healing on allies.',
        perRankText: '+7 ally heal/bolt',
        capstoneText: 'Healing an ally also weaves a +26 Spirit Shield around them.',
        icon: 'heal',
      },
      {
        id: 'kr_p2',
        row: 'primary',
        aspect: 'primordial',
        archetype: 'Hex Shaman',
        name: 'Venom Fetish',
        cost: 135,
        maxRank: 2,
        summary: 'Sharpens ancestral curses against enemy champions.',
        perRankText: '+6 curse dmg',
        capstoneText: 'Hex-Mender bolts slow enemies for 0.85s and reach +100px farther.',
        icon: 'damage',
      },
      {
        id: 'kr_p3',
        row: 'primary',
        aspect: 'primordial',
        archetype: 'Spirit Healer',
        name: 'Symbiotic Chant',
        cost: 130,
        maxRank: 2,
        summary: 'Healing allied champions harvests bonus Relic Essence.',
        perRankText: '+4 Relic per ally heal',
        capstoneText: 'Every allied hero heal mirrors 50% of the healing back onto Korak.',
        icon: 'solar',
      },
      {
        id: 'kr_q1',
        row: 'skill1',
        aspect: 'primordial',
        archetype: 'Spirit Healer',
        name: 'Grand Ancestor Shrine',
        cost: 145,
        maxRank: 2,
        summary: 'Expands totem sanctuary aura and healing power.',
        perRankText: '+7 heal/tick · +30 radius',
        capstoneText: 'Totem pulses also grant +22 Spirit Shield to every ally inside.',
        icon: 'heal',
      },
      {
        id: 'kr_q2',
        row: 'skill1',
        aspect: 'primordial',
        archetype: 'Hex Shaman',
        name: 'Plague Juju Totem',
        cost: 155,
        maxRank: 2,
        summary: 'Turns the healing totem into a lethal cursed zone.',
        perRankText: '+16 enemy pulse dmg',
        capstoneText: 'Enemies inside the Totem suffer heavy curse burn & 1.2s slow per pulse.',
        icon: 'burst',
      },
      {
        id: 'kr_q3',
        row: 'skill1',
        aspect: 'primordial',
        archetype: 'Control',
        name: 'Eternal Bone Roots',
        cost: 145,
        maxRank: 2,
        summary: 'Extends totem lifespan and hastens recast.',
        perRankText: '+2.5s dur · -1.5s CD',
        capstoneText: 'When Totem expires or breaks, it bursts for +70 Ally Heal & 55 Enemy Dmg.',
        icon: 'cooldown',
      },
      {
        id: 'kr_e1',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Hex Shaman',
        name: 'Vengeful Ancestors',
        cost: 155,
        maxRank: 2,
        summary: 'Empowers orbiting skulls and 3-skull barrage explosions.',
        perRankText: '+12 skull dmg',
        capstoneText: 'Orbiting skulls spit twice as fast & volley impacts stun for 0.45s.',
        icon: 'burst',
      },
      {
        id: 'kr_e2',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Spirit Healer',
        name: 'Guardian Spirit Ward',
        cost: 145,
        maxRank: 2,
        summary: 'Summoning a skull weaves bone spirit armor.',
        perRankText: '+35 shield on cast',
        capstoneText: 'Each orbiting skull grants Korak +10% damage reduction (up to 30%).',
        icon: 'shield',
      },
      {
        id: 'kr_e3',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Hex Shaman',
        name: 'Endless Séance',
        cost: 145,
        maxRank: 2,
        summary: 'Calls ancestral skulls back rapidly.',
        perRankText: '-0.9s skull CD',
        capstoneText: 'Launching a 3-skull volley immediately conjures 1 fresh skull.',
        icon: 'cooldown',
      },
      {
        id: 'kr_u1',
        row: 'utility',
        aspect: 'primordial',
        archetype: 'Spirit Healer',
        name: 'Bloodleaf Draught',
        cost: 125,
        maxRank: 2,
        summary: 'Fortifies shamanic vitality and organic regeneration.',
        perRankText: '+42 Max HP · +3.5 HP/s',
        capstoneText: 'While below 45% HP, Korak’s natural regeneration triples.',
        icon: 'heal',
      },
      {
        id: 'kr_u2',
        row: 'utility',
        aspect: 'primordial',
        archetype: 'Spirit Glide',
        name: 'Wind-Walker Fetish',
        cost: 125,
        maxRank: 2,
        summary: 'Floats swiftly between cathedral lanes.',
        perRankText: '+11% speed & jump',
        capstoneText: 'Infinite Spirit Glide — hover fuel never runs out mid-air.',
        icon: 'speed',
      },
      {
        id: 'kr_u3',
        row: 'utility',
        aspect: 'primordial',
        archetype: 'Spirit Healer',
        name: 'Tribal Conduit',
        cost: 120,
        maxRank: 2,
        summary: 'Channels pure primordial wealth.',
        perRankText: '+4.5 Relic/sec',
        capstoneText: 'Every allied hero heal trims Totem & Skull cooldowns by 0.4s.',
        icon: 'solar',
      },
    ],
  },
  {
    id: 'vorg',
    name: 'Vorg',
    codename: 'PURE WARLOCK',
    faction: 'Primordial Pact',
    purity: 'purist',
    disciplineLabel: 'Purist · Pure Occult',
    craftSummary: 'Pure pact-magic warlock who rejects faith and machines—build into Blink Executioner or Soul-Drain Tempest.',
    role: 'Rift Assassin',
    mobilityLabel: 'Double Jump',
    portrait: VORG_PORTRAIT,
    accentColor: '#A855F7',
    secondaryColor: '#34D399',
    baseHp: 215,
    baseSpeed: 318,
    jumpForce: 565,
    maxJumps: 2,
    canHover: false,
    hoverGravityScale: 1,
    width: 30,
    height: 44,
    primary: {
      name: 'Eldritch Bolts',
      keyLabel: 'LMB',
      description: 'Rapid-fire pure abyssal shards that shred isolated targets.',
      cooldown: 0.16,
      icon: 'burst',
    },
    skill1: {
      name: 'Rift Phase Dash',
      keyLabel: 'Q / RMB',
      description: 'Tears through space toward your cursor, slicing and briefly stunning every enemy crossed.',
      cooldown: 5.8,
      icon: 'dash',
    },
    skill2: {
      name: 'Soul Maelstrom',
      keyLabel: 'E / SHIFT',
      description: 'Unleashes a whirling tempest of pure warlock soulfire for 2.3s with bonus speed and armor.',
      cooldown: 9.2,
      icon: 'spin',
    },
    upgrades: [
      {
        id: 'vg_p1',
        row: 'primary',
        aspect: 'primordial',
        archetype: 'Rift Executioner',
        name: 'Twin Abyssal Shards',
        cost: 135,
        maxRank: 2,
        summary: 'Empowers every eldritch bolt.',
        perRankText: '+3.5 bolt dmg',
        capstoneText: 'Every attack fires 2 parallel Eldritch Bolts for deadly close-range DPS.',
        icon: 'damage',
      },
      {
        id: 'vg_p2',
        row: 'primary',
        aspect: 'primordial',
        archetype: 'Rift Executioner',
        name: 'Pact Cadence',
        cost: 145,
        maxRank: 2,
        summary: 'Accelerates eldritch barrage tempo.',
        perRankText: '+18% fire rate',
        capstoneText: 'Every 5th Eldritch Bolt detonates in a 56px occult splash burst.',
        icon: 'speed',
      },
      {
        id: 'vg_p3',
        row: 'primary',
        aspect: 'primordial',
        archetype: 'Soul Drain',
        name: 'Leeching Pact',
        cost: 150,
        maxRank: 2,
        summary: 'Eldritch bolts drain enemy essence into health.',
        perRankText: '+14% lifesteal',
        capstoneText: 'Overhealing from lifesteal converts into an Occult Shield (up to 85).',
        icon: 'heal',
      },
      {
        id: 'vg_q1',
        row: 'skill1',
        aspect: 'primordial',
        archetype: 'Rift Executioner',
        name: 'Rift Executioner',
        cost: 155,
        maxRank: 2,
        summary: 'Turns Phase Dash into a lethal assassination finisher.',
        perRankText: '+24 dash dmg',
        capstoneText: 'Deals +60 bonus execute damage to enemies below 45% HP.',
        icon: 'burst',
      },
      {
        id: 'vg_q2',
        row: 'skill1',
        aspect: 'primordial',
        archetype: 'Control',
        name: 'Hex Paralysis',
        cost: 155,
        maxRank: 2,
        summary: 'Extends dash stun and weaves a pact-ward.',
        perRankText: '+0.26s stun · +45 shield',
        capstoneText: 'Exiting Rift Dash detonates a 78px void shockwave at your arrival point.',
        icon: 'shield',
      },
      {
        id: 'vg_q3',
        row: 'skill1',
        aspect: 'primordial',
        archetype: 'Rift Executioner',
        name: 'Flicker Reset',
        cost: 150,
        maxRank: 2,
        summary: 'Rift Dash recovers at blinding speed.',
        perRankText: '-1.1s dash CD',
        capstoneText: 'Scoring an enemy hero kill instantly resets Rift Phase Dash cooldown.',
        icon: 'cooldown',
      },
      {
        id: 'vg_e1',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Soul Drain',
        name: 'Devouring Tempest',
        cost: 160,
        maxRank: 2,
        summary: 'Burns harder across a wider soulfire maelstrom.',
        perRankText: '+10 tick dmg · +22 radius',
        capstoneText: 'Soul Maelstrom heals Vorg for 30% of all whirlwind damage dealt.',
        icon: 'burst',
      },
      {
        id: 'vg_e2',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Rift Executioner',
        name: 'Wraith Momentum',
        cost: 145,
        maxRank: 2,
        summary: 'Longer whirlwind with faster pursuit speed.',
        perRankText: '+0.5s dur · +18% speed',
        capstoneText: 'Maelstrom ticks slow every enemy caught inside by 42%.',
        icon: 'speed',
      },
      {
        id: 'vg_e3',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Soul Drain',
        name: 'Pact Carapace',
        cost: 150,
        maxRank: 2,
        summary: 'Hardens warlock aura during Maelstrom.',
        perRankText: '+18% armor',
        capstoneText: 'Activating Soul Maelstrom immediately grants +75 Occult Shield.',
        icon: 'shield',
      },
      {
        id: 'vg_u1',
        row: 'utility',
        aspect: 'primordial',
        archetype: 'Mobility',
        name: 'Triple Shadowstep',
        cost: 135,
        maxRank: 2,
        summary: 'Raises base agility for relentless aerial flanks.',
        perRankText: '+11% speed & jump',
        capstoneText: 'Unlocks a 3rd Mid-Air Jump for unmatched vertical outplays.',
        icon: 'speed',
      },
      {
        id: 'vg_u2',
        row: 'utility',
        aspect: 'primordial',
        archetype: 'Soul Drain',
        name: 'Blood Chalice',
        cost: 130,
        maxRank: 2,
        summary: 'Fortifies fragile occult vessel.',
        perRankText: '+42 Max HP',
        capstoneText: 'Champion kills immediately restore +90 HP to sustain dive streaks.',
        icon: 'heal',
      },
      {
        id: 'vg_u3',
        row: 'utility',
        aspect: 'primordial',
        archetype: 'Rift Executioner',
        name: 'Soul Siphon Tithe',
        cost: 120,
        maxRank: 2,
        summary: 'Passively siphons Relic Essence from the crypt.',
        perRankText: '+4 Relic/sec',
        capstoneText: 'Enemy creep kills trim both Rift Dash & Maelstrom CDs by 0.35s.',
        icon: 'solar',
      },
    ],
  },
  {
    id: 'bastion',
    name: 'Brother Bastion',
    codename: 'PURE TEMPLAR',
    faction: 'Sacred Order',
    purity: 'purist',
    disciplineLabel: 'Purist · Pure Sacred',
    craftSummary: 'Unbroken cathedral juggernaut—build into an Immortal Raid-Boss Tank or Holy Siege Artillery.',
    role: 'Holy Tank / Artillery',
    mobilityLabel: 'Iron Vanguard',
    portrait: BASTION_PORTRAIT,
    accentColor: '#FBBF24',
    secondaryColor: '#EF4444',
    baseHp: 345,
    baseSpeed: 242,
    jumpForce: 548,
    maxJumps: 1,
    canHover: false,
    hoverGravityScale: 1,
    width: 42,
    height: 52,
    primary: {
      name: 'Censer Mortar',
      keyLabel: 'LMB',
      description: 'Lobs heavy bouncing vessels of holy fire that detonate in consecrated splash AoE.',
      cooldown: 0.56,
      icon: 'mortar',
    },
    skill1: {
      name: 'Sanctified Clamp',
      keyLabel: 'Q / RMB',
      description: 'Crushes enemies directly ahead with blessed iron jaws, healing himself on hit.',
      cooldown: 7.5,
      icon: 'bite',
    },
    skill2: {
      name: 'Divine Reckoning',
      keyLabel: 'E / SHIFT',
      description: 'Channels blazing faith for 2.75s with heavy armor, then erupts in a massive holy shockwave.',
      cooldown: 12.5,
      icon: 'meltdown',
    },
    upgrades: [
      {
        id: 'bs_p1',
        row: 'primary',
        aspect: 'sacred',
        archetype: 'Holy Artillery',
        name: 'Cathedral Barrage',
        cost: 140,
        maxRank: 2,
        summary: 'Increases consecrated mortar impact and splash.',
        perRankText: '+7 dmg · +16 splash',
        capstoneText: 'Lobs 2 bouncing Censer Mortars in a staggered holy arc.',
        icon: 'damage',
      },
      {
        id: 'bs_p2',
        row: 'primary',
        aspect: 'sacred',
        archetype: 'Holy Artillery',
        name: 'Siege Bombard',
        cost: 145,
        maxRank: 2,
        summary: 'Lobs censer mortars rapidly down lanes.',
        perRankText: '+18% fire rate',
        capstoneText: 'Mortars bounce twice & deal +30% bonus damage to Towers and Cores.',
        icon: 'speed',
      },
      {
        id: 'bs_p3',
        row: 'primary',
        aspect: 'sacred',
        archetype: 'Sanctuary Tank',
        name: 'Consecrated Balm',
        cost: 150,
        maxRank: 2,
        summary: 'Mortar fire coats the ground in slowing holy oil.',
        perRankText: '+0.8s slow',
        capstoneText: 'Mortar splashes heal nearby allied champions for +16 HP.',
        icon: 'heal',
      },
      {
        id: 'bs_q1',
        row: 'skill1',
        aspect: 'sacred',
        archetype: 'Raid Boss',
        name: 'Martyr’s Vow',
        cost: 160,
        maxRank: 2,
        summary: 'Killing creeps or heroes with Clamp permanently raises Max HP.',
        perRankText: '+16 perm Max HP/kill',
        capstoneText: 'Clamp kills grant +25 Relic & double HP stacks (+32) on hero kills.',
        icon: 'special',
      },
      {
        id: 'bs_q2',
        row: 'skill1',
        aspect: 'sacred',
        archetype: 'Raid Boss',
        name: 'Blessed Banquet',
        cost: 145,
        maxRank: 2,
        summary: 'Boosts Clamp crushing damage and self-heal.',
        perRankText: '+22 dmg · +28 heal',
        capstoneText: 'Clamping an enemy hero stuns them for 0.65s & grants +55 Shield.',
        icon: 'heal',
      },
      {
        id: 'bs_q3',
        row: 'skill1',
        aspect: 'sacred',
        archetype: 'Control',
        name: 'Inquisitorial Grip',
        cost: 140,
        maxRank: 2,
        summary: 'Cuts Clamp cooldown for constant frontline sustain.',
        perRankText: '-1.3s Clamp CD',
        capstoneText: 'Expands Sanctified Clamp reach by +45px in a wide frontal sweep.',
        icon: 'cooldown',
      },
      {
        id: 'bs_e1',
        row: 'skill2',
        aspect: 'sacred',
        archetype: 'Holy Artillery',
        name: 'Judgment Day',
        cost: 165,
        maxRank: 2,
        summary: 'Massively amplifies Divine Reckoning explosion.',
        perRankText: '+40 dmg · +32 radius',
        capstoneText: 'Detonation also heals every nearby ally for +70 HP.',
        icon: 'burst',
      },
      {
        id: 'bs_e2',
        row: 'skill2',
        aspect: 'sacred',
        archetype: 'Raid Boss',
        name: 'Unbreakable Faith',
        cost: 150,
        maxRank: 2,
        summary: 'Near-impenetrable armor while channeling Reckoning.',
        perRankText: '+16% channel armor',
        capstoneText: 'Grants +120 Sanctuary Shield immediately upon channeling.',
        icon: 'shield',
      },
      {
        id: 'bs_e3',
        row: 'skill2',
        aspect: 'sacred',
        archetype: 'Dive Tank',
        name: 'Crusader Surge',
        cost: 145,
        maxRank: 2,
        summary: 'Surge forward rapidly while glowing with wrath.',
        perRankText: '+22% channel speed',
        capstoneText: 'Cuts Divine Reckoning fuse time by 0.65s for surprise dives.',
        icon: 'speed',
      },
      {
        id: 'bs_u1',
        row: 'utility',
        aspect: 'sacred',
        archetype: 'Raid Boss',
        name: 'Reliquary Colossus',
        cost: 135,
        maxRank: 2,
        summary: 'Massive base health fortification.',
        perRankText: '+65 Max HP',
        capstoneText: 'Permanently grants +12% flat Sacred Armor against all damage.',
        icon: 'shield',
      },
      {
        id: 'bs_u2',
        row: 'utility',
        aspect: 'sacred',
        archetype: 'Dive Tank',
        name: 'Pilgrim’s Leap',
        cost: 130,
        maxRank: 2,
        summary: 'Improved lane rotation and vertical reach.',
        perRankText: '+10% speed & jump',
        capstoneText: 'Unlocks a 2nd Heavy Leap (Double Jump) for high-rafter dives.',
        icon: 'speed',
      },
      {
        id: 'bs_u3',
        row: 'utility',
        aspect: 'sacred',
        archetype: 'Raid Boss',
        name: 'Vigilant Prayer',
        cost: 120,
        maxRank: 2,
        summary: 'Continuous holy regeneration and Relic tithe.',
        perRankText: '+4.5 HP/s · +3 Relic/s',
        capstoneText: 'Out-of-combat health regeneration triples (+15 HP/s after 4s unhit).',
        icon: 'heal',
      },
    ],
  },
  {
    id: 'vexia',
    name: 'Sister Vexia',
    codename: 'XENO-INQUISITOR',
    faction: 'Sacred Order',
    purity: 'hybrid',
    disciplineLabel: 'Hybrid · Sacred × Cyber',
    craftSummary: 'Witch-hunter who turned salvaged alien rail-crossbows into either Precision Marksman DPS or Demolition Siege.',
    role: 'Marksman / Siege',
    mobilityLabel: 'Double Jump',
    portrait: VEXIA_PORTRAIT,
    accentColor: '#F43F5E',
    secondaryColor: '#38BDF8',
    baseHp: 250,
    baseSpeed: 278,
    jumpForce: 560,
    maxJumps: 2,
    canHover: false,
    hoverGravityScale: 1,
    width: 32,
    height: 46,
    primary: {
      name: 'Rail-Crossbow',
      keyLabel: 'LMB',
      description: 'Crisp high-velocity consecrated rail bolts built for sustained DPS and tower siege.',
      cooldown: 0.22,
      icon: 'gun',
    },
    skill1: {
      name: 'Brimstone Cluster',
      keyLabel: 'Q / RMB',
      description: 'Hurls bouncing consecrated incendiary charges that detonate in fiery AoE.',
      cooldown: 6.8,
      icon: 'dynamite',
    },
    skill2: {
      name: 'Holo-Seraph Ram',
      keyLabel: 'E / SHIFT',
      description: 'Deploys an armored holographic charger that bulldozes enemies down the lane.',
      cooldown: 11.0,
      icon: 'bull',
    },
    upgrades: [
      {
        id: 'vx_p1',
        row: 'primary',
        aspect: 'cyber',
        archetype: 'Marksman',
        name: 'Tungsten Piercers',
        cost: 135,
        maxRank: 2,
        summary: 'Hardened alien bolts punch deeper through armor.',
        perRankText: '+4 bolt dmg',
        capstoneText: 'Rail-Crossbow bolts pierce straight through creep waves and heroes.',
        icon: 'damage',
      },
      {
        id: 'vx_p2',
        row: 'primary',
        aspect: 'cyber',
        archetype: 'Marksman',
        name: 'Overclocked Rail',
        cost: 145,
        maxRank: 2,
        summary: 'Boosts rail-crossbow cyclic rate.',
        perRankText: '+18% fire rate',
        capstoneText: 'Every 3rd bolt deals +22 shock damage and slows targets for 0.65s.',
        icon: 'speed',
      },
      {
        id: 'vx_p3',
        row: 'primary',
        aspect: 'sacred',
        archetype: 'Demolition Siege',
        name: 'Inquisition Rockets',
        cost: 155,
        maxRank: 2,
        summary: 'Extends crossbow rail reach for safe siege.',
        perRankText: '+55 range',
        capstoneText: 'Every 4th shot launches a homing Sacred Micro-Missile (34 AoE dmg).',
        icon: 'special',
      },
      {
        id: 'vx_q1',
        row: 'skill1',
        aspect: 'sacred',
        archetype: 'Demolition Siege',
        name: 'Tri-Brimstone Fan',
        cost: 155,
        maxRank: 2,
        summary: 'Packs heavier explosive charges into each canister.',
        perRankText: '+12 bomb dmg',
        capstoneText: 'Throws 3 Brimstone Cluster charges in a wide carpet-bombing fan.',
        icon: 'special',
      },
      {
        id: 'vx_q2',
        row: 'skill1',
        aspect: 'sacred',
        archetype: 'Demolition Siege',
        name: 'Sanctified Napalm',
        cost: 145,
        maxRank: 2,
        summary: 'Bigger blast radius and searing fire damage.',
        perRankText: '+12 dmg · +22 radius',
        capstoneText: 'Brimstone blasts stun enemies for 0.45s and scorch Towers for +25%.',
        icon: 'burst',
      },
      {
        id: 'vx_q3',
        row: 'skill1',
        aspect: 'cyber',
        archetype: 'Marksman',
        name: 'Recoil Vault Rig',
        cost: 140,
        maxRank: 2,
        summary: 'Shorter cluster cooldown for constant kiting.',
        perRankText: '-1.1s Cluster CD',
        capstoneText: 'Throwing Brimstone launches Vexia backward in a vault with +45 Shield.',
        icon: 'cooldown',
      },
      {
        id: 'vx_e1',
        row: 'skill2',
        aspect: 'cyber',
        archetype: 'Demolition Siege',
        name: 'Siege Dreadnought Ram',
        cost: 155,
        maxRank: 2,
        summary: 'Holo-Seraph carries heavy shield plating and ram force.',
        perRankText: '+80 HP · +15 ram dmg',
        capstoneText: 'Holo-Seraph lasts +2.5s longer and hammers towers for double siege ticks.',
        icon: 'shield',
      },
      {
        id: 'vx_e2',
        row: 'skill2',
        aspect: 'sacred',
        archetype: 'Demolition Siege',
        name: 'Martyr Detonation',
        cost: 150,
        maxRank: 2,
        summary: 'Amplifies Holo-Seraph knockback shove across lanes.',
        perRankText: '+95 knockback',
        capstoneText: 'Holo-Seraph explodes in a 95 dmg holy stun nova when expired or broken.',
        icon: 'burst',
      },
      {
        id: 'vx_e3',
        row: 'skill2',
        aspect: 'cyber',
        archetype: 'Marksman',
        name: 'Holo Relay Overcharge',
        cost: 140,
        maxRank: 2,
        summary: 'Re-deploys Holo-Seraph far more often.',
        perRankText: '-1.8s Ram CD',
        capstoneText: 'Casting Holo-Seraph grants Vexia +55 Shield & resets Brimstone CD by 2s.',
        icon: 'cooldown',
      },
      {
        id: 'vx_u1',
        row: 'utility',
        aspect: 'cyber',
        archetype: 'Marksman',
        name: 'Graviton Vault Boots',
        cost: 130,
        maxRank: 2,
        summary: 'Crisper strafe speed and double-jump height.',
        perRankText: '+11% speed & jump',
        capstoneText: 'Unlocks a 3rd Tactical Air-Jump for high-rafter crossfire angles.',
        icon: 'speed',
      },
      {
        id: 'vx_u2',
        row: 'utility',
        aspect: 'sacred',
        archetype: 'Marksman',
        name: 'Witch-Hunter’s Ward',
        cost: 130,
        maxRank: 2,
        summary: 'Wards inquisitor cloak against stray fire.',
        perRankText: '+42 Max HP',
        capstoneText: 'Hero kills grant +80 Shield and +30 bonus Relic Essence.',
        icon: 'shield',
      },
      {
        id: 'vx_u3',
        row: 'utility',
        aspect: 'sacred',
        archetype: 'Demolition Siege',
        name: 'Sanctioned Demolition',
        cost: 120,
        maxRank: 2,
        summary: 'Accelerates Relic Essence trickle.',
        perRankText: '+4.5 Relic/sec',
        capstoneText: 'Deals +22% bonus Primary damage to Reliquary Towers & Ancient Cores.',
        icon: 'solar',
      },
    ],
  },
  {
    id: 'xylar',
    name: 'Xylar',
    codename: 'PURE XENO-TECH',
    faction: 'Xeno-Tech Legion',
    purity: 'purist',
    disciplineLabel: 'Purist · Pure Cyber-Alien',
    craftSummary: 'Pure extraterrestrial infiltrator—build into a One-Shot Stealth Assassin or Gravity Vortex Disruptor.',
    role: 'Void Assassin / Control',
    mobilityLabel: 'Double Jump',
    portrait: XYLAR_PORTRAIT,
    accentColor: '#38BDF8',
    secondaryColor: '#818CF8',
    baseHp: 210,
    baseSpeed: 326,
    jumpForce: 575,
    maxJumps: 2,
    canHover: false,
    hoverGravityScale: 1,
    width: 30,
    height: 44,
    primary: {
      name: 'Twin Plasma Daggers',
      keyLabel: 'LMB',
      description: 'Hyper-fast hard-light alien daggers that shred targets up close.',
      cooldown: 0.14,
      icon: 'burst',
    },
    skill1: {
      name: 'Gravity Singularity',
      keyLabel: 'Q / RMB',
      description: 'Launches an alien sphere that deploys a 2.6s black-hole vortex pulling enemies inward and crushing them.',
      cooldown: 8.2,
      icon: 'vortex',
    },
    skill2: {
      name: 'Phase-Shift Cloak',
      keyLabel: 'E / SHIFT',
      description: 'Bends light to vanish for 3.6s with +32% speed; your next strike erupts in devastating bonus crit damage.',
      cooldown: 9.5,
      icon: 'cloak',
    },
    upgrades: [
      {
        id: 'xy_p1',
        row: 'primary',
        aspect: 'cyber',
        archetype: 'Stealth Assassin',
        name: 'Twin Hard-Light Edges',
        cost: 135,
        maxRank: 2,
        summary: 'Raises plasma dagger damage.',
        perRankText: '+3.5 dagger dmg',
        capstoneText: 'Throws 2 converging plasma daggers on every attack.',
        icon: 'damage',
      },
      {
        id: 'xy_p2',
        row: 'primary',
        aspect: 'cyber',
        archetype: 'Stealth Assassin',
        name: 'Neural Overdrive',
        cost: 145,
        maxRank: 2,
        summary: 'Pushes dagger throw speed to blur levels.',
        perRankText: '+18% attack speed',
        capstoneText: 'Plasma daggers pierce straight through enemy lines.',
        icon: 'speed',
      },
      {
        id: 'xy_p3',
        row: 'primary',
        aspect: 'cyber',
        archetype: 'Gravity Control',
        name: 'Nano-Siphon Blades',
        cost: 150,
        maxRank: 2,
        summary: 'Recovers bio-mass from plasma strikes.',
        perRankText: '+14% lifesteal',
        capstoneText: 'Each dagger hit trims Gravity Singularity cooldown by 0.15s.',
        icon: 'heal',
      },
      {
        id: 'xy_q1',
        row: 'skill1',
        aspect: 'cyber',
        archetype: 'Gravity Control',
        name: 'Event Horizon Collapse',
        cost: 155,
        maxRank: 2,
        summary: 'Expands gravity well pull radius and crush damage.',
        perRankText: '+10 tick dmg · +28 radius',
        capstoneText: 'When Singularity expires, it implodes for 70 burst dmg & 0.6s stun.',
        icon: 'burst',
      },
      {
        id: 'xy_q2',
        row: 'skill1',
        aspect: 'cyber',
        archetype: 'Gravity Control',
        name: 'Chrono-Stasis Well',
        cost: 150,
        maxRank: 2,
        summary: 'Singularity lasts longer and locks foes inside.',
        perRankText: '+0.8s dur · heavy slow',
        capstoneText: 'Vortex gravitational pull strength increases by +60%.',
        icon: 'range',
      },
      {
        id: 'xy_q3',
        row: 'skill1',
        aspect: 'cyber',
        archetype: 'Gravity Control',
        name: 'Zero-Point Core',
        cost: 145,
        maxRank: 2,
        summary: 'Recharges Singularity rapidly.',
        perRankText: '-1.3s Vortex CD',
        capstoneText: 'Launching Singularity immediately wraps Xylar in +55 Xeno Shield.',
        icon: 'cooldown',
      },
      {
        id: 'xy_e1',
        row: 'skill2',
        aspect: 'cyber',
        archetype: 'Stealth Assassin',
        name: 'Quantum Backstab',
        cost: 165,
        maxRank: 2,
        summary: 'Massively amplifies Phase Cloak ambush burst.',
        perRankText: '+34 ambush crit dmg',
        capstoneText: 'Phase Strike stuns the victim for 0.75s in a golden plasma blast.',
        icon: 'burst',
      },
      {
        id: 'xy_e2',
        row: 'skill2',
        aspect: 'cyber',
        archetype: 'Stealth Assassin',
        name: 'Phase Regeneration',
        cost: 150,
        maxRank: 2,
        summary: 'Longer stealth duration and protective shimmer shield.',
        perRankText: '+1.0s cloak · +45 shield',
        capstoneText: 'While cloaked, Xylar rapidly regenerates +22 HP per second.',
        icon: 'shield',
      },
      {
        id: 'xy_e3',
        row: 'skill2',
        aspect: 'cyber',
        archetype: 'Stealth Assassin',
        name: 'Ghost Protocol Reset',
        cost: 150,
        maxRank: 2,
        summary: 'Re-cloak quickly between assassinations.',
        perRankText: '-1.5s Cloak CD',
        capstoneText: 'Scoring an enemy hero kill instantly resets Phase-Shift Cloak.',
        icon: 'cooldown',
      },
      {
        id: 'xy_u1',
        row: 'utility',
        aspect: 'cyber',
        archetype: 'Mobility',
        name: 'Hyper-Tendons',
        cost: 135,
        maxRank: 2,
        summary: 'Peak sprint and vertical leap agility.',
        perRankText: '+12% speed & jump',
        capstoneText: 'Unlocks a 3rd Alien Mid-Air Leap for relentless escapes and chases.',
        icon: 'speed',
      },
      {
        id: 'xy_u2',
        row: 'utility',
        aspect: 'cyber',
        archetype: 'Gravity Control',
        name: 'Chitin Weave',
        cost: 130,
        maxRank: 2,
        summary: 'Reinforces alien exoskeleton.',
        perRankText: '+40 Max HP',
        capstoneText: 'Permanently grants +10% flat Xeno Armor against all damage.',
        icon: 'shield',
      },
      {
        id: 'xy_u3',
        row: 'utility',
        aspect: 'cyber',
        archetype: 'Stealth Assassin',
        name: 'Xeno Trophy Siphon',
        cost: 120,
        maxRank: 2,
        summary: 'Passive Relic energy siphoning.',
        perRankText: '+4 Relic/sec',
        capstoneText: 'Every enemy champion kill awards +45 bonus Relic Essence.',
        icon: 'solar',
      },
    ],
  },
  {
    id: 'caldris',
    name: 'Arch-Lich Caldris',
    codename: 'CYBER-NECROMANCER',
    faction: 'Xeno-Tech Legion',
    purity: 'hybrid',
    disciplineLabel: 'Hybrid · Primordial × Cyber',
    craftSummary: 'Undying sorcerer—build into Sky-Beam Orbital Artillery or an Undead Bone-Borg Legion Commander.',
    role: 'Artillery / Summoner',
    mobilityLabel: 'Grave Float',
    portrait: CALDRIS_PORTRAIT,
    accentColor: '#2DD4BF',
    secondaryColor: '#C084FC',
    baseHp: 235,
    baseSpeed: 256,
    jumpForce: 555,
    maxJumps: 1,
    canHover: true,
    hoverGravityScale: 0.22,
    width: 34,
    height: 50,
    primary: {
      name: 'Soul-Rail Orb',
      keyLabel: 'LMB',
      description: 'Launches piercing necro-plasma spheres that carve straight through enemy waves and heroes.',
      cooldown: 0.42,
      icon: 'orbital',
    },
    skill1: {
      name: 'Orbital Smite',
      keyLabel: 'Q / RMB',
      description: 'Targets your cursor for a 0.85s uplink, then drops a devastating sky-laser pillar that stuns and scorches.',
      cooldown: 8.5,
      icon: 'orbital',
    },
    skill2: {
      name: 'Bone-Borg Guard',
      keyLabel: 'E / SHIFT',
      description: 'Raises 2 armored cyber-undead troopers at your position to push lanes while granting a necro-shield.',
      cooldown: 13.0,
      icon: 'undead',
    },
    upgrades: [
      {
        id: 'cd_p1',
        row: 'primary',
        aspect: 'primordial',
        archetype: 'Orbital Artillery',
        name: 'Wailing Nova Core',
        cost: 140,
        maxRank: 2,
        summary: 'Infuses Soul-Rail Orbs with heavier spectral decay.',
        perRankText: '+6 orb dmg',
        capstoneText: 'Soul-Rail Orbs explode at max range in a 75px spectral detonation.',
        icon: 'damage',
      },
      {
        id: 'cd_p2',
        row: 'primary',
        aspect: 'cyber',
        archetype: 'Undead Commander',
        name: 'Necro-Mend Capacitor',
        cost: 145,
        maxRank: 2,
        summary: 'Fires Soul-Rail Orbs faster and farther down lanes.',
        perRankText: '+18% fire rate · +80 range',
        capstoneText: 'Orbs repair allied Bone-Borgs & creeps they pass through (+26 HP).',
        icon: 'heal',
      },
      {
        id: 'cd_p3',
        row: 'primary',
        aspect: 'primordial',
        archetype: 'Control',
        name: 'Death’s Chill',
        cost: 150,
        maxRank: 2,
        summary: 'Piercing orbs chill and slow enemies struck.',
        perRankText: '+0.85s slow',
        capstoneText: 'Soul-Rail Orbs siphon 18% lifesteal from every target pierced.',
        icon: 'special',
      },
      {
        id: 'cd_q1',
        row: 'skill1',
        aspect: 'cyber',
        archetype: 'Orbital Artillery',
        name: 'Warship Double-Salvo',
        cost: 165,
        maxRank: 2,
        summary: 'Boosts Orbital Smite beam width and obliteration damage.',
        perRankText: '+30 dmg · +24 radius',
        capstoneText: 'Calls a 2nd Orbital Aftershock beam 0.65s later for 65% damage.',
        icon: 'burst',
      },
      {
        id: 'cd_q2',
        row: 'skill1',
        aspect: 'primordial',
        archetype: 'Undead Commander',
        name: 'Crater Resurrection',
        cost: 155,
        maxRank: 2,
        summary: 'Orbital Smite stuns survivors longer and drains essence.',
        perRankText: '+0.35s stun · +15% drain',
        capstoneText: 'Orbital Smite raises a Bone-Borg directly at the scorched blast site.',
        icon: 'special',
      },
      {
        id: 'cd_q3',
        row: 'skill1',
        aspect: 'cyber',
        archetype: 'Orbital Artillery',
        name: 'Fast-Lock Uplink',
        cost: 145,
        maxRank: 2,
        summary: 'Calls orbital pillars far more often.',
        perRankText: '-1.4s Orbital CD',
        capstoneText: 'Cuts Orbital Smite lock-on delay from 0.85s down to 0.52s.',
        icon: 'cooldown',
      },
      {
        id: 'cd_e1',
        row: 'skill2',
        aspect: 'cyber',
        archetype: 'Undead Commander',
        name: 'Chrome Ossuary',
        cost: 155,
        maxRank: 2,
        summary: 'Summoned Bone-Borgs gain heavy armor and firepower.',
        perRankText: '+70 Borg HP · +6 dmg',
        capstoneText: 'Bone-Borgs spawn as Elite Tier V Siege Units with reinforced plating.',
        icon: 'shield',
      },
      {
        id: 'cd_e2',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Undead Commander',
        name: 'Phylactery Fortress',
        cost: 145,
        maxRank: 2,
        summary: 'Casting Bone-Borg Guard wraps Caldris in a thick barrier.',
        perRankText: '+50 shield',
        capstoneText: 'Casting Bone-Borg Guard also restores +55 HP to Caldris.',
        icon: 'heal',
      },
      {
        id: 'cd_e3',
        row: 'skill2',
        aspect: 'primordial',
        archetype: 'Undead Commander',
        name: 'Legion of Chrome',
        cost: 160,
        maxRank: 2,
        summary: 'Summons undead waves more frequently.',
        perRankText: '-1.6s Guard CD · +1 Borg at R1',
        capstoneText: 'Raises 4 Bone-Borgs per cast to overwhelm towers.',
        icon: 'special',
      },
      {
        id: 'cd_u1',
        row: 'utility',
        aspect: 'primordial',
        archetype: 'Undead Commander',
        name: 'Undying Phylactery',
        cost: 130,
        maxRank: 2,
        summary: 'Hardens phylactery and passive regeneration.',
        perRankText: '+45 Max HP · +3 HP/s',
        capstoneText: 'Grants +12% flat Necro Armor whenever an allied Bone-Borg is alive.',
        icon: 'shield',
      },
      {
        id: 'cd_u2',
        row: 'utility',
        aspect: 'cyber',
        archetype: 'Orbital Artillery',
        name: 'Anti-Grav Dominion',
        cost: 125,
        maxRank: 2,
        summary: 'Glides swiftly across high cathedral rafters.',
        perRankText: '+11% speed & jump',
        capstoneText: 'Infinite Grave Float — hover indefinitely above teamfights.',
        icon: 'speed',
      },
      {
        id: 'cd_u3',
        row: 'utility',
        aspect: 'cyber',
        archetype: 'Orbital Artillery',
        name: 'Necro-Telemetry',
        cost: 120,
        maxRank: 2,
        summary: 'Extracts steady Relic Essence from the battlefield.',
        perRankText: '+4.5 Relic/sec',
        capstoneText: 'Enemy creep kills trim Orbital Smite cooldown by 0.45s.',
        icon: 'solar',
      },
    ],
  },
];

export const HERO_MAP: Record<HeroId, HeroDefinition> = HERO_LIST.reduce(
  (acc, hero) => {
    acc[hero.id] = hero;
    return acc;
  },
  {} as Record<HeroId, HeroDefinition>
);

export function computeHeroStats(
  heroId: HeroId,
  ranks: Record<string, number>,
  bonusMaxHp = 0
): ComputedHeroStats {
  const def = HERO_MAP[heroId];
  const r = (id: string) => ranks[id] ?? 0;

  // Compute maxed capstones map cleanly from hero definition
  const capstones: Record<string, boolean> = {};
  for (const node of def.upgrades) {
    capstones[node.id] = (ranks[node.id] ?? 0) >= node.maxRank;
  }

  const stats: ComputedHeroStats = {
    maxHp: def.baseHp + bonusMaxHp,
    moveSpeed: def.baseSpeed,
    jumpForce: def.jumpForce,
    primaryDamage: 14,
    primaryCooldown: def.primary.cooldown,
    primaryRange: 420,
    primaryProjectileSpeed: 740,
    primarySplash: 0,
    primaryPierce: false,
    primaryBonusRocket: false,
    primaryHeal: 0,
    primaryHealSolar: 0,
    skill1Damage: 48,
    skill1Cooldown: def.skill1.cooldown,
    skill1Radius: 84,
    skill1Range: 460,
    skill1ExtraCount: 0,
    skill1Stun: 0,
    skill1Slow: 0,
    skill1Heal: 0,
    skill1ShieldAfter: 0,
    skill1Duration: 0,
    skill1DashSpeed: 840,
    skill1PermanentHpGain: 0,
    skill2Damage: 30,
    skill2Cooldown: def.skill2.cooldown,
    skill2Radius: 110,
    skill2Duration: 3.0,
    skill2Armor: 0,
    skill2SelfDamageRatio: 0,
    skill2SpeedMult: 1,
    skill2ExplodeOnEnd: false,
    skill2SummonHp: 170,
    skill2Knockback: 380,
    skill2HealAlly: 0,
    passiveSolarPerSec: 3.2,
    hpRegenPerSec: 1.6,
    lifestealRatio: 0,
    extraJumps: 0,
    infiniteHover: false,
    flatArmor: 0,
    towerDamageMult: 1,
    capstones,
  };

  if (heroId === 'marrow') {
    stats.primaryDamage = 26 + r('mh_p1') * 7;
    stats.primaryCooldown = def.primary.cooldown / (1 + r('mh_p3') * 0.18);
    stats.primaryRange = 148;
    stats.primaryProjectileSpeed = 620;
    stats.primaryPierce = true;
    stats.lifestealRatio = 0.08 + r('mh_p2') * 0.14;

    stats.skill1Damage = 68 + r('mh_q2') * 24;
    stats.skill1Range = 680 + r('mh_q1') * 120;
    stats.skill1Stun = 0.72 + r('mh_q2') * 0.25;
    stats.skill1Cooldown = Math.max(3.6, def.skill1.cooldown - r('mh_q3') * 1.2);

    stats.skill2Damage = 24 + r('mh_e1') * 8;
    stats.skill2Radius = 118 + r('mh_e1') * 24;
    stats.skill2Duration = 4.2 + r('mh_e2') * 1.0;
    stats.skill2Armor = 0.26 + r('mh_e2') * 0.14;
    stats.skill2SpeedMult = capstones['mh_e2'] ? 1.26 : 1;
    stats.skill2ExplodeOnEnd = Boolean(capstones['mh_e3']);
    stats.skill2Cooldown = Math.max(5.5, def.skill2.cooldown - r('mh_e3') * 1.4);

    stats.maxHp += r('mh_u1') * 55;
    stats.moveSpeed *= 1 + r('mh_u2') * 0.11;
    stats.jumpForce *= 1 + r('mh_u2') * 0.08;
    stats.extraJumps = capstones['mh_u2'] ? 1 : 0;
    stats.passiveSolarPerSec += r('mh_u3') * 3.5;
    stats.hpRegenPerSec += r('mh_u3') * 3.0;
  } else if (heroId === 'seraph') {
    stats.primaryDamage = 15 + r('sr_p1') * 4;
    stats.primaryCooldown = def.primary.cooldown / (1 + r('sr_p2') * 0.14);
    stats.primaryHeal = capstones['sr_p2'] ? 24 : r('sr_p2') * 10;
    stats.primaryRange = 450 + r('sr_p3') * 65;
    stats.primaryProjectileSpeed = 840 + r('sr_p3') * 80;
    stats.primaryPierce = Boolean(capstones['sr_p3']);

    stats.skill1Damage = 62 + r('sr_q1') * 20;
    stats.skill1Radius = 78 + r('sr_q3') * 22;
    stats.skill1ExtraCount = capstones['sr_q1'] ? 1 : 0;
    stats.skill1Stun = 0.35 + r('sr_q3') * 0.2 + (capstones['sr_q3'] ? 0.45 : 0);
    stats.skill1Cooldown = Math.max(3.5, def.skill1.cooldown - r('sr_q2') * 1.0);
    stats.skill1Heal = capstones['sr_q2'] ? 65 : 0;

    stats.skill2Damage = 48 + r('sr_e2') * 26 + (capstones['sr_e2'] ? 75 : 0);
    stats.skill2Radius = 148 + r('sr_e2') * 26;
    stats.skill2SummonHp = 88 + r('sr_e1') * 38;
    stats.skill2HealAlly = 44 + r('sr_e1') * 28;
    stats.skill2Knockback = 430 + r('sr_e2') * 50;
    stats.skill2Cooldown = Math.max(5.2, def.skill2.cooldown - r('sr_e3') * 1.5);

    stats.moveSpeed *= 1 + r('sr_u1') * 0.1;
    stats.jumpForce *= 1 + r('sr_u1') * 0.08;
    stats.infiniteHover = Boolean(capstones['sr_u1']);
    stats.maxHp += r('sr_u2') * 42;
    stats.hpRegenPerSec += r('sr_u2') * 3.0;
    stats.passiveSolarPerSec += r('sr_u3') * 4.0;
  } else if (heroId === 'korak') {
    stats.primaryDamage = 13 + r('kr_p2') * 6;
    stats.primaryHeal = 15 + r('kr_p1') * 7;
    stats.primaryHealSolar = r('kr_p3') * 4;
    stats.primaryCooldown = def.primary.cooldown;
    stats.primaryRange = 410 + (capstones['kr_p2'] ? 100 : 0);
    stats.primaryProjectileSpeed = 680;

    stats.skill1Heal = 16 + r('kr_q1') * 7;
    stats.skill1Radius = 158 + r('kr_q1') * 30;
    stats.skill1Damage = r('kr_q2') * 16;
    stats.skill1Slow = 0.7 + r('kr_q2') * 0.6;
    stats.skill1Duration = 7.5 + r('kr_q3') * 2.5;
    stats.skill1Cooldown = Math.max(6.0, def.skill1.cooldown - r('kr_q3') * 1.5);

    stats.skill2Damage = 24 + r('kr_e1') * 12;
    stats.skill2SummonHp = r('kr_e2') * 35;
    stats.skill2Cooldown = Math.max(2.6, def.skill2.cooldown - r('kr_e3') * 0.9);

    stats.maxHp += r('kr_u1') * 42;
    stats.hpRegenPerSec += r('kr_u1') * 3.5;
    stats.moveSpeed *= 1 + r('kr_u2') * 0.11;
    stats.jumpForce *= 1 + r('kr_u2') * 0.08;
    stats.infiniteHover = Boolean(capstones['kr_u2']);
    stats.passiveSolarPerSec += r('kr_u3') * 4.5;
  } else if (heroId === 'vorg') {
    stats.primaryDamage = 11 + r('vg_p1') * 3.5;
    stats.primaryCooldown = def.primary.cooldown / (1 + r('vg_p2') * 0.18);
    stats.primaryRange = 370;
    stats.primaryProjectileSpeed = 790;
    stats.lifestealRatio = r('vg_p3') * 0.14;

    stats.skill1Damage = 48 + r('vg_q1') * 24;
    stats.skill1Stun = 0.42 + r('vg_q2') * 0.26;
    stats.skill1ShieldAfter = r('vg_q2') * 45;
    stats.skill1DashSpeed = 870;
    stats.skill1Cooldown = Math.max(2.8, def.skill1.cooldown - r('vg_q3') * 1.1);

    stats.skill2Damage = 26 + r('vg_e1') * 10;
    stats.skill2Radius = 88 + r('vg_e1') * 22;
    stats.skill2Duration = 2.3 + r('vg_e2') * 0.5;
    stats.skill2SpeedMult = 1.16 + r('vg_e2') * 0.18;
    stats.skill2Armor = 0.14 + r('vg_e3') * 0.18;

    stats.moveSpeed *= 1 + r('vg_u1') * 0.11;
    stats.jumpForce *= 1 + r('vg_u1') * 0.08;
    stats.extraJumps = capstones['vg_u1'] ? 1 : 0;
    stats.maxHp += r('vg_u2') * 42;
    stats.passiveSolarPerSec += r('vg_u3') * 4.0;
  } else if (heroId === 'bastion') {
    stats.primaryDamage = 24 + r('bs_p1') * 7;
    stats.primarySplash = 58 + r('bs_p1') * 16;
    stats.primaryCooldown = def.primary.cooldown / (1 + r('bs_p2') * 0.18);
    stats.primaryRange = 460;
    stats.primaryProjectileSpeed = 590;
    stats.skill1Slow = r('bs_p3') * 0.8;
    stats.towerDamageMult = capstones['bs_p2'] ? 1.3 : 1;

    stats.skill1Damage = 56 + r('bs_q2') * 22;
    stats.skill1Heal = 44 + r('bs_q2') * 28;
    stats.skill1Radius = 88 + (capstones['bs_q3'] ? 45 : 0);
    stats.skill1PermanentHpGain = r('bs_q1') * 16;
    stats.skill1Cooldown = Math.max(4.0, def.skill1.cooldown - r('bs_q3') * 1.3);

    stats.skill2Damage = 96 + r('bs_e1') * 40;
    stats.skill2Radius = 168 + r('bs_e1') * 32;
    stats.skill2Duration = capstones['bs_e3'] ? 2.1 : 2.75;
    stats.skill2Armor = 0.4 + r('bs_e2') * 0.16;
    stats.skill2SpeedMult = 1.0 + r('bs_e3') * 0.22;

    stats.maxHp += r('bs_u1') * 65;
    stats.flatArmor = capstones['bs_u1'] ? 0.12 : 0;
    stats.moveSpeed *= 1 + r('bs_u2') * 0.1;
    stats.jumpForce *= 1 + r('bs_u2') * 0.08;
    stats.extraJumps = capstones['bs_u2'] ? 1 : 0;
    stats.hpRegenPerSec += r('bs_u3') * 4.5;
    stats.passiveSolarPerSec += r('bs_u3') * 3.0;
  } else if (heroId === 'vexia') {
    stats.primaryDamage = 14 + r('vx_p1') * 4;
    stats.primaryCooldown = def.primary.cooldown / (1 + r('vx_p2') * 0.18);
    stats.primaryRange = 460 + r('vx_p3') * 55;
    stats.primaryProjectileSpeed = 860;
    stats.primaryPierce = Boolean(capstones['vx_p1']);
    stats.primaryBonusRocket = Boolean(capstones['vx_p3']);
    stats.towerDamageMult = capstones['vx_u3'] ? 1.22 : 1;

    stats.skill1Damage = 46 + r('vx_q1') * 12 + r('vx_q2') * 12;
    stats.skill1Radius = 84 + r('vx_q2') * 22;
    stats.skill1ExtraCount = capstones['vx_q1'] ? 2 : 0;
    stats.skill1Stun = capstones['vx_q2'] ? 0.45 : 0;
    stats.skill1Cooldown = Math.max(3.6, def.skill1.cooldown - r('vx_q3') * 1.1);

    stats.skill2SummonHp = 190 + r('vx_e1') * 80;
    stats.skill2Damage = 36 + r('vx_e1') * 15;
    stats.skill2Knockback = 470 + r('vx_e2') * 95;
    stats.skill2ExplodeOnEnd = Boolean(capstones['vx_e2']);
    stats.skill2Cooldown = Math.max(6.0, def.skill2.cooldown - r('vx_e3') * 1.8);

    stats.moveSpeed *= 1 + r('vx_u1') * 0.11;
    stats.jumpForce *= 1 + r('vx_u1') * 0.08;
    stats.extraJumps = capstones['vx_u1'] ? 1 : 0;
    stats.maxHp += r('vx_u2') * 42;
    stats.passiveSolarPerSec += r('vx_u3') * 4.5;
  } else if (heroId === 'xylar') {
    stats.primaryDamage = 10 + r('xy_p1') * 3.5;
    stats.primaryCooldown = def.primary.cooldown / (1 + r('xy_p2') * 0.18);
    stats.primaryRange = 330;
    stats.primaryProjectileSpeed = 880;
    stats.primaryPierce = Boolean(capstones['xy_p2']);
    stats.lifestealRatio = r('xy_p3') * 0.14;

    stats.skill1Damage = 22 + r('xy_q1') * 10;
    stats.skill1Radius = 145 + r('xy_q1') * 28;
    stats.skill1Duration = 2.6 + r('xy_q2') * 0.8;
    stats.skill1Slow = 0.8 + r('xy_q2') * 0.6;
    stats.skill1Cooldown = Math.max(4.5, def.skill1.cooldown - r('xy_q3') * 1.3);

    stats.skill2Damage = 55 + r('xy_e1') * 34;
    stats.skill2Duration = 3.6 + r('xy_e2') * 1.0;
    stats.skill2SummonHp = r('xy_e2') * 45;
    stats.skill2SpeedMult = 1.32;
    stats.skill2Cooldown = Math.max(5.0, def.skill2.cooldown - r('xy_e3') * 1.5);

    stats.moveSpeed *= 1 + r('xy_u1') * 0.12;
    stats.jumpForce *= 1 + r('xy_u1') * 0.08;
    stats.extraJumps = capstones['xy_u1'] ? 1 : 0;
    stats.maxHp += r('xy_u2') * 40;
    stats.flatArmor = capstones['xy_u2'] ? 0.1 : 0;
    stats.passiveSolarPerSec += r('xy_u3') * 4.0;
  } else if (heroId === 'caldris') {
    stats.primaryDamage = 20 + r('cd_p1') * 6;
    stats.primaryCooldown = def.primary.cooldown / (1 + r('cd_p2') * 0.18);
    stats.primaryRange = 490 + r('cd_p2') * 80;
    stats.primaryProjectileSpeed = 540;
    stats.primaryPierce = true;
    stats.skill1Slow = r('cd_p3') * 0.85;
    stats.lifestealRatio = (capstones['cd_p3'] ? 0.18 : 0) + r('cd_q2') * 0.15;

    stats.skill1Damage = 82 + r('cd_q1') * 30;
    stats.skill1Radius = 115 + r('cd_q1') * 24;
    stats.skill1Stun = 0.65 + r('cd_q2') * 0.35;
    stats.skill1Cooldown = Math.max(4.5, def.skill1.cooldown - r('cd_q3') * 1.4);

    stats.skill2SummonHp = 155 + r('cd_e1') * 70;
    stats.skill2Damage = 13 + r('cd_e1') * 6;
    stats.skill2HealAlly = 85 + r('cd_e2') * 50;
    stats.skill1ExtraCount = r('cd_e3'); // 0 -> 2 borgs, 1 -> 3 borgs, 2 -> 4 borgs!
    stats.skill2Cooldown = Math.max(8.5, def.skill2.cooldown - r('cd_e3') * 1.6);

    stats.maxHp += r('cd_u1') * 45;
    stats.hpRegenPerSec += r('cd_u1') * 3.0;
    stats.moveSpeed *= 1 + r('cd_u2') * 0.11;
    stats.jumpForce *= 1 + r('cd_u2') * 0.08;
    stats.infiniteHover = Boolean(capstones['cd_u2']);
    stats.passiveSolarPerSec += r('cd_u3') * 4.5;
  }

  return stats;
}
