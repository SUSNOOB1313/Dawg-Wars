export class UI {
  constructor() {
    this.startScreen = document.getElementById('start-screen');
    this.endScreen = document.getElementById('end-screen');
    this.loadingScreen = document.getElementById('loading-screen');
    this.hud = document.getElementById('hud');

    this.hpPips = document.getElementById('hp-pips');
    this._hpPipsCount = 0;
    this.aliveCount = document.getElementById('alive-count');
    this.coinHud = document.getElementById('coin-count-hud');
    this.coinStart = document.getElementById('coin-count-start');
    this.coinEnd = document.getElementById('coin-count-end');
    this.reloadLabel = document.getElementById('reload-label');
    this.reloadBar = document.getElementById('reload-bar');
    this.killFeed = document.getElementById('kill-feed');
    this.noticeBanner = document.getElementById('notice-banner');

    this.endTitle = document.getElementById('end-title');
    this.endPlacement = document.getElementById('end-placement');
    this.endReward = document.getElementById('end-reward');

    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');

    if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
      document.getElementById('controls-hint-desktop').style.display = 'none';
      document.getElementById('controls-hint-mobile').style.display = 'block';
    }
  }

  hideLoading() {
    this.loadingScreen.classList.add('hidden');
  }

  setCoinDisplays(coins) {
    this.coinStart.textContent = coins;
    this.coinHud.textContent = coins;
    this.coinEnd.textContent = coins;
  }

  showStart() {
    this.startScreen.classList.remove('hidden');
    this.endScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
  }

  showHud() {
    this.startScreen.classList.add('hidden');
    this.endScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.killFeed.innerHTML = '';
  }

  showEnd({ placement, total, reward, won, cause }) {
    this.hud.classList.add('hidden');
    this.endScreen.classList.remove('hidden');
    this.endTitle.textContent = won ? 'VICTORY!' : 'ELIMINATED';
    const ordinal = (n) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    this.endPlacement.textContent = `Placement: ${ordinal(placement)} of ${total}${cause ? ` — ${cause}` : ''}`;
    const sign = reward > 0 ? '+' : '';
    this.endReward.textContent = reward === 0 ? 'No coins earned this run.' : `${sign}${reward} coin${Math.abs(reward) === 1 ? '' : 's'} ${reward >= 0 ? 'earned' : 'deducted'}.`;
  }

  updateHP(hp, maxHp) {
    if (this._hpPipsCount !== maxHp) {
      this.hpPips.innerHTML = '';
      for (let i = 0; i < maxHp; i++) {
        const pip = document.createElement('div');
        pip.className = 'hp-pip';
        this.hpPips.appendChild(pip);
      }
      this._hpPipsCount = maxHp;
    }
    const pips = this.hpPips.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('filled', i < hp);
    }
  }

  updateAliveCount(n) {
    this.aliveCount.textContent = n;
  }

  updateReload(reloadTimer, reloadTime) {
    if (reloadTimer <= 0) {
      this.reloadLabel.textContent = 'READY';
      this.reloadLabel.classList.remove('reloading');
      this.reloadBar.style.width = '100%';
    } else {
      this.reloadLabel.textContent = 'RELOADING';
      this.reloadLabel.classList.add('reloading');
      const pct = ((reloadTime - reloadTimer) / reloadTime) * 100;
      this.reloadBar.style.width = `${pct}%`;
    }
  }

  addKillFeed(text) {
    const el = document.createElement('div');
    el.className = 'kill-feed-item';
    el.textContent = text;
    this.killFeed.appendChild(el);
    while (this.killFeed.children.length > 5) {
      this.killFeed.removeChild(this.killFeed.firstChild);
    }
    setTimeout(() => {
      el.style.transition = 'opacity 0.6s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 650);
    }, 4200);
  }

  flashNotice(text) {
    this.noticeBanner.textContent = text;
    this.noticeBanner.classList.remove('hidden');
    clearTimeout(this._noticeTimer);
    this._noticeTimer = setTimeout(() => this.noticeBanner.classList.add('hidden'), 1800);
  }
}
