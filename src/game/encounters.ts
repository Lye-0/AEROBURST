import type { V3 } from './core'
import { BIOMES } from './biomes'

export type HazardKind = 'wind' | 'spores' | 'beam' | 'well' | 'lightning' | 'shockwave'
export type HazardSpec = { kind: HazardKind; zone: number; start: V3; end: V3; radius: number; warning: number; duration: number; damage: number }
export type Hazard = HazardSpec & { active: boolean; elapsed: number; nextHit: number }

export function attackPattern(zone: number, origin: V3, aim: V3, elite: boolean, sequence: number): HazardSpec[] {
  const damage = BIOMES[zone].damage * (elite ? 1.3 : 1)
  const ground = { x: aim.x, y: .15, z: aim.z }
  const h = Math.hypot(aim.x - origin.x, aim.z - origin.z) || 1
  const dx = (aim.x - origin.x) / h, dz = (aim.z - origin.z) / h
  const make = (kind: HazardKind, start: V3, end: V3, radius: number, warning: number, duration: number): HazardSpec => ({ kind, zone, start: { ...start }, end: { ...end }, radius, warning, duration, damage })
  const line = (kind: 'beam' | 'wind', offset: number, delay: number) => make(kind,
    { x: origin.x + dz * offset, y: aim.y, z: origin.z - dx * offset },
    { x: origin.x + dx * 70 + dz * offset, y: aim.y, z: origin.z + dz * 70 - dx * offset },
    kind === 'wind' ? 4 : 2.8, .9 + delay, kind === 'wind' ? .75 : .3)
  if (zone === 0) return elite
    ? [line('wind', -7, 0), line('wind', 7, .25), make('shockwave', origin, origin, 20, 1.1, 1.2)]
    : [line('wind', 0, 0)]
  if (zone === 1) return (elite ? [-1, 0, 1] : [0]).map((side, i) => make('spores', { ...ground, x: ground.x + side * 8, z: ground.z + (i % 2) * 5 }, ground, elite ? 6 : 4.5, 1 + i * .15, 4))
  if (zone === 2) return elite
    ? [line('beam', -7, 0), line('beam', 0, .25), line('beam', 7, .5), make('beam', { x: ground.x - 22, y: aim.y, z: ground.z }, { x: ground.x + 22, y: aim.y, z: ground.z }, 2.8, 1.35, .35)]
    : [line('beam', 0, 0)]
  if (zone === 3) return elite
    ? [make('well', ground, ground, 14, 1.1, 4.5), make('well', { x: ground.x + dz * 18, y: .15, z: ground.z - dx * 18 }, ground, 11, 1.4, 3.5)]
    : [make('well', ground, ground, 9, 1.2, 3)]
  if (zone === 4) return Array.from({ length: elite ? 6 : 2 }, (_, i) => {
    const a = i * 2.4 + sequence, r = i === 0 ? 0 : elite ? 12 : 7
    return make('lightning', { x: ground.x + Math.sin(a) * r, y: .15, z: ground.z + Math.cos(a) * r }, ground, 4.5, .9 + i * .22, .3)
  })
  return sequence % 2 ? [line('beam', 0, 0), make('shockwave', origin, origin, 24, 1.1, 1.4)] : [make('well', ground, ground, 12, 1, 3.5)]
}

export function distanceToSegment(point: V3, start: V3, end: V3) {
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / (dx * dx + dy * dy + dz * dz || 1)))
  return Math.hypot(point.x - start.x - dx * t, point.y - start.y - dy * t, point.z - start.z - dz * t)
}
export function hazardTouches(hazard: Hazard, point: V3) {
  const activeTime = hazard.elapsed - hazard.warning
  if (!hazard.active || activeTime < 0 || activeTime > hazard.duration) return false
  const d = Math.hypot(point.x - hazard.start.x, point.z - hazard.start.z)
  if (hazard.kind === 'beam' || hazard.kind === 'wind') return distanceToSegment(point, hazard.start, hazard.end) < hazard.radius
  if (hazard.kind === 'lightning') return d < hazard.radius && point.y < 65
  if (hazard.kind === 'shockwave') return Math.abs(d - hazard.radius * activeTime / hazard.duration) < 2.2 && point.y < 4.5
  if (hazard.kind === 'well') return d < hazard.radius * .35 && point.y < 30
  return d < hazard.radius && point.y < 4.5
}
