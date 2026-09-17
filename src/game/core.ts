import { GameAudio } from './audio'

export type V3 = { x: number; y: number; z: number }
export type Mode = 'title' | 'playing' | 'paused' | 'won' | 'lost'
export type EnemyKind = 'striker' | 'gunner' | 'drone' | 'boss'
export type Enemy = V3 & {
  id: number; active: boolean; kind: EnemyKind; hp: number; maxHp: number;
  timer: number; phase: 'approach' | 'windup' | 'recover'; stun: number;
  flash: number; yaw: number; vy: number; attack: number; aim: V3
}
export type Particle = V3 & { vx: number; vy: number; vz: number; life: number; maxLife: number; color: string; size: number }
export type Shot = V3 & { active: boolean; vx: number; vy: number; vz: number; life: number }
export type Settings = { volume: number; sensitivity: number; shake: boolean; flashes: boolean; quality: 'high' | 'low' }
export type Snapshot = {
  mode: Mode; hp: number; energy: number; dashes: number; dashCharge: number;
  combo: number; maxCombo: number; score: number; kills: number; wave: number;
  remaining: number; time: number; message: string; messageSub: string;
  bossHp: number; bossMaxHp: number; best: number; locked: boolean;
}
export type CollisionResolver = (position: V3, movement: V3) => { position: V3; grounded: boolean }
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export const distance = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const horizontalDistance = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.z - b.z)
export const rankFor = (combo: number) => combo >= 30 ? 'S' : combo >= 18 ? 'A' : combo >= 9 ? 'B' : 'C'
export const WAVES: EnemyKind[][] = [
  ['striker', 'striker', 'striker', 'striker'],
  ['striker', 'striker', 'gunner', 'gunner', 'drone', 'striker'],
  ['striker', 'striker', 'striker', 'gunner', 'gunner', 'drone', 'drone', 'drone'],
  ['boss', 'drone', 'drone'],
]
const DEFAULTS: Settings = { volume: 0.45, sensitivity: 1, shake: true, flashes: true, quality: 'high' }
function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem('aeroburst.settings') || '{}')
    return {
      volume: typeof saved.volume === 'number' ? clamp(saved.volume, 0, 1) : DEFAULTS.volume,
      sensitivity: typeof saved.sensitivity === 'number' ? clamp(saved.sensitivity, 0.3, 2) : 1,
      shake: typeof saved.shake === 'boolean' ? saved.shake : !matchMedia('(prefers-reduced-motion: reduce)').matches,
      flashes: typeof saved.flashes === 'boolean' ? saved.flashes : true,
      quality: saved.quality === 'low' ? 'low' : 'high',
    }
  } catch { return { ...DEFAULTS } }
}
function loadBest() {
  try { return Math.max(0, Number(localStorage.getItem('aeroburst.best')) || 0) } catch { return 0 }
}
export const groundResolver: CollisionResolver = (pos, delta) => {
  const next = { x: pos.x + delta.x, y: pos.y + delta.y, z: pos.z + delta.z }
  const onFloor = Math.hypot(next.x, next.z) < 31
  const grounded = onFloor && next.y <= 1.15
  if (grounded) next.y = 1.15
  return { position: next, grounded }
}

