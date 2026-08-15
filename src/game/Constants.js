// Central tuning knobs for Dawg Wars.

export const WORLD = {
  groundSize: 140,
  gravity: -26,
  bounceJumpVelocity: 15.5, // dogs bounce REALLY high
  bounceGravityScale: 1.0,
  moveSpeed: 6.4,
  turnSpeed: 2.6, // radians / sec for A/D turning
  botTurnSpeed: 2.1,
  playerRadius: 0.55,
  botRadius: 0.55,
};

const deg2rad = (deg) => (deg * Math.PI) / 180;

export const WEAPON = {
  reloadTime: 1.5, // seconds, shared by player + bots
  pelletCount: 9,
  spreadAngle: deg2rad(7.5), // half-angle cone in radians
  maxRange: 22,
  falloffStart: 4, // full damage inside this range
  falloffEnd: 20, // ~min damage beyond this range
  pelletDamageClose: 13,
  pelletDamageFar: 1.6,
  muzzleFlashTime: 0.08,
  fireRecoilKick: 0.12,
};

export const COMBAT = {
  maxHP: 6, // a "hit" is any shotgun blast that lands at least one pellet — always exactly 6 to go down
  noticeRadius: 20,
  engagedVisionConeDeg: 65, // half-angle: a bot already fighting only notices new threats inside this cone
  preferredRangeMin: 7,
  preferredRangeMax: 13,
  botAimTurnSpeed: 3.4, // radians/sec, bots need to turn to face target (not instant aimbot)
  botAimToleranceDeg: 6,
  botAccuracySpreadDeg: 4.5, // extra random inaccuracy bots add on top of weapon spread
  botStrafeSpeed: 4.2,
  botJumpChance: 0.006, // per-frame chance while in combat and grounded
  loseTargetTime: 4.5, // seconds without LOS before dropping a threat
  knockbackImpulse: 15, // base horizontal speed (units/sec) a landed hit shoves the target
  knockbackFriction: 5, // how fast knockback velocity decays (per second, multiplicative)
  knockbackMax: 24, // clamp so stacked hits can't launch someone off the map
};

export const ENTITY_COUNT = {
  bots: 15,
  totalCombatants: 16, // 15 bots + player
};

export const PLACEMENT_REWARDS = {
  1: 15,
  2: 10,
  3: 5,
  last: -1,
};

export const CAMERA = {
  followDistance: 6.2,
  followHeight: 3.1,
  lookHeight: 1.1,
  fov: 68,
  mobileFov: 74,
};

export const COIN_STORAGE_KEY = 'dawgwars.coins.v1';
