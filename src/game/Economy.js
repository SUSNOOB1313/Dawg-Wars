import { COIN_STORAGE_KEY, PLACEMENT_REWARDS } from './Constants.js';

export class Economy {
  constructor() {
    const stored = window.localStorage.getItem(COIN_STORAGE_KEY);
    this.coins = stored === null ? 0 : parseInt(stored, 10) || 0;
  }

  save() {
    window.localStorage.setItem(COIN_STORAGE_KEY, String(this.coins));
  }

  // placement: 1 = winner .. totalCombatants = last place
  rewardForPlacement(placement, totalCombatants) {
    if (placement === 1) return PLACEMENT_REWARDS[1];
    if (placement === 2) return PLACEMENT_REWARDS[2];
    if (placement === 3) return PLACEMENT_REWARDS[3];
    if (placement === totalCombatants) return PLACEMENT_REWARDS.last;
    return 0;
  }

  applyPlacement(placement, totalCombatants) {
    const reward = this.rewardForPlacement(placement, totalCombatants);
    this.coins += reward;
    this.save();
    return reward;
  }
}