export class Game {
  mode: Mode = 'title'
  player = { x: 0, y: 1.15, z: 9, vx: 0, vy: 0, vz: 0, yaw: Math.PI, grounded: true, jumps: 0 }
  cameraYaw = 0
  cameraPitch = 0.32
  hp = 100
  energy = 0
  dashes = 2
  dashCharge = 0
  dashTime = 0
  dashDirection: V3 = { x: 0, y: 0, z: -1 }
  invincible = 0
  attackCooldown = 0
  slash = 0
  slashType = 0
  slashSerial = 0
  burst = 0
  slam = 0
  pendingSlam = false
  burstOrigin: V3 = { x: 0, y: 0, z: 0 }
  hitstop = 0
  shake = 0
  damageFlash = 0
  combo = 0
  comboTime = 0
  maxCombo = 0
  score = 0
  kills = 0
  wave = 0
  formation = 0
  waveDelay = 0
  time = 0
  message = ''
  messageSub = ''
  messageTime = 0
  locked = false
  pointerFallback = false
  target = -1
  best = loadBest()
  settings = loadSettings()
  readonly keys = new Set<string>()
  readonly actions: string[] = []
  readonly audio = new GameAudio()
  readonly enemies: Enemy[] = Array.from({ length: 16 }, (_, id) => ({
    id, active: false, kind: 'striker', x: 0, y: 1, z: 0, hp: 0, maxHp: 0,
    timer: 0, phase: 'approach', stun: 0, flash: 0, yaw: 0, vy: 0, attack: 0, aim: { x: 0, y: 0, z: 0 },
  }))
  readonly particles: Particle[] = Array.from({ length: 200 }, () => ({
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, color: '#7df3df', size: 0.1,
  }))
  readonly shots: Shot[] = Array.from({ length: 40 }, () => ({ x: 0, y: 0, z: 0, active: false, vx: 0, vy: 0, vz: 0, life: 0 }))
  private particleCursor = 0
  private publishTime = 0
  private listeners = new Set<() => void>()
  private snapshot!: Snapshot

