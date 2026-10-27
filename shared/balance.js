/**
 * Every tunable number in the game. Rules live in logic.js; this file is only data,
 * so balancing never means touching code.
 *
 * Shared by client (display) and server (authority): both always agree on costs and
 * multipliers because they read the same table.
 */

// --- Training ---------------------------------------------------------------------

/** Seconds between auto-throws while standing in a lane. */
export const TRAIN_INTERVAL = 0.6
/**
 * Click throws: anywhere in the lobby outside the throw area, each click throws the
 * frisbee from your hand for a x1 training throw. This is the fastest they count, in
 * seconds (about six a second).
 */
export const CLICK_INTERVAL = 0.16
/** Training throws per level. */
export const LEVEL_STEPS = 10
/** Each level adds this fraction to the frisbee's base power: gain x (1 + level x k). */
export const LEVEL_GAIN = 0.15

/**
 * Training lanes, west to east order matches world.js lane indices.
 * `rebirths` = rebirths needed; `product` = the SHOP item that unlocks it instead.
 */
export const LANES = [
  { id: 'target', name: 'Pumpkin Bay', mult: 1, rebirths: 0 },
  { id: 'ring', name: 'Slime Bay', mult: 2, rebirths: 1 },
  { id: 'star', name: 'Cobweb Bay', mult: 3, rebirths: 3 },
  { id: 'diamond', name: 'Skull Bay', mult: 5, rebirths: 6 },
  { id: 'wheel', name: 'Gold Bay', mult: 8, rebirths: 9 },
  { id: 'hex', name: 'Lava Bay', mult: 12, rebirths: 12 },
  { id: 'crystal', name: 'Blood Bay', mult: 18, rebirths: 15 },
  { id: 'rainbow', name: 'Rainbow Bay', mult: 30, product: 'laneVeryOp', tag: 'VERY OP!' },
  { id: 'galaxy', name: 'Galaxy Bay', mult: 100, product: 'laneBestOverall', tag: 'BEST OVERALL!' },
]

// --- Rebirth ----------------------------------------------------------------------

/**
 * Max level by rebirth count: R0 = 2, R1 = 15, R2 = 25, then rising with the square root
 * of the rebirths (R3 37, R10 59, R25 83, R50 108), so each rebirth takes a little
 * longer than the last but they keep coming every 15-25 minutes however long you play.
 */
export function levelCap(rebirths) {
  if (rebirths <= 0) return 2
  if (rebirths === 1) return 15
  return Math.round(25 + 12 * Math.sqrt(rebirths - 2))
}

/** Power multiplier from rebirths: R0 = x1, R1 = x2, R2 = x3 ... */
export const rebirthMultiplier = (rebirths) => rebirths + 1

// --- Golf clubs ---------------------------------------------------------------------

/**
 * The golf clubs you hit with. `power` is base power per training hit; `cost` is in Wins.
 *
 * The table (and the profile's `equippedPlane` / `ownedPlanes`) keep their original
 * plane ids, so saves from before the switch to golf clubs still load.
 */
export const PLANES = [
  { id: 'paper', name: 'Rusty Driver', power: 1, cost: 0 },
  { id: 'sky', name: 'Pumpkin Putter', power: 2, cost: 5 },
  { id: 'newspaper', name: 'Candy Cane Club', power: 5, cost: 12 },
  { id: 'cardboard', name: 'Bat Wing Wedge', power: 11, cost: 29 },
  { id: 'racer', name: 'Spider Iron', power: 21, cost: 69 },
  { id: 'ocean', name: 'Ghost Driver', power: 46, cost: 170 },
  { id: 'jungle', name: 'Slime Iron', power: 98, cost: 400 },
  { id: 'royal', name: 'Witch Broom', power: 210, cost: 960 },
  { id: 'crystal', name: 'Crystal Skull', power: 490, cost: 2300 },
  { id: 'golden', name: 'Golden Scythe', power: 1100, cost: 5500 },
  // The second stage: same curve, each about 2.5x the Wins for 2.2x the power.
  { id: 'candy', name: 'Candy Corn Cannon', power: 2400, cost: 13000 },
  { id: 'ice', name: 'Frozen Fang', power: 5300, cost: 32000 },
  { id: 'lava', name: 'Lava Lantern', power: 11500, cost: 76000 },
  { id: 'thunder', name: 'Thunder Bone', power: 25000, cost: 180000 },
  { id: 'neon', name: 'Neon Reaper', power: 55000, cost: 440000 },
  { id: 'galaxy', name: 'Galaxy Ghoul', power: 120000, cost: 1300000 },
  { id: 'dragon', name: 'Dragon Spine', power: 260000, cost: 3500000 },
  { id: 'rainbow', name: 'Rainbow Wraith', power: 570000, cost: 8500000 },
  { id: 'diamond', name: 'Diamond Fang', power: 1250000, cost: 20000000 },
  { id: 'cosmic', name: 'Cosmic Reaper', power: 2750000, cost: 48000000 },
]

