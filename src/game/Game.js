import * as THREE from 'three';
import { buildTown } from './Town.js';
import { Player } from './Player.js';
import { Bot } from './Bot.js';
import { Input } from './Input.js';
import { UI } from './UI.js';
import { Economy } from './Economy.js';
import { AudioSynth } from './AudioSynth.js';
import { fireShotgun } from './Weapon.js';
import { WORLD, WEAPON, COMBAT, ENTITY_COUNT, CAMERA } from './Constants.js';
import { skyGradientTexture, toonGradientTexture } from './Textures.js';

const deg2rad = (d) => (d * Math.PI) / 180;
const BOT_ACCURACY_SPREAD = deg2rad(COMBAT.botAccuracySpreadDeg);

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export class Game {
  constructor() {
    this.ui = new UI();
    this.economy = new Economy();
    this.audio = new AudioSynth();
    this.ui.setCoinDisplays(this.economy.coins);

    this.canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Flat, un-tonemapped output keeps the candy palette punchy — ACES-style
    // filmic tone mapping crushes/desaturates the bright toy colors we want here.
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    const isMobile = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.camera = new THREE.PerspectiveCamera(isMobile ? CAMERA.mobileFov : CAMERA.fov, window.innerWidth / window.innerHeight, 0.1, 220);

    // Shared quantized ramp so every toon-shaded surface (dogs + town) bands consistently.
    this.gradientMap = toonGradientTexture();

    this._setupSkyAndLights();
    const { colliders, arenaHalf, mill } = buildTown(this.scene, this.gradientMap);
    this.colliders = colliders;
    this.arenaHalf = arenaHalf;
    this.millHub = mill?.userData?.hub || null;

    this.tracers = [];
    this.tracerPool = [];
    this.matchEnded = false;
    this.running = false;
    this.deathCounter = 0;
    this.clock = new THREE.Clock();
    this.elapsed = 0;

    this.input = new Input({ mobileRoot: document.getElementById('mobile-controls-root') });

    window.addEventListener('resize', () => this._onResize());
    this._onResize();

    this.ui.startBtn.addEventListener('click', () => this._beginMatch());
    this.ui.restartBtn.addEventListener('click', () => this._beginMatch());

    this._spawnAllEntities();
    this._loop = this._loop.bind(this);

    this.ui.hideLoading();
    this.ui.showStart();
    this.renderer.render(this.scene, this.camera);
  }

  _setupSkyAndLights() {
    const skyTex = skyGradientTexture();
    const skyGeo = new THREE.SphereGeometry(200, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
    // Light, airy fog matching the sky horizon — keeps the bright toy-town
    // look clean at distance instead of muddying it with dusty haze.
    this.scene.fog = new THREE.Fog(0xbfe7ff, 70, 175);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8fd4dc, 1.1);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfffaf0, 1.4);
    sun.position.set(40, 60, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);
    this.sun = sun;
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _findSpawnPoint(margin = 1.2) {
    const half = this.arenaHalf * 0.82;
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = (Math.random() * 2 - 1) * half;
      const z = (Math.random() * 2 - 1) * half;
      let blocked = false;
      for (const c of this.colliders) {
        if (x > c.minX - margin && x < c.maxX + margin && z > c.minZ - margin && z < c.maxZ + margin) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return { x, z };
    }
    return { x: 0, z: 0 };
  }

  _spawnAllEntities() {
    this.player = new Player({ scene: this.scene, colliders: this.colliders, arenaHalf: this.arenaHalf, gradientMap: this.gradientMap });
    this.bots = [];
    for (let i = 0; i < ENTITY_COUNT.bots; i++) {
      this.bots.push(new Bot({ scene: this.scene, colliders: this.colliders, arenaHalf: this.arenaHalf, gradientMap: this.gradientMap }, i));
    }
    this.allCharacters = [this.player, ...this.bots];
    this._placeAllAtSpawns();
  }

  _placeAllAtSpawns() {
    for (const ch of this.allCharacters) {
      const p = this._findSpawnPoint();
      ch.position.set(p.x, 0, p.z);
      ch.heading = Math.random() * Math.PI * 2;
      ch.hp = ch.maxHP;
      ch.alive = true;
      ch.deathOrder = null;
      ch.reloadTimer = 0;
      ch.velocityY = 0;
      ch.grounded = true;
      ch.root.position.set(p.x, 0, p.z);
      ch.root.rotation.set(0, ch.heading, 0);
      if (ch instanceof Bot) {
        ch.state = 'wander';
        ch.threats.clear();
        ch.lastSeenTime.clear();
        ch.targetPrevPos.clear();
        ch.currentTarget = null;
        ch.wanderTarget = null;
      }
    }
  }

  _beginMatch() {
    this._placeAllAtSpawns();
    this.deathCounter = 0;
    this.matchEnded = false;
    this.elapsed = 0;
    this.ui.showHud();
    this.audio.ensure();
    this.audio.unlocked = true;
    this.clock.start();
    this.clock.getDelta();
    this.running = true;
    requestAnimationFrame(this._loop);
  }

  _loop() {
    if (!this.running) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;
    this._update(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.running) requestAnimationFrame(this._loop);
  }

  _update(dt) {
    this.input.poll();

    this.player.update(dt, this.input);
    if (this.input.fireHeld && this.player.alive) {
      this._fireWeapon(this.player, 0);
    }

    for (const bot of this.bots) {
      bot.update(dt, this.allCharacters, this.elapsed);
      if (bot.fireRequested) {
        this._fireWeapon(bot, BOT_ACCURACY_SPREAD);
      }
    }

    this._resolveCharacterCollisions();
    this._updateTracers(dt);

    if (this.millHub) this.millHub.rotation.z += dt * 1.4;

    this.player.updateCamera(this.camera, dt);

    this.ui.updateHP(this.player.hp, this.player.maxHP);
    this.ui.updateReload(this.player.reloadTimer, WEAPON.reloadTime);
    const aliveCount = this.allCharacters.filter((c) => c.alive).length;
    this.ui.updateAliveCount(aliveCount);
  }

  _resolveCharacterCollisions() {
    const chars = this.allCharacters;
    for (let i = 0; i < chars.length; i++) {
      const a = chars[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < chars.length; j++) {
        const b = chars[j];
        if (!b.alive) continue;
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const dist = Math.hypot(dx, dz);
        const minDist = a.radius + b.radius;
        if (dist > 0 && dist < minDist) {
          const push = (minDist - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;
          a.position.x += nx * push;
          a.position.z += nz * push;
          b.position.x -= nx * push;
          b.position.z -= nz * push;
        }
      }
    }
  }

  _fireWeapon(shooter, extraSpread) {
    const muzzlePos = shooter.fire();
    if (!muzzlePos) return;
    const distToPlayer = shooter === this.player ? 0 : shooter.distanceTo(this.player);
    const gain = shooter === this.player ? 1 : clamp(1 - distToPlayer / 60, 0.12, 1);
    this.audio.shotgunBlast(gain);
    if (shooter === this.player) this.player.addRecoilShake(WEAPON.fireRecoilKick);

    const { hitsByTarget, origin, pelletDirs } = fireShotgun(shooter, this.allCharacters, this.colliders, extraSpread);

    let maxDist = WEAPON.maxRange;
    for (let i = 0; i < pelletDirs.length; i += 3) {
      this._spawnTracer(origin, pelletDirs[i], maxDist);
    }

    for (const [target, dmg] of hitsByTarget) {
      this._applyDamage(target, dmg, shooter);
    }
  }

  _applyDamage(target, dmg, attacker) {
    if (!target.alive) return;
    const wasAlive = target.alive;
    target.takeDamage(dmg);
    if (target === this.player && target.alive) {
      this.audio.hitYelp();
      this.player.addRecoilShake(0.05);
    }
    if (wasAlive && !target.alive) {
      this._handleDeath(target, attacker);
    }
  }

  _handleDeath(target, attacker) {
    this.deathCounter += 1;
    target.deathOrder = this.deathCounter;
    this.audio.deathThud();

    const attackerName = attacker === this.player ? 'You' : attacker?.name || 'the desert';
    if (target === this.player) {
      this.ui.addKillFeed(`💀 ${attackerName} took you down!`);
    } else {
      const verb = attacker === this.player ? 'dropped' : 'gunned down';
      this.ui.addKillFeed(`🔫 ${attackerName} ${verb} ${target.name}`);
    }

    if (target === this.player) {
      this._endMatch({ win: false, cause: `Eliminated by ${attackerName === 'You' ? 'yourself' : attackerName}` });
      return;
    }

    const aliveCount = this.allCharacters.filter((c) => c.alive).length;
    if (aliveCount === 1 && this.player.alive) {
      this._endMatch({ win: true });
    }
  }

  _endMatch({ win, cause }) {
    if (this.matchEnded) return;
    this.matchEnded = true;
    this.running = false;

    const total = ENTITY_COUNT.totalCombatants;
    const placement = win ? 1 : total + 1 - this.player.deathOrder;
    const reward = this.economy.applyPlacement(placement, total);
    this.ui.setCoinDisplays(this.economy.coins);
    this.audio.coinChime(reward >= 0);
    this.ui.showEnd({ placement, total, reward, won: win, cause });
  }

  _spawnTracer(origin, dir, maxDist) {
    let mesh = this.tracerPool.pop();
    if (!mesh) {
      const geo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.85, depthWrite: false });
      mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
    }
    mesh.visible = true;
    mesh.position.copy(origin);
    const length = maxDist * (0.7 + Math.random() * 0.3);
    mesh.scale.set(1, 1, length);
    mesh.lookAt(origin.x + dir.x, origin.y + dir.y, origin.z + dir.z);
    mesh.material.opacity = 0.85;
    this.tracers.push({ mesh, life: 0.08 });
  }

  _updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        t.mesh.visible = false;
        this.tracerPool.push(t.mesh);
        this.tracers.splice(i, 1);
      } else {
        t.mesh.material.opacity = Math.max(0, t.life / 0.08) * 0.85;
      }
    }
  }
}
