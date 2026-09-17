import { GameAudio } from './audio'
import { BOOST_GATES, CACHES, DISTRICTS, FIELD, LAUNCH_PADS, SPAWN, inField } from './world'
import { BIOMES, RESONATORS, UPDRAFTS, environmentAt, type Environment } from './biomes'
import { attackPattern, hazardTouches, type Hazard, type HazardSpec } from './encounters'

export type V3 = { x: number; y: number; z: number }
export type Mode = 'title' | 'playing' | 'paused' | 'won' | 'lost'
export type EnemyKind = 'striker' | 'gunner' | 'drone' | 'brute' | 'specialist' | 'warden' | 'boss'
export type Skill = 'grapple' | 'cyclone' | 'lance' | 'aegis' | 'drones' | 'overdrive'
export const SKILLS: { id: Skill; key: string; name: string; short: string; cooldown: number; color: string; description: string }[] = [
  { id: 'grapple', key: 'F', name: 'グラップル', short: 'GRAPPLE', cooldown: 3, color: '#a5f5ce', description: '70m先の敵へワイヤーで急接近し、追撃する。' },
  { id: 'cyclone', key: 'E', name: 'サイクロン', short: 'CYCLONE', cooldown: 6, color: '#81edeb', description: '周囲の敵を引き寄せ、回転斬撃でまとめて打ち上げる。' },
  { id: 'lance', key: 'R', name: 'フォトンランス', short: 'LANCE', cooldown: 5, color: '#fce4a3', description: '照準方向へ射程80mの貫通光線を放つ。' },
  { id: 'aegis', key: 'C', name: 'イージス', short: 'AEGIS', cooldown: 9, color: '#a4caff', description: '2.5秒の防壁。敵弾を反射し、被弾時に反撃の衝撃波。' },
  { id: 'drones', key: 'Z', name: 'ウィングドローン', short: 'WINGS', cooldown: 16, color: '#c6b5ff', description: '8秒間、2機の随伴機が近くの敵へ自動射撃する。' },
  { id: 'overdrive', key: 'X', name: 'オーバードライブ', short: 'OVERDRIVE', cooldown: 26, color: '#ffc58f', description: '8秒間、攻撃力・連撃速度が上昇し、ブースト消費ゼロ。' },
]
export type Enemy = V3 & {
  id: number; active: boolean; kind: EnemyKind; zone: number; hp: number; maxHp: number;
  timer: number; phase: 'approach' | 'windup' | 'recover'; stun: number; flash: number;
  yaw: number; vy: number; attack: number; aim: V3; enraged: boolean
}
export type Particle = V3 & { vx: number; vy: number; vz: number; life: number; maxLife: number; color: string; size: number }
export type Shot = V3 & { active: boolean; vx: number; vy: number; vz: number; life: number; friendly: boolean; damage: number; homing: boolean; color: string }
export type Effect = { kind: 'ring' | 'beam' | 'blast'; start: V3; end: V3; life: number; duration: number; color: string; radius: number }
export type ZoneState = { state: 'dormant' | 'combat' | 'cleared' | 'locked'; formation: number; delay: number }
export type Settings = { volume: number; sensitivity: number; shake: boolean; flashes: boolean; quality: 'high' | 'low' }
export type Snapshot = {
  mode: Mode; hp: number; maxHp: number; energy: number; dashes: number; dashCharge: number; fuel: number;
  combo: number; maxCombo: number; score: number; kills: number; wave: number; remaining: number; time: number;
  message: string; messageSub: string; bossHp: number; bossMaxHp: number; best: number; locked: boolean;
  objective: number; objectiveDistance: number; cleared: number; speed: number; cooldowns: Record<Skill, number>;
  overdrive: number; collected: number; skillNotice: string; zones: ZoneState[]; boosting: boolean; bossAttack: string;
  environment: Environment; wardenHp: number; wardenMaxHp: number; wardenName: string; wardenHint: string;
  buffs: { name: string; time: number }[]; resonances: number;
  blinkInterval: number;
}
export type CollisionResolver = (position: V3, movement: V3) => { position: V3; grounded: boolean }
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export const distance = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const hdist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
export const rankFor = (combo: number) => combo >= 100 ? 'SSS' : combo >= 60 ? 'SS' : combo >= 30 ? 'S' : combo >= 18 ? 'A' : combo >= 9 ? 'B' : 'C'
export function viewDirection(yaw: number, pitch: number): V3 {
  return { x: -Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) }
}
const freshCooldowns = (): Record<Skill, number> => ({ grapple: 0, cyclone: 0, lance: 0, aegis: 0, drones: 0, overdrive: 0 })
const freshZones = (): ZoneState[] => DISTRICTS.map(d => ({ state: d.id === 5 ? 'locked' : 'dormant', formation: 0, delay: 0 }))
const DEFAULTS: Settings = { volume: 0.45, sensitivity: 1, shake: true, flashes: true, quality: 'high' }
function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem('aeroburst.settings') || '{}')
    return { volume: typeof s.volume === 'number' ? clamp(s.volume, 0, 1) : 0.45,
      sensitivity: typeof s.sensitivity === 'number' ? clamp(s.sensitivity, 0.3, 2) : 1,
      shake: typeof s.shake === 'boolean' ? s.shake : !matchMedia('(prefers-reduced-motion: reduce)').matches,
      flashes: typeof s.flashes === 'boolean' ? s.flashes : true, quality: s.quality === 'low' ? 'low' : 'high' }
  } catch { return { ...DEFAULTS } }
}
function loadBest() { try { return Math.max(0, Number(localStorage.getItem('aeroburst.frontier.best')) || 0) } catch { return 0 } }
export const groundResolver: CollisionResolver = (pos, delta) => {
  const p = { x: pos.x + delta.x, y: pos.y + delta.y, z: pos.z + delta.z }
  const grounded = inField(p.x, p.z) && p.y <= 1.15
  if (grounded) p.y = 1.15
  return { position: p, grounded }
}