  constructor() { this.publish() }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.snapshot
  publish() {
    const boss = this.enemies.find(e => e.active && e.kind === 'boss')
    this.snapshot = {
      mode: this.mode, hp: this.hp, energy: this.energy, dashes: this.dashes, dashCharge: this.dashCharge,
      combo: this.combo, maxCombo: this.maxCombo, score: this.score, kills: this.kills, wave: this.wave,
      remaining: this.enemies.filter(e => e.active).length + (this.wave > 0 && this.wave < 4 ? (3 - this.formation) * WAVES[this.wave - 1].length : 0), time: this.time, message: this.message,
      messageSub: this.messageSub, bossHp: boss?.hp ?? 0, bossMaxHp: boss?.maxHp ?? 0, best: this.best, locked: this.locked,
    }
    this.listeners.forEach(listener => listener())
  }
  saveSettings(settings: Settings) {
    this.settings = settings
    this.audio.volume = settings.volume
    try { localStorage.setItem('aeroburst.settings', JSON.stringify(settings)) } catch { /* Optional persistence. */ }
    this.publish()
  }
  announce(message: string, sub: string, seconds = 3) {
    this.message = message; this.messageSub = sub; this.messageTime = seconds
  }
  start() {
    Object.assign(this.player, { x: 0, y: 1.15, z: 9, vx: 0, vy: 0, vz: 0, yaw: Math.PI, grounded: true, jumps: 0 })
    this.cameraYaw = 0; this.cameraPitch = 0.32
    this.hp = 100; this.energy = 0; this.dashes = 2; this.dashCharge = 0; this.dashTime = 0
    this.invincible = 1.5; this.attackCooldown = 0; this.slash = 0; this.burst = 0; this.hitstop = 0
    this.shake = 0; this.damageFlash = 0; this.combo = 0; this.comboTime = 0; this.maxCombo = 0
    this.score = 0; this.kills = 0; this.wave = 0; this.formation = 0; this.time = 0; this.waveDelay = 0; this.pendingSlam = false; this.slam = 0
    this.enemies.forEach(e => { e.active = false }); this.shots.forEach(s => { s.active = false })
    this.particles.forEach(p => { p.life = 0 }); this.keys.clear(); this.actions.length = 0
    this.mode = 'playing'; this.audio.unlock(); this.audio.volume = this.settings.volume
    this.nextWave(); this.publish()
  }
  pause() {
    if (this.mode !== 'playing') return
    this.mode = 'paused'; this.keys.clear(); this.actions.length = 0; this.publish()
  }
  resume() { if (this.mode === 'paused') { this.mode = 'playing'; this.publish() } }
  title() {
    this.mode = 'title'; this.keys.clear(); this.actions.length = 0
    this.enemies.forEach(e => { e.active = false }); this.shots.forEach(s => { s.active = false })
    this.particles.forEach(p => { p.life = 0 }); this.slash = 0; this.burst = 0
    Object.assign(this.player, { x: 0, y: 1.15, z: 9, yaw: Math.PI })
    this.publish()
  }
  action(action: string) { if (this.mode === 'playing') this.actions.push(action) }
  nextWave() {
    if (this.wave >= WAVES.length) { this.finish(true); return }
    this.wave++; this.formation = 1
    this.spawnFormation()
    this.announce(this.wave === 4 ? 'GUARDIAN ONLINE' : `SECTOR 0${this.wave}`, this.wave === 4 ? '守護機を撃破して、空路を開け。' : ['まずは接近。Shiftでダッシュ、左クリックで斬撃。', '射撃の予兆を見て回避。撃破でダッシュが回復。', '空中の敵へダッシュ。右クリックで打ち上げ・急降下。'][this.wave - 1], 4)
    this.audio.play('wave')
  }
  spawnFormation() {
    const kinds = WAVES[this.wave - 1]
    kinds.forEach((kind, index) => {
      const angle = (index / kinds.length) * Math.PI * 2 + Math.PI + (this.formation - 1) * 0.9
      const maxHp = kind === 'boss' ? 1100 : kind === 'striker' ? 70 : kind === 'gunner' ? 85 : 55
      Object.assign(this.enemies[index], {
        active: true, kind, x: Math.sin(angle) * (kind === 'boss' ? 0 : 13),
        y: kind === 'drone' ? 4.5 : kind === 'boss' ? 2.5 : 1.15,
        z: kind === 'boss' ? -9 : Math.cos(angle) * 13, hp: maxHp, maxHp,
        timer: 1 + index * 0.2, phase: 'approach', stun: 0, flash: 0, vy: 0, attack: 0,
      })
    })
    this.invincible = Math.max(this.invincible, 0.8)
  }
  emit(pos: V3, color: string, count: number, speed = 8) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor++ % this.particles.length]
      const life = 0.35 + Math.random() * 0.5
      Object.assign(p, pos, { vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed * 0.8,
        vz: (Math.random() - 0.5) * speed, life, maxLife: life, color, size: 0.06 + Math.random() * 0.18 })
    }
  }
  findTarget(range = 22) {
    const forward = { x: -Math.sin(this.cameraYaw), z: -Math.cos(this.cameraYaw) }
    let best = Infinity
    let target: Enemy | undefined
    for (const e of this.enemies) {
      if (!e.active) continue
      const d = distance(this.player, e)
      const h = horizontalDistance(this.player, e) || 0.01
      const dot = ((e.x - this.player.x) * forward.x + (e.z - this.player.z) * forward.z) / h
      if (d > range || (dot < 0.15 && d > 4)) continue
      const weight = d * (1.5 - dot)
      if (weight < best) { best = weight; target = e }
    }
    return target
  }
  damageEnemy(e: Enemy, damage: number, launch = false) {
    if (!e.active) return
    e.hp -= damage; e.flash = 0.13; e.stun = e.kind === 'boss' ? 0.07 : 0.45
    if (launch && e.kind !== 'boss') e.vy = 13
    this.combo++; this.comboTime = 4; this.maxCombo = Math.max(this.maxCombo, this.combo)
    this.energy = clamp(this.energy + 4, 0, 100)
    this.score += Math.round(damage * (1 + Math.min(this.combo, 40) * 0.04))
    this.shake = Math.max(this.shake, 0.14); this.hitstop = 0.045
    this.emit(e, '#fff2bd', 7); this.audio.play('hit')
    if (e.hp <= 0) {
      e.active = false; this.kills++; this.score += e.kind === 'boss' ? 3000 : 150
      this.dashes = 2; this.dashCharge = 0; this.energy = clamp(this.energy + 11, 0, 100)
      this.hp = clamp(this.hp + 4, 0, 100); this.player.jumps = Math.min(this.player.jumps, 1)
      if (!this.player.grounded) this.player.vy = Math.max(this.player.vy, 3)
      this.emit(e, '#ff7951', e.kind === 'boss' ? 70 : 24, 15); this.audio.play('kill')
      if (e.kind === 'boss') this.announce('GUARDIAN DOWN', '残存する機体を撃破せよ。', 2)
    }
  }
  attack(heavy = false) {
    if (this.attackCooldown > 0) return
    this.attackCooldown = heavy ? 0.55 : 0.25; this.slash = heavy ? 0.35 : 0.22
    this.slashType = heavy ? 1 : 0; this.slashSerial++; this.audio.play('slash')
    const target = this.findTarget(7)
    if (target) this.player.yaw = Math.atan2(target.x - this.player.x, target.z - this.player.z)
    const dive = heavy && !this.player.grounded
    if (dive) { this.player.vy = -24; this.pendingSlam = true; this.emit(this.player, '#94ffff', 18); return }
    let hit = false
    for (const e of this.enemies) {
      if (!e.active) continue
      const reach = e.kind === 'boss' ? 6 : heavy ? 5.5 : 4.7
      const d = distance(this.player, e)
      const dx = e.x - this.player.x, dz = e.z - this.player.z
      const dot = (dx * Math.sin(this.player.yaw) + dz * Math.cos(this.player.yaw)) / (Math.hypot(dx, dz) || 1)
      if (d < reach && (dot > -0.25 || d < 2.3 || heavy)) {
        this.damageEnemy(e, heavy ? 48 : 28, heavy && !dive); hit = true
      }
    }
    if (hit && heavy && !dive) { this.player.vy = 12; this.player.grounded = false; this.player.jumps = 1 }
    if (hit && !heavy && !this.player.grounded) this.player.vy = Math.max(this.player.vy, 2.8)
  }
  dash() {
    if (this.dashes < 1 || this.dashTime > 0) return
    const target = this.findTarget(20)
    const p = this.player
    let dx: number, dz: number, dy = 0
    if (target && !this.keys.has('KeyS')) {
      dx = target.x - p.x; dz = target.z - p.z; dy = target.y - p.y
    } else {
      const forward = (this.keys.has('KeyS') ? -1 : 1)
      const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'))
      dx = -Math.sin(this.cameraYaw) * (side ? 0 : forward) + Math.cos(this.cameraYaw) * side
      dz = -Math.cos(this.cameraYaw) * (side ? 0 : forward) - Math.sin(this.cameraYaw) * side
    }
    const length = Math.hypot(dx, dy, dz) || 1
    this.dashDirection = { x: dx / length, y: dy / length, z: dz / length }
    this.dashTime = target ? Math.min(0.26, Math.max(0.07, (length - 1.7) / 55)) : 0.22
    this.dashes--; this.invincible = 0.38; p.yaw = Math.atan2(dx, dz); p.vy = 0
    this.emit(p, '#70eaff', 15); this.audio.play('dash')
  }
  jump() {
    if (this.player.jumps >= 2) return
    this.player.vy = this.player.jumps === 0 ? 12 : 10.5
    this.player.jumps++; this.player.grounded = false
    this.emit(this.player, '#dbfff6', 10); this.audio.play('jump')
  }
  ultimate() {
    if (this.energy < 100) return
    this.energy = 0; this.burst = 1; this.burstOrigin = { ...this.player }; this.invincible = 1.3
    this.shake = 0.65; this.audio.play('burst'); this.emit(this.player, '#b5fff2', 70, 26)
    for (const e of this.enemies) if (e.active && distance(e, this.player) < 24) this.damageEnemy(e, 190)
    this.energy = 0; this.shots.forEach(s => { s.active = false })
    this.announce('AEROBURST', '空を、連鎖しろ。', 1.5)
  }
  hurt(damage: number) {
    if (this.invincible > 0 || this.mode !== 'playing') return
    this.hp = Math.max(0, this.hp - damage); this.invincible = 0.9
    this.combo = Math.floor(this.combo / 2); this.damageFlash = 0.45; this.shake = 0.3
    this.audio.play('hurt'); this.emit(this.player, '#ff8563', 10)
    if (this.hp <= 0) this.finish(false)
  }
  finish(won: boolean) {
    this.mode = won ? 'won' : 'lost'; this.keys.clear(); this.actions.length = 0
    if (won) this.score += Math.round(Math.max(0, 300 - this.time) * 10)
    this.best = Math.max(this.best, this.score)
    try { localStorage.setItem('aeroburst.best', String(this.best)) } catch { /* Optional persistence. */ }
    this.publish()
  }
  fire(e: Enemy, offset = 0) {
    const s = this.shots.find(shot => !shot.active)
    if (!s) return
    const dx = e.aim.x - e.x, dy = e.aim.y - e.y, dz = e.aim.z - e.z
    const length = Math.hypot(dx, dy, dz) || 1
    const speed = e.kind === 'boss' ? 14 : 11
    const angle = Math.atan2(dx, dz) + offset
    Object.assign(s, { active: true, x: e.x, y: e.y, z: e.z,
      vx: Math.sin(angle) * speed, vy: dy / length * speed, vz: Math.cos(angle) * speed, life: 5 })
  }
  updateEnemy(e: Enemy, dt: number) {
    if (!e.active) return
    const p = this.player
    e.flash = Math.max(0, e.flash - dt); e.stun = Math.max(0, e.stun - dt)
    if (e.vy !== 0 || (e.kind !== 'drone' && e.y > (e.kind === 'boss' ? 2.5 : 1.15))) {
      e.vy -= 22 * dt; e.y += e.vy * dt
      if (e.y < (e.kind === 'boss' ? 2.5 : 1.15)) { e.y = e.kind === 'boss' ? 2.5 : 1.15; e.vy = 0 }
    }
    if (e.stun > 0) return
    e.timer -= dt
    const dx = p.x - e.x, dz = p.z - e.z, h = Math.hypot(dx, dz) || 0.01
    e.yaw = Math.atan2(dx, dz)
    if (e.phase === 'approach') {
      const preferred = e.kind === 'gunner' ? 13 : e.kind === 'drone' ? 9 : e.kind === 'boss' ? 7 : 2.8
      if (h > preferred) { const speed = e.kind === 'boss' ? 3.2 : e.kind === 'striker' ? 4.2 : 2.2; e.x += dx / h * speed * dt; e.z += dz / h * speed * dt }
      if (e.kind === 'drone' && !e.vy) e.y = 4.5 + Math.sin(this.time * 2 + e.id) * 0.5
      if (e.timer <= 0 && (h < preferred + 2 || e.kind !== 'striker')) {
        e.phase = 'windup'; e.timer = e.kind === 'boss' ? 1.1 : 0.8; e.aim = { x: p.x, y: p.y, z: p.z }
      }
    } else if (e.phase === 'windup' && e.timer <= 0) {
      if (e.kind === 'striker') { if (h < 4 && Math.abs(p.y - e.y) < 2.5) this.hurt(12) }
      else if (e.kind === 'boss') {
        const attack = e.attack++ % 3
        if (attack === 0) { for (let i = -2; i <= 2; i++) this.fire(e, i * 0.2) }
        else if (attack === 1) {
          this.emit(e, '#ff6a42', 35, 24)
          if (h < 10 && p.y < 4) this.hurt(24)
        } else {
          const travel = Math.min(h, 10)
          e.x += dx / h * travel; e.z += dz / h * travel
          if (horizontalDistance(e, p) < 5 && Math.abs(p.y - e.y) < 4) this.hurt(20)
          this.emit(e, '#ff9870', 30, 15)
        }
      } else this.fire(e)
      e.phase = 'recover'; e.timer = e.kind === 'boss' ? 1.3 : 1.5
    } else if (e.phase === 'recover' && e.timer <= 0) { e.phase = 'approach'; e.timer = 0.5 }
    // Keep enemies inside the arena so every wave can be completed.
    const radius = Math.hypot(e.x, e.z)
    if (radius > 27) { e.x *= 27 / radius; e.z *= 27 / radius }
  }
  tick(dt: number, resolve: CollisionResolver = groundResolver) {
    if (this.mode !== 'playing') return
    this.time += dt
    this.messageTime -= dt
    if (this.messageTime <= 0) { this.message = ''; this.messageSub = '' }
    this.invincible = Math.max(0, this.invincible - dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.slash = Math.max(0, this.slash - dt); this.burst = Math.max(0, this.burst - dt); this.slam = Math.max(0, this.slam - dt)
    this.shake = Math.max(0, this.shake - dt); this.damageFlash = Math.max(0, this.damageFlash - dt)
    if (this.dashes < 2) { this.dashCharge += dt; if (this.dashCharge >= 1.2) { this.dashes++; this.dashCharge = 0 } }
    if (this.combo > 0) { this.comboTime -= dt; if (this.comboTime <= 0) this.combo = 0 }
    const actions = this.actions.splice(0)
    for (const action of actions) {
      if (action === 'jump') this.jump()
      if (action === 'dash') this.dash()
      if (action === 'attack') this.attack()
      if (action === 'heavy') this.attack(true)
      if (action === 'burst') this.ultimate()
    }
    if (this.keys.has('Mouse0')) this.attack()
    const stopped = this.hitstop > 0
    this.hitstop = Math.max(0, this.hitstop - dt)
    const step = stopped ? dt * 0.12 : dt
    const p = this.player
    if (this.dashTime > 0) {
      this.dashTime = Math.max(0, this.dashTime - step)
      p.vx = this.dashDirection.x * 55; p.vz = this.dashDirection.z * 55; p.vy = this.dashDirection.y * 55
      if (this.dashTime === 0) { p.vx *= 0.08; p.vz *= 0.08; p.vy = clamp(p.vy, -3, 3) }
      this.emit(p, '#81e8ff', 2, 2)
    } else {
      const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'))
      const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'))
      const len = Math.hypot(forward, side) || 1
      const vx = (-Math.sin(this.cameraYaw) * forward + Math.cos(this.cameraYaw) * side) / len * 11
      const vz = (-Math.cos(this.cameraYaw) * forward - Math.sin(this.cameraYaw) * side) / len * 11
      const blend = 1 - Math.exp(-18 * step)
      p.vx += (vx - p.vx) * blend; p.vz += (vz - p.vz) * blend
      if (forward || side) p.yaw = Math.atan2(p.vx, p.vz)
      p.vy -= 27 * step
    }
    const moved = resolve(p, { x: p.vx * step, y: p.vy * step, z: p.vz * step })
    p.x = moved.position.x; p.y = moved.position.y; p.z = moved.position.z
    p.grounded = moved.grounded
    if (p.grounded && p.vy <= 0) { p.vy = 0; p.jumps = 0 }
    if (p.grounded && this.pendingSlam) {
      this.pendingSlam = false; this.slam = 0.45; this.burstOrigin = { ...p }; this.shake = 0.3
      this.emit(p, '#a4f7ed', 28, 16); this.audio.play('hit')
      for (const e of this.enemies) if (e.active && distance(e, p) < 6) this.damageEnemy(e, 65)
    }
    if (p.y > 24) p.vy = Math.min(p.vy, -2)
    if (p.y < -12 || Math.hypot(p.x, p.z) > 65) {
      Object.assign(p, { x: 0, y: 4, z: 9, vx: 0, vy: 0, vz: 0 }); this.invincible = 0; this.hurt(15)
      this.announce('BACK IN THE SKY', '落下から復帰。耐久値 −15', 2)
    }
    // Two launch pads are actual traversal tools, independent of attack input.
    for (const x of [-20, 20]) {
      if (p.grounded && Math.hypot(p.x - x, p.z) < 2.2) { p.vy = 20; p.grounded = false; p.jumps = 1; this.emit(p, '#9df7ad', 20); this.audio.play('jump') }
    }
    if (this.mode === 'playing') for (const e of this.enemies) this.updateEnemy(e, step)
    for (const s of this.shots) {
      if (!s.active) continue
      s.x += s.vx * step; s.y += s.vy * step; s.z += s.vz * step; s.life -= step
      if (distance(s, p) < 1.2) { this.hurt(10); s.active = false }
      if (s.life <= 0 || s.y < 0) s.active = false
    }
    for (const particle of this.particles) {
      if (particle.life <= 0) continue
      particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.z += particle.vz * dt; particle.vy -= 12 * dt
    }
    this.target = this.findTarget()?.id ?? -1
    if (!this.enemies.some(e => e.active) && this.mode === 'playing') {
      this.waveDelay += dt
      if (this.waveDelay > 1.6) {
        this.waveDelay = 0
        if (this.wave < 4 && this.formation < 3) {
          this.formation++; this.spawnFormation()
          this.announce('INCOMING', `増援 ${this.formation} / 3 — 撃破をつなげ。`, 1.8)
        } else { this.hp = clamp(this.hp + 15, 0, 100); this.nextWave() }
      }
    }
    this.publishTime += dt
    if (this.publishTime > 0.075) { this.publishTime = 0; this.publish() }
  }
}

export const game = new Game()