// --- Hitting ----------------------------------------------------------------------

/**
 * How far a hit flies for a given Power: `[power, metres]` anchors, joined smoothly in
 * log(power) - every tenfold gain in Power is a clear jump down the course, big early
 * (the first minute takes you to the second biome), steadier later. Past the last
 * anchor it keeps the last stretch's slope. Each anchor sits just past a biome's start,
 * so the biomes fall at even steps of Power.
 */
export const DISTANCE_CURVE = [
  [0, 55],
  [20, 130],
  [400, 290],
  [5000, 500],
  [1e5, 760],
  [2e7, 1480],
  [1e9, 2460],
  [3e10, 3900],
  [8e11, 5500],
  [1.5e13, 7420],
  [4e14, 9660],
  [3e15, 12860],
]

/** Themed course biomes. `start` in metres; later zones pay more Wins per metre. */
export const ZONES = [
  { id: 'neighbourhood', name: 'Pumpkin Patch', start: 0, winsPerMeter: 0.3 },
  { id: 'city', name: 'Haunted Bog', start: 240, winsPerMeter: 0.5 },
  { id: 'forest', name: 'Candy Corn Madness', start: 720, winsPerMeter: 0.8 },
  { id: 'desert', name: 'Spooky Jungle', start: 1440, winsPerMeter: 1.2 },
  { id: 'snow', name: 'Frozen Crypt', start: 2400, winsPerMeter: 1.8 },
  { id: 'volcano', name: 'Lava Dungeon', start: 3840, winsPerMeter: 2.6 },
  { id: 'cemetery', name: 'Cursed Cemetery', start: 5440, winsPerMeter: 3.4 },
  { id: 'carnival', name: 'Haunted Carnival', start: 7360, winsPerMeter: 4.2 },
  { id: 'castle', name: 'Vampire Castle', start: 9600, winsPerMeter: 5.2 },
  { id: 'space', name: 'Moon Realm', start: 12800, winsPerMeter: 6.5 },
]

// --- Greens and the swing ---------------------------------------------------------

/** Each biome ends in a bullseye green, its hole this many metres before the next gate. */
export const HOLE_BEFORE_GATE = 28
/** Metres of every hole on the course: one per biome but the last. */
export const HOLES = ZONES.slice(1).map((zone) => zone.start - HOLE_BEFORE_GATE)

/**
 * The green's rings, innermost first: landing within `radius` metres of the hole
 * multiplies that hit's Wins by `mult`. The hole itself is a hole in one. The client
 * paints the green from these same radii.
 *
 * Balanced against aiming short: a weaker swing (the meter) lets you drop a ball on a
 * green you'd otherwise fly past, but it only reaches down to SWING_MIN of your full
 * distance, which pays at most about half the Wins, so even a good ring roughly evens
 * out with a full hit - the bonus rewards skill, it isn't a farm.
 */