export class Game {
  mode: Mode = 'title'
  player = { ...SPAWN, vx: 0, vy: 0, vz: 0, yaw: Math.PI, grounded: true, jumps: 0 }
  checkpoint = { ...SPAWN }
  cameraYaw = 0
  cameraPitch = 0.22
  aimDirection: V3 | null = null
  hp = 150
  maxHp = 150
  energy = 0
  fuel = 100
  dashes = 3
  dashCharge = 0
  dashTime = 0
  dashDirection: V3 = { x: 0, y: 0, z: -1 }
  private blinkVictims = new Set<number>()
  boostHeld = 0
  boostExhausted = false
  boosting = false
  gateBoost = 0
  gateCooldown = 0
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
  wave = 1
  time = 0
  message = ''
  messageSub = ''
  messageTime = 0
  skillNotice = ''
  skillNoticeTime = 0
  locked = false
  pointerFallback = false
  target = -1
  objective = 0
  selectedObjective: number | null = null
  best = loadBest()
  settings = loadSettings()
  cooldowns = freshCooldowns()
  zones = freshZones()
  collected = new Set<number>()
  cyclone = 0
  shield = 0
  droneTime = 0
  overdrive = 0
  grappleTarget = -1
  grappleTime = 0
  private cyclonePulse = 0
  private dronePulse = 0
  environment = environmentAt(SPAWN.x, SPAWN.z, 0)
  tailwind = 0
  regeneration = 0
  armor = 0
  resonances = 0
  resonatorCooldowns = RESONATORS.map(() => 0)
  private weatherTimer = 3
  private previousBiome = 0
  private hazardCursor = 0
  readonly keys = new Set<string>()
  readonly actions: string[] = []
  readonly audio = new GameAudio()
  readonly enemies: Enemy[] = Array.from({ length: 64 }, (_, id) => ({
    id, active: false, kind: 'striker', zone: 0, x: 0, y: 1.15, z: 0, hp: 0, maxHp: 0,
    timer: 0, phase: 'approach', stun: 0, flash: 0, yaw: 0, vy: 0, attack: 0, aim: { x: 0, y: 0, z: 0 }, enraged: false,
  }))
  readonly particles: Particle[] = Array.from({ length: 480 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, color: '#7df3df', size: 0.1 }))
  readonly shots: Shot[] = Array.from({ length: 96 }, () => ({ x: 0, y: 0, z: 0, active: false, vx: 0, vy: 0, vz: 0, life: 0, friendly: false, damage: 14, homing: false, color: '#ff733a' }))
  readonly hazards: Hazard[] = Array.from({ length: 48 }, () => ({ active: false, kind: 'spores', zone: 0, start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 }, radius: 1, warning: 1, duration: 1, damage: 0, elapsed: 0, nextHit: 0 }))
  readonly effects: Effect[] = Array.from({ length: 48 }, () => ({ kind: 'ring', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 }, life: 0, duration: 1, color: '#9ffff3', radius: 1 }))
  private particleCursor = 0
  private effectCursor = 0
  private publishTime = 0
  private listeners = new Set<() => void>()
  private snapshot!: Snapshot

  constructor() { this.publish() }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.snapshot
  publish() {
    const boss = this.enemies.find(e => e.active && e.kind === 'boss')
    const warden = this.enemies.find(e => e.active && e.kind === 'warden' && distance(e, this.player) < 120)
    this.snapshot = {
      mode: this.mode, hp: this.hp, maxHp: this.maxHp, energy: this.energy, dashes: this.dashes, dashCharge: this.dashCharge, fuel: this.fuel,
      combo: this.combo, maxCombo: this.maxCombo, score: this.score, kills: this.kills, wave: this.wave,
      remaining: this.enemies.filter(e => e.active && e.zone === this.objective).length,
      time: this.time, message: this.message, messageSub: this.messageSub, bossHp: boss?.hp ?? 0, bossMaxHp: boss?.maxHp ?? 0,
      best: this.best, locked: this.locked, objective: this.objective, objectiveDistance: hdist(this.player, DISTRICTS[this.objective]),
      cleared: this.zones.filter(z => z.state === 'cleared').length, speed: Math.hypot(this.player.vx, this.player.vz),
      cooldowns: { ...this.cooldowns }, overdrive: this.overdrive, collected: this.collected.size,
      skillNotice: this.skillNotice, zones: this.zones.map(z => ({ ...z })), boosting: this.boosting,
      bossAttack: boss?.phase === 'windup' ? ['拡散砲 — 横へブリンク', '衝撃波 — ジャンプで回避', '突進 — 横へ回避', '全方位弾 — イージスで反射'][boss.attack % 4] : '',
      environment: { ...this.environment }, wardenHp: warden?.hp ?? 0, wardenMaxHp: warden?.maxHp ?? 0,
      wardenName: warden ? BIOMES[warden.zone].warden : '',
      wardenHint: warden ? warden.phase === 'recover' ? 'コア露出 — 攻撃のチャンス' : BIOMES[warden.zone].hint : '',
      buffs: [{ name: '追い風', time: this.tailwind }, { name: '再生', time: this.regeneration }, { name: '重装', time: this.armor }].filter(b => b.time > 0), resonances: this.resonances,
      blinkInterval: this.zones[0].state === 'cleared' ? .55 : .75,
    }
    this.listeners.forEach(l => l())
  }
  saveSettings(s: Settings) { this.settings = s; this.audio.volume = s.volume; try { localStorage.setItem('aeroburst.settings', JSON.stringify(s)) } catch { /* Optional. */ } this.publish() }
  announce(message: string, sub: string, seconds = 3) { this.message = message; this.messageSub = sub; this.messageTime = seconds }
  start() {
    Object.assign(this.player, { ...SPAWN, vx: 0, vy: 0, vz: 0, yaw: Math.PI, grounded: true, jumps: 0 })
    this.checkpoint = { ...SPAWN }; this.cameraYaw = 0; this.cameraPitch = 0.22; this.aimDirection = null
    this.hp = this.maxHp = 150; this.energy = 0; this.fuel = 100; this.dashes = 3; this.dashCharge = this.dashTime = 0
    this.invincible = 2; this.attackCooldown = this.slash = this.burst = this.hitstop = this.shake = this.damageFlash = 0
    this.combo = this.comboTime = this.maxCombo = this.score = this.kills = this.time = 0
    this.objective = 0; this.selectedObjective = null; this.wave = 1; this.pendingSlam = false; this.slam = 0
    this.cooldowns = freshCooldowns(); this.zones = freshZones(); this.collected.clear()
    this.environment = environmentAt(SPAWN.x, SPAWN.z, 0); this.previousBiome = 0; this.weatherTimer = 3
    this.tailwind = this.regeneration = this.armor = this.resonances = 0; this.resonatorCooldowns.fill(0); this.hazards.forEach(h => { h.active = false })
    this.cyclone = this.shield = this.droneTime = this.overdrive = this.grappleTime = this.boostHeld = this.gateBoost = this.gateCooldown = 0
    this.grappleTarget = -1; this.boosting = false; this.boostExhausted = false; this.skillNotice = ''; this.skillNoticeTime = 0
    this.enemies.forEach(e => { e.active = false }); this.shots.forEach(s => { s.active = false })
    this.particles.forEach(p => { p.life = 0 }); this.effects.forEach(e => { e.life = 0 }); this.keys.clear(); this.actions.length = 0
    this.mode = 'playing'; this.audio.unlock(); this.audio.volume = this.settings.volume
    this.activateZone(0); this.announce('FRONTIER / ONLINE', '5つの中枢を解放せよ。Shift長押しで高速ブースト。Mで全域マップ。', 5); this.publish()
  }
  pause() { if (this.mode === 'playing') { this.mode = 'paused'; this.keys.clear(); this.actions.length = 0; this.publish() } }
  resume() { if (this.mode === 'paused') { this.mode = 'playing'; this.publish() } }
  title() {
    this.mode = 'title'; this.keys.clear(); this.actions.length = 0
    this.enemies.forEach(e => { e.active = false }); this.shots.forEach(s => { s.active = false }); this.particles.forEach(p => { p.life = 0 }); this.effects.forEach(e => { e.life = 0 })
    this.slash = this.burst = this.cyclone = this.shield = this.droneTime = this.overdrive = this.slam = 0
    this.hazards.forEach(h => { h.active = false }); this.tailwind = this.regeneration = this.armor = 0
    Object.assign(this.player, { ...SPAWN, yaw: Math.PI }); this.publish()
  }
  action(action: string) { if (this.mode === 'playing' && this.actions.length < 20) this.actions.push(action) }
  activateZone(id: number) {
    const z = this.zones[id]
    if (z.state !== 'dormant' || this.enemies.filter(e => !e.active).length < DISTRICTS[id].count) return
    z.state = 'combat'; z.formation = 1; this.spawnFormation(id)
    this.announce(DISTRICTS[id].english, id === 5 ? '王座の守護機、起動。全スキルを解き放て。' : DISTRICTS[id].name + ' — 防衛部隊を撃破して中枢を解放。', 3); this.audio.play('wave')
  }
  spawnFormation(id: number) {
    const d = DISTRICTS[id], zone = this.zones[id], slots = this.enemies.filter(e => !e.active)
    if (slots.length < d.count) return false
    for (let i = 0; i < d.count; i++) {
      const kind: EnemyKind = id === 5 && i === 0 ? 'boss' : id < 5 && zone.formation === d.waves && i === 0 ? 'warden' : i % 5 === 1 ? 'specialist' : i % 8 === 7 ? 'brute' : i % 5 === 3 ? 'drone' : i % 4 === 2 ? 'gunner' : 'striker'
      const hp = kind === 'boss' ? 5600 : kind === 'warden' ? 1100 + id * 140 : kind === 'brute' ? 330 : kind === 'specialist' ? 190 : kind === 'gunner' ? 140 : kind === 'drone' ? 95 : 110
      const a = i / d.count * Math.PI * 2 + zone.formation * 0.8, r = kind === 'boss' ? 0 : 15 + i % 3 * 6
      Object.assign(slots[i], { active: true, kind, zone: id, x: d.x + Math.sin(a) * r, z: d.z + Math.cos(a) * r,
        y: kind === 'drone' ? 6 : kind === 'boss' ? 3.8 : kind === 'warden' ? 2.9 : kind === 'brute' ? 1.8 : 1.15,
        hp, maxHp: hp, timer: 1.2 + (i % 6) * 0.15, phase: 'approach', stun: 0, flash: 0, vy: 0, attack: 0, enraged: false })
    }
    return true
  }
  selectObjective(id: number) { if (this.zones[id]?.state !== 'locked' && this.zones[id]?.state !== 'cleared') { this.selectedObjective = id; this.objective = id; this.publish() } }
  updateZones(dt: number) {
    for (const d of DISTRICTS) {
      const z = this.zones[d.id]
      if (z.state === 'dormant' && hdist(this.player, d) < d.radius + 15) this.activateZone(d.id)
      if (z.state !== 'combat' || this.enemies.some(e => e.active && e.zone === d.id)) continue
      z.delay += dt
      if (z.delay < 1.6) continue
      if (z.formation < d.waves) {
        if (this.enemies.filter(e => !e.active).length < d.count) continue
        z.formation++; z.delay = 0; this.spawnFormation(d.id); this.announce('WARDEN INBOUND', BIOMES[d.id].warden + ' — 攻撃後のコア露出を狙え。', 3)
      } else {
        z.state = 'cleared'; this.score += 2500; this.maxHp += 15; this.hp = this.maxHp; this.fuel = 100
        this.checkpoint = { x: d.x, y: 2, z: d.z + 12 }
        this.effect('blast', { x: d.x, y: 5, z: d.z }, '#b7ffbd', 55, 1.4)
        this.hazards.forEach(h => { if (h.zone === d.id) h.active = false })
        this.announce('CORE LIBERATED', d.name + ' 解放 — ' + BIOMES[d.id].boon, 4); this.audio.play('wave')
        if (d.id === 5) { this.finish(true); return }
        if (this.selectedObjective === d.id) this.selectedObjective = null
        if (this.zones.slice(0, 5).every(v => v.state === 'cleared')) { this.zones[5].state = 'dormant'; this.selectedObjective = 5; this.announce('THE SKY THRONE', '全中枢を解放。北の王座で最終決戦へ。', 5) }
      }
    }
    const nearest = DISTRICTS.filter(d => this.zones[d.id].state !== 'cleared' && this.zones[d.id].state !== 'locked').sort((a, b) => hdist(this.player, a) - hdist(this.player, b))[0]
    this.objective = this.selectedObjective ?? nearest?.id ?? 5; this.wave = this.objective + 1
  }
  emit(pos: V3, color: string, count: number, speed = 12) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor++ % this.particles.length], life = 0.3 + Math.random() * 0.55
      Object.assign(p, { x: pos.x, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * speed, vy: (Math.random() - 0.1) * speed * 0.65,
        vz: (Math.random() - 0.5) * speed, life, maxLife: life, color, size: 0.08 + Math.random() * 0.22 })
    }
  }
  effect(kind: Effect['kind'], start: V3, color: string, radius: number, duration: number, end: V3 = start) {
    Object.assign(this.effects[this.effectCursor++ % this.effects.length], { kind, start: { x: start.x, y: start.y, z: start.z }, end: { x: end.x, y: end.y, z: end.z }, color, radius, duration, life: duration })
  }
  findTarget(range = 70) {
    const forward = viewDirection(this.cameraYaw, this.cameraPitch)
    let best = Infinity, target: Enemy | undefined
    for (const e of this.enemies) {
      if (!e.active) continue
      const d = distance(this.player, e), h = hdist(this.player, e) || 0.01
      const dot = ((e.x - this.player.x) * forward.x + (e.z - this.player.z) * forward.z) / h
      if (d > range || (dot < 0.12 && d > 6)) continue
      const weight = d * (1.4 - dot)
      if (weight < best) { best = weight; target = e }
    }
    return target
  }
  damageEnemy(e: Enemy, amount: number, launch = false) {
    if (!e.active) return
    const elite = e.kind === 'boss' || e.kind === 'warden'
    const damage = amount * (this.overdrive > 0 ? 1.65 : 1) * (e.kind === 'warden' ? e.phase === 'recover' ? 1.3 : .68 : 1)
    e.hp -= damage; e.flash = 0.13; e.stun = elite ? 0 : e.kind === 'brute' ? 0.06 : .12
    if (launch && !elite) e.vy = 17
    this.combo++; this.comboTime = 9; this.maxCombo = Math.max(this.maxCombo, this.combo); this.energy = clamp(this.energy + (this.zones[4].state === 'cleared' ? 3.2 : 2.5), 0, 100)
    this.score += Math.round(damage * (1 + Math.min(this.combo, 100) * 0.025)); this.shake = Math.max(this.shake, 0.12); this.hitstop = Math.max(this.hitstop, 0.027)
    this.emit(e, '#fff1b0', 5); this.audio.play('hit')
    if (e.hp <= 0) {
      e.active = false; this.kills++; this.score += e.kind === 'boss' ? 8000 : e.kind === 'warden' ? 3000 : e.kind === 'brute' ? 400 : 150
      this.dashes = 3; this.dashCharge = 0; this.fuel = clamp(this.fuel + 14, 0, 100); this.energy = clamp(this.energy + 5, 0, 100)
      this.hp = clamp(this.hp + (this.zones[1].state === 'cleared' ? 5 : 3), 0, this.maxHp); this.player.jumps = Math.min(this.player.jumps, 1)
      for (const skill of SKILLS) this.cooldowns[skill.id] = Math.max(0, this.cooldowns[skill.id] - 0.4)
      if (!this.player.grounded) this.player.vy = Math.max(this.player.vy, 4)
      this.emit(e, '#ff9871', e.kind === 'boss' ? 100 : 22, 22); this.effect('blast', e, '#ffd5a2', e.kind === 'boss' ? 24 : 3.5, 0.5); this.audio.play('kill')
    }
  }
  attack(heavy = false) {
    if (this.attackCooldown > 0) return
    this.attackCooldown = heavy ? 0.42 : this.overdrive > 0 ? 0.11 : 0.19; this.slash = heavy ? 0.3 : 0.2; this.slashType = heavy ? 1 : 0; this.slashSerial++; this.audio.play('slash')
    const target = this.findTarget(9)
    if (target) this.player.yaw = Math.atan2(target.x - this.player.x, target.z - this.player.z)
    if (heavy && !this.player.grounded) { this.player.vy = -48; this.pendingSlam = true; this.emit(this.player, '#affff8', 18); return }
    const finisher = !heavy && this.slashSerial % 3 === 0
    let hit = false
    for (const e of this.enemies) {
      if (!e.active) continue
      const dx = e.x - this.player.x, dz = e.z - this.player.z, d = distance(this.player, e)
      const dot = (dx * Math.sin(this.player.yaw) + dz * Math.cos(this.player.yaw)) / (Math.hypot(dx, dz) || 1)
      if (d < (e.kind === 'boss' ? 9 : finisher ? 8 : 6.5) && (dot > -0.4 || d < 3 || heavy || finisher)) { this.damageEnemy(e, heavy ? 55 : finisher ? 50 : 34, heavy); hit = true }
    }
    if (finisher) this.effect('ring', this.player, '#a1fff4', 8, 0.3)
    if (hit && heavy) { this.player.vy = 16; this.player.grounded = false; this.player.jumps = 1 }
    if (hit && !heavy && !this.player.grounded) this.player.vy = Math.max(this.player.vy, 3)
  }
  dash() {
    if (this.dashes < 1 || this.dashTime > 0) return
    // Blink is camera-directed, never target-directed. Grapple owns enemy homing.
    this.dashDirection = { ...(this.aimDirection ?? viewDirection(this.cameraYaw, this.cameraPitch)) }
    this.dashTime = 0.21; this.dashes--; this.invincible = Math.max(this.invincible, 0.34)
    this.player.yaw = Math.atan2(this.dashDirection.x, this.dashDirection.z); this.player.vy = 0
    this.grappleTime = 0; this.grappleTarget = -1; this.blinkVictims.clear()
    this.emit(this.player, '#73f5ff', 20); this.effect('ring', this.player, '#a3ffff', 4, 0.3); this.audio.play('dash')
  }
  jump() {
    if (this.player.jumps >= 2) return
    this.player.vy = this.player.jumps === 0 ? 17 : 15; this.player.jumps++; this.player.grounded = false; this.pendingSlam = false
    this.emit(this.player, '#dbfff6', 12); this.effect('ring', this.player, '#c4fff6', 3, 0.3); this.audio.play('jump')
  }
  cast(skill: Skill) {
    if (this.cooldowns[skill] > 0 || this.mode !== 'playing') return false
    const spec = SKILLS.find(s => s.id === skill)!, p = this.player, target = this.findTarget(70)
    if (skill === 'grapple' && !target) { this.skillNotice = 'GRAPPLE / 照準内・70m以内に敵が必要'; this.skillNoticeTime = 1.2; return false }
    this.cooldowns[skill] = spec.cooldown; this.skillNotice = spec.name; this.skillNoticeTime = 1.4
    this.audio.play(skill === 'lance' ? 'lance' : skill === 'aegis' ? 'shield' : skill === 'overdrive' ? 'burst' : 'skill')
    if (skill === 'grapple' && target) { this.grappleTarget = target.id; this.grappleTime = 0.9; this.dashTime = 0; this.pendingSlam = false; this.invincible = 0.65; this.effect('beam', p, '#aeffca', 0.07, 0.5, target) }
    if (skill === 'cyclone') { this.cyclone = 1.6; this.cyclonePulse = 0; this.invincible = Math.max(this.invincible, 0.5); this.effect('ring', p, '#78fff0', 17, 0.65) }
    if (skill === 'lance') {
      const dir = this.aimDirection ?? viewDirection(this.cameraYaw, this.cameraPitch), from = { x: p.x, y: p.y + 0.8, z: p.z }
      const end = { x: from.x + dir.x * 80, y: from.y + dir.y * 80, z: from.z + dir.z * 80 }
      this.effect('beam', from, '#fff3b5', 0.8, 0.45, end); this.shake = 0.25
      for (const e of this.enemies) {
        if (!e.active) continue
        const dx = e.x - from.x, dy = e.y - from.y, dz = e.z - from.z, t = dx * dir.x + dy * dir.y + dz * dir.z
        if (t > -2 && t < 80 && Math.hypot(dx - dir.x * t, dy - dir.y * t, dz - dir.z * t) < (e.kind === 'boss' ? 6 : 4)) this.damageEnemy(e, 170)
      }
    }
    if (skill === 'aegis') { this.shield = 2.5; this.effect('ring', p, '#9cbfff', 5, 0.5) }
    if (skill === 'drones') { this.droneTime = 8; this.dronePulse = 0 }
    if (skill === 'overdrive') { this.overdrive = 8; this.fuel = 100; this.dashes = 3; this.effect('blast', p, '#ffe9a4', 12, 0.7) }
    return true
  }
  ultimate() {
    if (this.energy < 100) return
    this.energy = 0; this.burst = 1.3; this.burstOrigin = { ...this.player }; this.invincible = 1.6; this.shake = 0.7
    this.audio.play('burst'); this.emit(this.player, '#c7fff2', 100, 42); this.effect('blast', this.player, '#d8fff2', 48, 1.1); this.effect('ring', this.player, '#ffffff', 50, 0.9)
    for (const e of this.enemies) if (e.active && distance(e, this.player) < 48) this.damageEnemy(e, 380, true)
    this.energy = 0; this.hitstop = 0.12; this.shots.forEach(s => { if (distance(s, this.player) < 60) s.active = false })
    this.announce('AEROBURST', 'LIMIT BREAK / 空域を、一掃。', 1.6)
  }
  hurt(damage: number) {
    if (this.invincible > 0 || this.mode !== 'playing') return
    if (this.shield > 0) {
      this.invincible = 0.3; this.effect('blast', this.player, '#b7d9ff', 13, 0.4); this.skillNotice = 'PERFECT GUARD'; this.skillNoticeTime = 1; this.energy = clamp(this.energy + 10, 0, 100)
      for (const e of this.enemies) if (e.active && distance(e, this.player) < 13) this.damageEnemy(e, 55)
      this.audio.play('shield'); return
    }
    this.hp = Math.max(0, this.hp - damage * (this.armor > 0 ? .5 : 1)); this.invincible = 0.65; this.combo = Math.floor(this.combo * 0.7); this.damageFlash = 0.4; this.shake = 0.3
    this.audio.play('hurt'); this.emit(this.player, '#ff8563', 10); if (this.hp <= 0) this.finish(false)
  }
  finish(won: boolean) {
    this.mode = won ? 'won' : 'lost'; this.keys.clear(); this.actions.length = 0
    if (won) this.score += Math.round(Math.max(0, 900 - this.time) * 10)
    this.best = Math.max(this.best, this.score); try { localStorage.setItem('aeroburst.frontier.best', String(this.best)) } catch { /* Optional. */ } this.publish()
  }
  fire(e: Enemy, offset = 0) {
    const s = this.shots.find(s => !s.active); if (!s) return
    const dx = e.aim.x - e.x, dy = e.aim.y - e.y, dz = e.aim.z - e.z, length = Math.hypot(dx, dy, dz) || 1
    const speed = e.kind === 'boss' ? 29 : e.zone === 3 ? 16 : 23, angle = Math.atan2(dx, dz) + offset
    Object.assign(s, { active: true, x: e.x, y: e.y, z: e.z, vx: Math.sin(angle) * speed, vy: dy / length * speed, vz: Math.cos(angle) * speed,
      life: 5, friendly: false, damage: e.kind === 'boss' ? 19 : 14, homing: e.zone === 3, color: BIOMES[e.zone].color })
  }
  queueHazard(spec: HazardSpec) {
    Object.assign(this.hazards[this.hazardCursor++ % this.hazards.length], spec, { active: true, elapsed: 0, nextHit: 0 })
  }
  regionalAttack(e: Enemy) {
    for (const hazard of attackPattern(e.zone, e, e.aim, e.kind === 'warden' || e.kind === 'boss', e.attack++)) this.queueHazard(hazard)
    if (e.zone === 3) { this.fire(e, -.15); this.fire(e, .15) }
  }
  consumeResonator(id: number) {
    if (this.resonatorCooldowns[id] > 0) return false
    const item = RESONATORS[id]; if (!item) return false
    this.resonatorCooldowns[id] = 30; this.resonances++
    if (item.zone === 0) { this.tailwind = 12; this.fuel = 100 }
    if (item.zone === 1) { this.hp = Math.min(this.maxHp, this.hp + 30); this.regeneration = 8 }
    if (item.zone === 2) this.armor = 10
    if (item.zone === 3) for (const skill of SKILLS) this.cooldowns[skill.id] *= .5
    if (item.zone === 4) { this.overdrive = Math.max(this.overdrive, 6); this.energy = clamp(this.energy + 20, 0, 100) }
    if (item.zone === 5) { this.shield = Math.max(this.shield, 4); this.fuel = 100; this.dashes = 3 }
    this.skillNotice = BIOMES[item.zone].item + ' / ' + BIOMES[item.zone].itemHint; this.skillNoticeTime = 3
    this.effect('ring', item, BIOMES[item.zone].color, 7, .6); this.audio.play('wave'); return true
  }
  updateEnvironment(dt: number) {
    const env = this.environment = environmentAt(this.player.x, this.player.z, this.time)
    if (env.zone !== this.previousBiome) {
      this.previousBiome = env.zone; this.weatherTimer = 3
      if (env.zone >= 0) this.announce(BIOMES[env.zone].name, BIOMES[env.zone].rule, 3)
    }
    this.resonatorCooldowns = this.resonatorCooldowns.map(t => Math.max(0, t - dt))
    for (const item of RESONATORS) if (distance(this.player, item) < 3) this.consumeResonator(item.id)
    if (this.regeneration > 0) this.hp = Math.min(this.maxHp, this.hp + dt * 4)
    if (env.zone >= 0 && env.weight > .6 && this.zones[env.zone].state !== 'cleared' && (this.weatherTimer -= dt) <= 0) {
      this.weatherTimer = env.zone === 4 ? 4.5 : 8
      const p = this.player, origin = DISTRICTS[env.zone]
      if (env.zone === 4) this.queueHazard({ kind: 'lightning', zone: 4, start: { x: p.x, y: .15, z: p.z }, end: { x: p.x, y: 35, z: p.z }, radius: 5, warning: 1.35, duration: .35, damage: 24 })
      if (env.zone === 5) this.queueHazard({ kind: 'shockwave', zone: 5, start: { x: origin.x, y: .15, z: origin.z }, end: { x: origin.x, y: 0, z: origin.z }, radius: 60, warning: 1.4, duration: 2.8, damage: 20 })
    }
  }
  updateHazards(dt: number) {
    const p = this.player
    for (const h of this.hazards) {
      if (!h.active) continue
      h.elapsed += dt
      if (h.elapsed > h.warning + h.duration) { h.active = false; continue }
      if (h.elapsed < h.warning) continue
      if (h.kind === 'well' && this.dashTime <= 0 && this.grappleTime <= 0) {
        const d = Math.hypot(p.x - h.start.x, p.z - h.start.z)
        if (d < h.radius && d > .5 && p.y < 30) {
          const pull = 22 * (1 - d / h.radius)
          p.vx += (h.start.x - p.x) / d * pull * dt * 16; p.vz += (h.start.z - p.z) / d * pull * dt * 16
        }
      }
      if (h.elapsed >= h.nextHit && hazardTouches(h, p)) {
        h.nextHit = h.elapsed + .8; this.hurt(h.damage)
        if (h.kind === 'wind' && this.dashTime <= 0 && this.grappleTime <= 0 && this.shield <= 0) {
          const dx = h.end.x - h.start.x, dz = h.end.z - h.start.z, len = Math.hypot(dx, dz) || 1
          p.vx += dx / len * 18; p.vz += dz / len * 18; p.vy = Math.max(p.vy, 5)
        }
      }
    }
  }
  updateEnemy(e: Enemy, dt: number) {
    if (!e.active) return
    const p = this.player, boss = e.kind === 'boss', brute = e.kind === 'brute', warden = e.kind === 'warden', specialist = e.kind === 'specialist', floor = boss ? 3.8 : warden ? 2.9 : brute ? 1.8 : 1.15
    e.flash = Math.max(0, e.flash - dt); e.stun = Math.max(0, e.stun - dt)
    if (e.vy !== 0 || (e.kind !== 'drone' && e.y > floor)) { e.vy -= 24 * environmentAt(e.x, e.z, this.time).gravity * dt; e.y += e.vy * dt; if (e.y < floor) { e.y = floor; e.vy = 0 } }
    if (e.stun > 0 || hdist(e, p) > 135) return
    if (boss && !e.enraged && e.hp < e.maxHp * 0.5) { e.enraged = true; this.announce('GUARDIAN / OVERLOAD', '第2形態 — 攻撃間隔短縮。イージスで弾幕を反射せよ。', 3); this.effect('blast', e, '#ff9e70', 30, 1) }
    e.timer -= dt * (e.enraged ? 1.4 : 1)
    const dx = p.x - e.x, dz = p.z - e.z, h = Math.hypot(dx, dz) || 0.01; e.yaw = Math.atan2(dx, dz)
    if (e.phase === 'approach') {
      const preferred = specialist ? 26 : warden ? 17 : e.kind === 'gunner' ? 23 : e.kind === 'drone' ? 14 : boss ? 10 : brute ? 5 : 3.4
      if (h > preferred) { const speed = boss || warden ? 8 : brute ? 6 : e.kind === 'striker' ? 10 : 5; e.x += dx / h * speed * dt; e.z += dz / h * speed * dt }
      if ((e.kind === 'gunner' || specialist) && h < 12) { e.x -= dx / h * 5 * dt; e.z -= dz / h * 5 * dt }
      if ((e.kind === 'gunner' || specialist) && h < 40) { const side = e.id % 2 ? 1 : -1; e.x += dz / h * side * 3 * dt; e.z -= dx / h * side * 3 * dt }
      if (e.kind === 'drone' && !e.vy) e.y = 6 + Math.sin(this.time * 2 + e.id) * 1.3
      if (e.timer <= 0 && (h < preferred + 4 || e.kind === 'gunner' || e.kind === 'drone' || specialist || warden)) { e.phase = 'windup'; e.timer = boss || warden ? 1 : brute ? .9 : .6; e.aim = { x: p.x, y: p.y, z: p.z } }
    } else if (e.phase === 'windup' && e.timer <= 0) {
      if (specialist || warden) this.regionalAttack(e)
      else if (e.kind === 'striker' || brute) { if (h < (brute ? 8 : 5) && Math.abs(p.y - e.y) < 4) this.hurt(brute ? 28 : 15); if (brute) this.effect('ring', e, '#ff9674', 8, 0.4) }
      else if (boss) {
        const attack = e.attack++ % 4
        if (attack === 0) for (let i = -3; i <= 3; i++) this.fire(e, i * 0.13)
        if (attack === 1) { this.effect('ring', { x: e.x, y: 0.3, z: e.z }, '#ff9760', 24, 0.8); if (h < 24 && p.y < 5) this.hurt(32) }
        if (attack === 2) { const travel = Math.min(h, 24); e.x += dx / h * travel; e.z += dz / h * travel; if (hdist(e, p) < 8 && Math.abs(p.y - e.y) < 5) this.hurt(28); this.effect('blast', e, '#ffa872', 10, 0.5) }
        if (attack === 3) for (let i = 0; i < 20; i++) this.fire(e, i * Math.PI / 10)
        if (e.enraged) for (const hazard of attackPattern(5, e, e.aim, true, e.attack)) this.queueHazard(hazard)
      } else this.fire(e)
      e.phase = 'recover'; e.timer = warden ? 2.2 : specialist ? 1.8 : boss ? .9 : 1.05
    } else if (e.phase === 'recover' && e.timer <= 0) { e.phase = 'approach'; e.timer = 0.2 }
    const home = DISTRICTS[e.zone], r = hdist(e, home), leash = home.radius + 12
    if (r > leash) { e.x = home.x + (e.x - home.x) / r * leash; e.z = home.z + (e.z - home.z) / r * leash }
  }
  tick(dt: number, resolve: CollisionResolver = groundResolver) {
    if (this.mode !== 'playing') return
    this.time += dt
    this.updateEnvironment(dt)
    if ((this.messageTime -= dt) <= 0) { this.message = ''; this.messageSub = '' }
    if ((this.skillNoticeTime -= dt) <= 0) this.skillNotice = ''
    for (const name of ['invincible', 'attackCooldown', 'slash', 'burst', 'slam', 'shake', 'damageFlash', 'shield', 'droneTime', 'overdrive', 'gateBoost', 'gateCooldown', 'tailwind', 'regeneration', 'armor'] as const) this[name] = Math.max(0, this[name] - dt)
    for (const skill of SKILLS) this.cooldowns[skill.id] = Math.max(0, this.cooldowns[skill.id] - dt * (this.overdrive > 0 ? 1.5 : 1) * (this.zones[3].state === 'cleared' ? 1.18 : 1))
    if (this.dashes < 3 && (this.dashCharge += dt) >= (this.zones[0].state === 'cleared' ? .55 : .75)) { this.dashes++; this.dashCharge = 0 }
    if (this.combo > 0 && (this.comboTime -= dt) <= 0) this.combo = 0
    for (const action of this.actions.splice(0)) {
      if (action === 'jump') this.jump(); else if (action === 'dash') this.dash(); else if (action === 'attack') this.attack()
      else if (action === 'heavy') this.attack(true); else if (action === 'burst') this.ultimate(); else if (SKILLS.some(s => s.id === action)) this.cast(action as Skill)
    }
    if (this.keys.has('Mouse0')) this.attack()
    const step = this.hitstop > 0 ? dt * 0.15 : dt; this.hitstop = Math.max(0, this.hitstop - dt)
    const p = this.player, env = this.environment, held = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    if (this.fuel <= 0) this.boostExhausted = true
    if (this.fuel >= 35 || this.overdrive > 0 || this.gateBoost > 0 || this.tailwind > 0) this.boostExhausted = false
    this.boostHeld = held ? this.boostHeld + dt : 0; this.boosting = (this.boostHeld > 0.25 && !this.boostExhausted) || this.gateBoost > 0
    this.fuel = clamp(this.fuel + (this.boosting && this.overdrive <= 0 && this.gateBoost <= 0 && this.tailwind <= 0 ? -16 * env.fuel : 22) * dt, 0, 100)
    if (this.grappleTime > 0) {
      const e = this.enemies[this.grappleTarget]; this.grappleTime -= step
      if (!e?.active) this.grappleTime = 0
      else { const d = distance(e, p); if (d < 4) { this.damageEnemy(e, 70, true); this.grappleTime = 0; p.vx *= 0.1; p.vz *= 0.1; p.vy = 7 }
        else { const speed = Math.min(100, d / step); p.vx = (e.x - p.x) / d * speed; p.vy = (e.y - p.y) / d * speed; p.vz = (e.z - p.z) / d * speed; p.yaw = Math.atan2(p.vx, p.vz) } }
    } else if (this.dashTime > 0) {
      this.dashTime = Math.max(0, this.dashTime - step); p.vx = this.dashDirection.x * 100; p.vy = this.dashDirection.y * 100; p.vz = this.dashDirection.z * 100
      if (this.dashTime === 0) { p.vx *= 0.12; p.vz *= 0.12; p.vy = clamp(p.vy, -4, 4) } this.emit(p, '#77f9ff', 3, 3)
    } else {
      const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')) || (this.boosting ? 1 : 0)
      const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')), len = Math.hypot(forward, side) || 1
      const speed = (this.boosting ? this.gateBoost > 0 ? 68 : 46 : this.overdrive > 0 ? 23 : 17) * env.speed
      const vx = (-Math.sin(this.cameraYaw) * forward + Math.cos(this.cameraYaw) * side) / len * speed + env.windX * (p.grounded ? .35 : 1)
      const vz = (-Math.cos(this.cameraYaw) * forward - Math.sin(this.cameraYaw) * side) / len * speed + env.windZ * (p.grounded ? .35 : 1)
      const blend = 1 - Math.exp(-16 * step); p.vx += (vx - p.vx) * blend; p.vz += (vz - p.vz) * blend
      if (forward || side) p.yaw = Math.atan2(p.vx, p.vz)
      const gliding = !p.grounded && !this.pendingSlam && (this.boosting || this.keys.has('Space'))
      p.vy -= (gliding ? 7 : 30) * env.gravity * step
      if (gliding) p.vy = Math.max(p.vy, this.keys.has('Space') && this.boosting && p.y < 38 ? 9 / Math.sqrt(env.gravity) : -2.5 * env.gravity)
      if (env.zone === 0 && !this.pendingSlam && p.y < 34 && UPDRAFTS.some(u => hdist(p, u) < u.radius)) { p.vy = Math.max(p.vy, 12); this.fuel = Math.min(100, this.fuel + 28 * step); p.jumps = Math.min(p.jumps, 1) }
      if (this.boosting) this.emit({ x: p.x, y: p.y - 0.3, z: p.z }, this.overdrive > 0 ? '#ffdf9b' : '#6deaf9', 2, 3)
    }
    const previous = { x: p.x, y: p.y, z: p.z }, moved = resolve(p, { x: p.vx * step, y: p.vy * step, z: p.vz * step })
    Object.assign(p, moved.position); p.grounded = moved.grounded
    if (p.grounded && p.vy <= 0) { p.vy = 0; p.jumps = 0 }
    if (this.dashTime > 0) for (const e of this.enemies) if (e.active && !this.blinkVictims.has(e.id) && (distance(e, p) < 4 || distance(e, previous) < 4)) { this.blinkVictims.add(e.id); this.damageEnemy(e, 45) }
    if (p.grounded && this.pendingSlam) {
      this.pendingSlam = false; this.slam = 0.5; this.burstOrigin = { ...p }; this.shake = 0.35; this.emit(p, '#a4f7ed', 45, 24)
      const radius = this.zones[2].state === 'cleared' ? 18 : 14
      const impact = (this.zones[2].state === 'cleared' ? 140 : 110) * (env.zone === 2 ? 1.4 : 1)
      this.effect('ring', p, '#b4fff4', radius, 0.5); this.audio.play('skill'); for (const e of this.enemies) if (e.active && distance(e, p) < radius) this.damageEnemy(e, impact, true)
    }
    if (p.y > 65) p.vy = Math.min(p.vy, -5)
    if (p.y < -24 || Math.abs(p.x) > FIELD.width / 2 + 60 || p.z < FIELD.minZ - 60 || p.z > FIELD.maxZ + 60) {
      Object.assign(p, this.checkpoint, { y: 5, vx: 0, vy: 0, vz: 0 }); this.pendingSlam = false; this.dashTime = this.grappleTime = 0
      this.invincible = 0; this.shield = 0; this.hurt(20); this.announce('FLIGHT RECOVERY', '最寄りの解放済み中枢へ復帰。耐久 −20', 2)
    }
    for (const pad of LAUNCH_PADS) if (p.grounded && hdist(p, pad) < 3) { p.vy = 29; p.grounded = false; p.jumps = 1; this.fuel = 100; this.emit(p, '#b9ffbf', 24); this.audio.play('jump') }
    if (this.gateCooldown <= 0) for (const gate of BOOST_GATES) if (hdist(p, gate) < 5 && p.y < 14) { this.fuel = 100; this.gateBoost = 2; this.gateCooldown = 3; this.comboTime = 9; this.effect('ring', p, '#caffc2', 7, 0.5); this.audio.play('dash'); break }
    for (const cache of CACHES) if (!this.collected.has(cache.id) && distance(p, cache) < 4) {
      this.collected.add(cache.id); this.score += 700; this.energy = clamp(this.energy + 25, 0, 100); this.fuel = 100; this.hp = clamp(this.hp + 15, 0, this.maxHp)
      this.emit(cache, '#ffe1a1', 22); this.audio.play('kill'); this.skillNotice = 'DATA CACHE / ' + this.collected.size + ' OF ' + CACHES.length; this.skillNoticeTime = 2
    }
    if (this.cyclone > 0) {
      this.cyclone -= step; this.cyclonePulse -= step
      for (const e of this.enemies) if (e.active && e.kind !== 'boss' && e.kind !== 'warden' && distance(e, p) < 19) { e.x += (p.x - e.x) * step * 2; e.z += (p.z - e.z) * step * 2 }
      if (this.cyclonePulse <= 0) { this.cyclonePulse = 0.25; this.effect('ring', p, '#8affdf', 17, 0.35); for (const e of this.enemies) if (e.active && distance(e, p) < 18) this.damageEnemy(e, 25, this.cyclone < 0.3) }
    }
    if (this.droneTime > 0 && (this.dronePulse -= step) <= 0) {
      this.dronePulse = 0.32
      this.enemies.filter(e => e.active && distance(e, p) < 42).sort((a, b) => distance(a, p) - distance(b, p)).slice(0, 2).forEach((e, i) => {
        this.effect('beam', { x: p.x + (i ? 2 : -2), y: p.y + 2, z: p.z }, '#d6c3ff', 0.06, 0.2, e); this.damageEnemy(e, 22)
      })
    }
    if (this.mode === 'playing') for (const e of this.enemies) this.updateEnemy(e, step)
    this.updateHazards(dt)
    for (const s of this.shots) {
      if (!s.active) continue
      if (s.homing && !s.friendly) {
        const d = distance(s, p) || 1, speed = Math.hypot(s.vx, s.vy, s.vz)
        const turn = Math.min(1, step * 1.2)
        s.vx += ((p.x - s.x) / d * speed - s.vx) * turn; s.vy += ((p.y - s.y) / d * speed - s.vy) * turn; s.vz += ((p.z - s.z) / d * speed - s.vz) * turn
      }
      s.x += s.vx * step; s.y += s.vy * step; s.z += s.vz * step; s.life -= step
      if (!s.friendly && this.shield > 0 && distance(s, p) < 5) { s.friendly = true; s.vx *= -1.7; s.vy *= -1.7; s.vz *= -1.7; s.life = 3; this.effect('ring', s, '#bddaff', 2, 0.25); this.audio.play('shield') }
      if (s.friendly) { for (const e of this.enemies) if (e.active && distance(e, s) < (e.kind === 'boss' ? 5 : 2.5)) { this.damageEnemy(e, 100); s.active = false; break } }
      else if (distance(s, p) < 1.4) { this.hurt(s.damage); s.active = false }
      if (s.life <= 0 || s.y < 0) s.active = false
    }
    for (const v of this.particles) if (v.life > 0) { v.life -= dt; v.x += v.vx * dt; v.y += v.vy * dt; v.z += v.vz * dt; v.vy -= 12 * dt }
    for (const e of this.effects) e.life = Math.max(0, e.life - dt)
    this.target = this.findTarget()?.id ?? -1
    if (this.mode === 'playing') this.updateZones(dt)
    this.publishTime += dt; if (this.publishTime > 0.075) { this.publishTime = 0; this.publish() }
  }
}
export const game = new Game()
