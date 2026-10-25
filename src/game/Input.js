// Unified input for desktop (WASD tank controls + mouse) and mobile
// (virtual joystick + touch buttons). Produces a simple polled state:
//   forward: -1..1   (W/S or joystick Y)
//   turn:    -1..1   (A/D turn the whole dog, or joystick X)
//   jumpPressed / firePressed: edge-triggered booleans, cleared after read

export class Input {
  constructor({ mobileRoot }) {
    this.forward = 0;
    this.turn = 0;
    this._jumpQueued = false;
    this._fireHeld = false;
    this._fireQueued = false;

    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    this._keys = new Set();
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    if (this.isTouch) {
      this._buildTouchControls(mobileRoot);
    } else {
      window.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          this._fireHeld = true;
          this._fireQueued = true;
        }
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this._fireHeld = false;
      });
    }
  }

  _onKey(e, down) {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
    }
    if (down && this._keys.has(k)) return; // ignore auto-repeat for edge triggers
    if (down) this._keys.add(k);
    else this._keys.delete(k);

    if (k === ' ' && down) this._jumpQueued = true;
  }

  _readKeyboard() {
    const k = this._keys;
    let forward = 0;
    let turn = 0;
    if (k.has('w') || k.has('arrowup')) forward += 1;
    if (k.has('s') || k.has('arrowdown')) forward -= 1;
    if (k.has('a') || k.has('arrowleft')) turn += 1;
    if (k.has('d') || k.has('arrowright')) turn -= 1;
    this.forward = forward;
    this.turn = turn;
  }

  _buildTouchControls(root) {
    const wrap = document.createElement('div');
    wrap.className = 'touch-controls';
    wrap.innerHTML = `
      <div class="joystick" id="tc-joystick">
        <div class="joystick-knob" id="tc-joystick-knob"></div>
      </div>
      <div class="touch-buttons">
        <button class="touch-btn jump-btn" id="tc-jump">JUMP</button>
        <button class="touch-btn fire-btn" id="tc-fire">FIRE</button>
      </div>
    `;
    root.appendChild(wrap);

    const stick = wrap.querySelector('#tc-joystick');
    const knob = wrap.querySelector('#tc-joystick-knob');
    let stickTouchId = null;
    const stickRadius = 52;

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const handleStickMove = (touch) => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > stickRadius) {
        dx = (dx / dist) * stickRadius;
        dy = (dy / dist) * stickRadius;
      }
      setKnob(dx, dy);
      this.forward = -dy / stickRadius; // up = forward
      this.turn = -dx / stickRadius; // left = turn left (positive)
    };

    stick.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        stickTouchId = t.identifier;
        handleStickMove(t);
      },
      { passive: false }
    );
    window.addEventListener(
      'touchmove',
      (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === stickTouchId) {
            e.preventDefault();
            handleStickMove(t);
          }
        }
      },
      { passive: false }
    );
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickTouchId) {
          stickTouchId = null;
          setKnob(0, 0);
          this.forward = 0;
          this.turn = 0;
        }
      }
    };
    window.addEventListener('touchend', endStick);
    window.addEventListener('touchcancel', endStick);

    const jumpBtn = wrap.querySelector('#tc-jump');
    jumpBtn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this._jumpQueued = true;
      },
      { passive: false }
    );

    const fireBtn = wrap.querySelector('#tc-fire');
    fireBtn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this._fireHeld = true;
        this._fireQueued = true;
      },
      { passive: false }
    );
    fireBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._fireHeld = false;
    });
    fireBtn.addEventListener('touchcancel', () => {
      this._fireHeld = false;
    });
  }

  // Call once per frame before reading state.
  poll() {
    if (!this.isTouch) this._readKeyboard();
  }

  consumeJump() {
    if (this._jumpQueued) {
      this._jumpQueued = false;
      return true;
    }
    return false;
  }

  consumeFirePress() {
    if (this._fireQueued) {
      this._fireQueued = false;
      return true;
    }
    return false;
  }

  get fireHeld() {
    return this._fireHeld;
  }
}