export const GREEN_RINGS = [
  { radius: 1.8, mult: 5, label: 'HOLE IN ONE!' },
  { radius: 3, mult: 3, label: 'BULLSEYE!' },
  { radius: 4.8, mult: 2.5, label: 'AMAZING!' },
  { radius: 6.8, mult: 2, label: 'GREAT SHOT!' },
  { radius: 11.6, mult: 1.5, label: 'NICE SHOT!' },
  { radius: 17.5, mult: 1.25, label: 'ON THE GREEN!' },
]

/**
 * The swing meter, 0 (bottom) to 1 (top): its PERFECT band hits at full strength;
 * below it the strength falls away steeply to SWING_MIN at the bottom (half way up is
 * about 60%); past it (the grey cap) is an over-swing that loses some. Shots also scatter by up to SHOT_SCATTER either way, so a
 * hole in one stays a thrill rather than a sure thing.
 */
export const SWING_PERFECT = [0.78, 0.92]
export const SWING_MIN = 0.25
export const SWING_OVER = 0.82
export const SHOT_SCATTER = 0.008
/**
 * Candy Corn, the Halloween event's currency (kept in the player's save): every hit
 * earns 1 plus 1 for each zone its ball reached, a hole in one adds HOLE_IN_ONE_CANDY
 * and winning a duel DUEL_WIN_CANDY. Spent at the Candy Shop on pumpkin skins.
 */
export const HOLE_IN_ONE_CANDY = 10
export const DUEL_WIN_CANDY = 5

/**
 * Pumpkin ball skins, sold for Candy Corn. A skin changes only how the ball looks (to
 * everyone); with none equipped the ball takes the look of the equipped club. The
 * look of each is `skin_<id>` in the client's ball styles (client/src/game/frisbee.js).
 */
export const SKINS = [
  { id: 'ghost', name: 'Ghost Pumpkin', cost: 30 },
  { id: 'toxic', name: 'Toxic Slime', cost: 80 },
  { id: 'blood', name: 'Blood Moon', cost: 200 },
  { id: 'witch', name: 'Witch Brew', cost: 500 },
  { id: 'frost', name: 'Frozen Spirit', cost: 1200 },
  { id: 'king', name: 'Pumpkin King', cost: 3000 },
]

/** Trophy pickups along the track: first at 15 m, then every 30 m. */
export const TROPHY_FIRST = 15
export const TROPHY_SPACING = 30
/** A trophy is worth this many metres of its zone's Wins. */
export const TROPHY_METERS = 10

/** Seconds a throw of `distance` metres takes to watch. Logarithmic: long throws stay short. */
export const flightDuration = (distance) => 2.6 + 1.5 * Math.log(1 + distance / 40)
/** Landing + result popup after the flight, before the next throw is allowed. */
export const THROW_RECOVERY = 1.2
/**
 * Seconds between hits off the Hit Zone. Flights can be skipped, so this - not the
 * flight's length - is what paces hitting.
 */
export const HIT_COOLDOWN = 2.2

// --- Pets & eggs ------------------------------------------------------------------

export const RARITIES = {
  common: { name: 'Common', color: '#b9c3cf', order: 0 },
  uncommon: { name: 'Uncommon', color: '#4ade80', order: 1 },
  rare: { name: 'Rare', color: '#38bdf8', order: 2 },
  epic: { name: 'Epic', color: '#b15cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffc41f', order: 4 },
  mythic: { name: 'Mythic', color: '#ff3b6b', order: 5 },
  secret: { name: 'Secret', color: '#ff5bd8', order: 6 },
}

/** `mult` multiplies training power. Equipped pets stack additively (see logic.js). */
export const PETS = {
  cat: { name: 'Cat', rarity: 'common', mult: 1.2 },
  dog: { name: 'Dog', rarity: 'common', mult: 1.3 },
  bunny: { name: 'Bunny', rarity: 'uncommon', mult: 1.5 },
  bear: { name: 'Bear', rarity: 'rare', mult: 2 },
  cow: { name: 'Cow', rarity: 'uncommon', mult: 2.5 },
  parrot: { name: 'Parrot', rarity: 'rare', mult: 3 },
  fox: { name: 'Fox', rarity: 'epic', mult: 4 },
  tiger: { name: 'Tiger', rarity: 'legendary', mult: 6 },
  flamingo: { name: 'Flamingo', rarity: 'uncommon', mult: 8 },
  turtle: { name: 'Turtle', rarity: 'rare', mult: 10 },
  owl: { name: 'Owl', rarity: 'epic', mult: 14 },
  phoenix: { name: 'Phoenix', rarity: 'legendary', mult: 25 },
  pony: { name: 'Pony', rarity: 'rare', mult: 10 },
  unicorn: { name: 'Unicorn', rarity: 'epic', mult: 18 },
  pegasus: { name: 'Pegasus', rarity: 'legendary', mult: 30 },
  imp: { name: 'Imp', rarity: 'rare', mult: 20 },
  bat: { name: 'Bat', rarity: 'epic', mult: 30 },
  demon: { name: 'Demon', rarity: 'legendary', mult: 50 },
  hellhound: { name: 'Hellhound', rarity: 'mythic', mult: 80 },
  dragon: { name: 'Dragon', rarity: 'epic', mult: 6 },
  crab: { name: 'Lucky Crab', rarity: 'uncommon', mult: 1.5 },
  sphinx: { name: 'Sphinx', rarity: 'secret', mult: 150 },
}

/**
 * Eggs, bought with Wins. `pets` are [petId, weight] - weights are percentages and
 * sum to 100.
 */
export const EGGS = {
  basic: { name: 'Common Egg', cost: { wins: 60 }, pets: [['cat', 45], ['dog', 30], ['bunny', 20], ['bear', 5]] },
  meadow: { name: 'Uncommon Egg', cost: { wins: 3000 }, pets: [['cow', 45], ['parrot', 30], ['fox', 20], ['tiger', 5]] },
  sunset: { name: 'Rare Egg', cost: { wins: 12000 }, pets: [['flamingo', 45], ['turtle', 30], ['owl', 20], ['phoenix', 5]] },
  unicorn: { name: 'Epic Egg', cost: { wins: 60000 }, pets: [['pony', 50], ['unicorn', 35], ['pegasus', 15]] },
  demon: { name: 'Haunted Egg', cost: { wins: 300000 }, pets: [['imp', 50], ['bat', 30], ['demon', 15], ['hellhound', 5]] },
}

export const MAX_EQUIPPED_PETS = 3
export const MAX_PET_INVENTORY = 60
/** Multi-hatch opens this many at once, for that many times the cost. */
export const MULTI_HATCH = 3

// --- Items, boosts, rewards -------------------------------------------------------

export const POTION_DURATION_MS = 5 * 60 * 1000

export const ITEMS = {
  potionPower: { name: 'x2 Power Potion', kind: 'potion', boost: 'power', durationMs: POTION_DURATION_MS },
  potionWins: { name: 'x2 Wins Potion', kind: 'potion', boost: 'wins', durationMs: POTION_DURATION_MS },
  eggMeadow: { name: 'Uncommon Egg', kind: 'egg', egg: 'meadow' },
  eggSunset: { name: 'Rare Egg', kind: 'egg', egg: 'sunset' },
  eggUnicorn: { name: 'Epic Egg', kind: 'egg', egg: 'unicorn' },
  eggDemon: { name: 'Haunted Egg', kind: 'egg', egg: 'demon' },
}


/** 7-day cycle; day N unlocks N x 24h after the cycle started. */
export const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000
export const DAILY_REWARDS = [
  { label: 'x2 Wins', icon: 'potionWins', sub: '5m', grant: { item: 'potionWins' } },
  { label: 'Dragon', icon: 'pet:dragon', sub: 'x1', grant: { pet: 'dragon' } },
  { label: 'x2 Power', icon: 'potionPower', sub: '5m', grant: { item: 'potionPower' } },
  { label: 'Epic Egg', icon: 'egg:unicorn', sub: 'x1', grant: { item: 'eggUnicorn' } },
  { label: 'x2 Power', icon: 'potionPower', sub: '5m', grant: { item: 'potionPower' } },
  { label: 'x2 Wins', icon: 'potionWins', sub: '5m', grant: { item: 'potionWins' } },
  { label: 'Haunted Egg', icon: 'egg:demon', sub: 'x1', grant: { item: 'eggDemon' } },
]

/** Claimable once each per session, after this many minutes played. */
export const PLAYTIME_REWARDS = [
  { minutes: 5, label: '+250 Wins', icon: 'trophy', grant: { wins: 250 } },
  { minutes: 10, label: 'x2 Power', icon: 'potionPower', grant: { item: 'potionPower' } },
  { minutes: 15, label: 'Uncommon Egg', icon: 'egg:meadow', grant: { item: 'eggMeadow' } },
  { minutes: 30, label: 'x2 Wins', icon: 'potionWins', grant: { item: 'potionWins' } },
  { minutes: 45, label: 'Rare Egg', icon: 'egg:sunset', grant: { item: 'eggSunset' } },
  { minutes: 60, label: 'Epic Egg', icon: 'egg:unicorn', grant: { item: 'eggUnicorn' } },
]

/** The stand by spawn: a pet the first time, a potion on later sessions. */
export const FREE_REWARD = { firstTime: { pet: 'crab' }, repeat: { item: 'potionPower' } }

/** Offline training: a quarter of your lane's rate, for up to 8 hours away. */
export const OFFLINE_RATE = 0.25
export const OFFLINE_MAX_MS = 8 * 60 * 60 * 1000
export const OFFLINE_MIN_MS = 60 * 1000

/** Power needed to step through the World 2 portal. */
export const WORLD2_POWER = 2.5e6

// --- Premium ----------------------------------------------------------------------

/**
 * The shop. Wins are the game's only currency: everything here, like clubs and
 * eggs, is bought with them. `pass` = permanent unlock; `consumable` = grants every
 * time. Power packs are priced at a few throws' Wins for a player at that power, so
 * they speed you up without replacing the training loop.
 */
export const SHOP = {
  power100k: { name: '+100K Power', price: 4000, kind: 'consumable', grant: { power: 1e5 } },
  power1m: { name: '+1M Power', price: 25000, kind: 'consumable', grant: { power: 1e6 } },
  power10m: { name: '+10M Power', price: 150000, kind: 'consumable', grant: { power: 1e7 } },
  laneVeryOp: { name: 'VERY OP! Lane', price: 150000, kind: 'pass' },
  laneBestOverall: { name: 'BEST OVERALL! Lane', price: 2000000, kind: 'pass' },
  sphinx: { name: 'Sphinx', price: 2500000, kind: 'consumable', grant: { pet: 'sphinx' }, stock: 1000 },
}

/** Sphinx stock shown before the server reports the live count. */
export const SPHINX_STOCK_DEFAULT = 954

// --- Tutorial & badges ------------------------------------------------------------

/**
 * A new player's guide, one step at a time; each completes when its event fires and the
 * last ends it (the banner, the ground arrows and the HIT! arrow all go): hit the ball,
 * train in the free bay, rebirth, then spend Wins on a new golf club. The banner words
 * the steps itself where they depend on the player (see TopCenter.jsx).
 */
export const TUTORIAL = [
  { text: 'Go to the Hit Zone and hit the ball', event: 'throw', target: 'throw' },
  { text: 'Train in the FREE Training Bay', event: 'train', target: 'lane0' },
  { text: 'Fill the level bar, then Rebirth', event: 'rebirth', target: 'rebirth' },
  { text: 'Buy a new golf club', event: 'buyPlane', target: 'hangar' },
]

export const BADGES = {
  firstThrow: { name: 'First Hit' },
  firstRebirth: { name: 'First Rebirth' },
  firstPet: { name: 'Pet Owner' },
  kilometer: { name: 'Kilometre Club' },
  world2: { name: 'World Traveller' },
  holeInOne: { name: 'Hole in One' },
  duelWin: { name: 'Duel Champion' },
}
