import { beforeEach, describe, expect, it } from 'vitest'
import { Game, groundResolver, viewDirection, type Enemy } from './core'
import { CACHES, DISTRICTS, FIELD, SPAWN } from './world'

let game: Game
function advance(seconds: number) { for (let i = 0; i < seconds * 60; i++) game.tick(1 / 60) }
function enemyInFront(hp = 300): Enemy {
  game.enemies.forEach(e => { e.active = false })
  const e = game.enemies[0]
  Object.assign(e, { active: true, zone: 0, x: 0, y: 1.15, z: SPAWN.z - 3, hp, maxHp: hp, timer: 100, kind: 'striker', phase: 'approach' })
  return e
}
beforeEach(() => { game = new Game(); game.start() })

describe('view-directed blink', () => {
  it('ignores nearby enemies and WASD, blinking along the view vector', () => {
    const e = enemyInFront(); e.x = 8
    game.cameraYaw = 0; game.cameraPitch = 0; game.keys.add('KeyA')
    game.dash()
    expect(game.dashDirection).toEqual({ x: -0, y: -0, z: -1 })
    advance(.15)
    expect(game.player.x).toBeCloseTo(0)
    expect(game.player.z).toBeLessThan(SPAWN.z - 10)
  })
  it('includes upward and downward pitch', () => {
    game.player.y = 25; game.cameraPitch = -Math.PI / 4; game.dash()
    expect(game.dashDirection.y).toBeCloseTo(Math.SQRT1_2)
    advance(.1); expect(game.player.y).toBeGreaterThan(30)
    game.dashTime = 0; game.cameraPitch = Math.PI / 4; game.dash()
    expect(game.dashDirection.y).toBeCloseTo(-Math.SQRT1_2)
  })
  it('uses the actually rendered camera direction when available', () => {
    game.aimDirection = { x: 1, y: 0, z: 0 }
    game.dash(); expect(game.dashDirection).toEqual({ x: 1, y: 0, z: 0 })
    advance(.1); expect(game.player.x).toBeGreaterThan(8)
  })
  it('normalizes yaw and pitch into a unit vector', () => {
    const v = viewDirection(1.2, -.7)
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1)
  })
  it('respects collision correction instead of teleporting through a wall', () => {
    game.cameraPitch = 0; game.dash()
    game.tick(1 / 60, position => ({ position: { ...position }, grounded: true }))
    expect(game.player.z).toBe(SPAWN.z)
  })
})

describe('movement and recovery', () => {
  it('moves relative to the camera and freezes during pause', () => {
    game.keys.add('KeyW'); advance(.5); expect(game.player.z).toBeLessThan(SPAWN.z - 5)
    game.pause(); const z = game.player.z, time = game.time; advance(1)
    expect(game.player.z).toBe(z); expect(game.time).toBe(time); expect(game.keys.size).toBe(0)
  })
  it('allows two jumps and resets on landing', () => {
    game.enemies.forEach(e => { e.timer = 999 })
    game.jump(); advance(.1); game.jump(); const vy = game.player.vy
    game.jump(); expect(game.player.vy).toBe(vy); expect(game.player.jumps).toBe(2)
    advance(3); expect(game.player.grounded).toBe(true); expect(game.player.jumps).toBe(0)
  })
  it('has three blink charges with a recharge interval', () => {
    game.dash(); expect(game.dashes).toBe(2); game.dash(); expect(game.dashes).toBe(2)
    advance(.3); game.dash(); expect(game.dashes).toBe(1)
    advance(1.6); expect(game.dashes).toBe(3)
  })
  it('boosts faster than running and consumes fuel', () => {
    game.keys.add('ShiftLeft'); game.keys.add('KeyW'); advance(1)
    expect(game.boosting).toBe(true); expect(Math.abs(game.player.vz)).toBeGreaterThan(40); expect(game.fuel).toBeLessThan(100)
  })
  it('respawns at the last checkpoint after falling', () => {
    game.checkpoint = { x: -205, y: 2, z: -23 }
    game.player.x = 500; game.player.y = -30; game.tick(1 / 60)
    expect(game.player.x).toBe(-205); expect(game.hp).toBe(130)
  })
  it('recharges an exhausted boost before restarting rather than flickering every frame', () => {
    game.fuel = 0; game.keys.add('ShiftLeft'); advance(.5)
    expect(game.boostExhausted).toBe(true); expect(game.boosting).toBe(false)
    advance(1.3); expect(game.boosting).toBe(true)
  })
  it('has solid ground across the large field and an actual edge', () => {
    expect(groundResolver({ x: 300, y: 1.15, z: -600 }, { x: 0, y: -1, z: 0 }).grounded).toBe(true)
    expect(groundResolver({ x: FIELD.width, y: 1.15, z: 0 }, { x: 0, y: -1, z: 0 }).grounded).toBe(false)
  })
})

describe('combat and skills', () => {
  it('requires attack range and enforces attack cooldown', () => {
    const e = enemyInFront(); game.attack(); expect(e.hp).toBe(266)
    game.attack(); expect(e.hp).toBe(266)
    game.attackCooldown = 0; e.z -= 50; game.attack(); expect(e.hp).toBe(266)
  })
  it('launches the target and pilot for aerial combat', () => {
    const e = enemyInFront(); game.attack(true)
    expect(e.vy).toBeGreaterThan(0); expect(game.player.vy).toBeGreaterThan(0); expect(game.player.grounded).toBe(false)
  })
  it('awards kills, restores charges, heals and shortens skill cooldowns', () => {
    const e = enemyInFront(20); game.dashes = 0; game.hp = 70; game.cooldowns.lance = 4; game.attack()
    expect(e.active).toBe(false); expect(game.dashes).toBe(3); expect(game.hp).toBe(73); expect(game.cooldowns.lance).toBeCloseTo(3.6)
  })
  it('requires and consumes a full ultimate gauge', () => {
    const e = enemyInFront(600); game.energy = 99; game.ultimate(); expect(e.hp).toBe(600)
    game.energy = 100; game.ultimate(); expect(e.hp).toBe(220); expect(game.energy).toBe(0)
  })
  it('applies dive damage at landing', () => {
    const e = enemyInFront(300); game.player.y = 7; game.player.grounded = false; game.player.jumps = 1
    game.attack(true); expect(e.hp).toBe(300); expect(game.pendingSlam).toBe(true)
    advance(.4); expect(game.pendingSlam).toBe(false); expect(e.hp).toBe(190)
  })
  it('grapples to enemies but does not consume cooldown without a target', () => {
    game.enemies.forEach(e => { e.active = false })
    expect(game.cast('grapple')).toBe(false); expect(game.cooldowns.grapple).toBe(0)
    const e = enemyInFront(300); e.z -= 30
    expect(game.cast('grapple')).toBe(true); advance(.6)
    expect(e.hp).toBeLessThan(300); expect(game.player.z).toBeLessThan(SPAWN.z - 25)
  })
  it('pulls groups inward with repeated cyclone hits', () => {
    const e = enemyInFront(900); e.x = 12
    game.cast('cyclone'); expect(game.cast('cyclone')).toBe(false)
    advance(.7); expect(e.x).toBeLessThan(8); expect(e.hp).toBeLessThan(850)
  })
  it('pierces aligned enemies with lance but misses distant sideways targets', () => {
    const e = enemyInFront(500); e.z = SPAWN.z - 30; game.cameraPitch = 0
    const side = game.enemies[1]; Object.assign(side, e, { id: 1, x: 20 })
    game.cast('lance'); expect(e.hp).toBe(330); expect(side.hp).toBe(500)
  })
  it('blocks damage and reflects hostile projectiles with aegis', () => {
    enemyInFront(500); game.cast('aegis'); game.invincible = 0; game.hurt(50); expect(game.hp).toBe(150)
    Object.assign(game.shots[0], { active: true, x: 0, y: 1.15, z: SPAWN.z - 3, vx: 0, vy: 0, vz: 10, life: 3, friendly: false })
    game.tick(1 / 60); expect(game.shots[0].friendly).toBe(true); expect(game.shots[0].vz).toBeLessThan(0)
  })
  it('drones attack automatically and overdrive boosts damage', () => {
    const e = enemyInFront(1000); game.cast('drones'); advance(.4); expect(e.hp).toBeLessThan(1000)
    game.droneTime = 0; const hp = e.hp; game.cast('overdrive'); game.attack()
    expect(hp - e.hp).toBeCloseTo(34 * 1.65); expect(game.overdrive).toBeGreaterThan(0)
  })
})

describe('open field progression', () => {
  it('activates districts when approached and permits free exploration order', () => {
    expect(game.zones[2].state).toBe('dormant')
    Object.assign(game.player, { x: DISTRICTS[2].x, z: DISTRICTS[2].z })
    game.tick(1 / 60); expect(game.zones[2].state).toBe('combat'); expect(game.zones[1].state).toBe('dormant')
    game.activateZone(5); expect(game.zones[5].state).toBe('locked')
  })
  it('collects exploration caches only once', () => {
    Object.assign(game.player, CACHES[0]); game.tick(1 / 60); const score = game.score
    expect(game.collected.size).toBe(1); game.tick(1 / 60); expect(game.score).toBe(score)
  })
  it('unlocks the final boss only after five cores and completes the operation', () => {
    for (const d of DISTRICTS) {
      Object.assign(game.player, { x: d.x, y: 1.15, z: d.z }); game.activateZone(d.id)
      expect(game.zones[d.id].state).toBe('combat')
      for (let wave = 0; wave < d.waves; wave++) {
        for (const e of game.enemies) if (e.active && e.zone === d.id) game.damageEnemy(e, e.hp * 2)
        advance(1.8)
      }
      expect(game.zones[d.id].state).toBe('cleared')
      if (d.id < 4) expect(game.zones[5].state).toBe('locked')
    }
    expect(game.mode).toBe('won'); expect(game.kills).toBe(157)
    game.start(); expect(game.hp).toBe(150); expect(game.score).toBe(0); expect(game.collected.size).toBe(0)
    expect(game.cooldowns.overdrive).toBe(0); expect(game.zones[5].state).toBe('locked')
  })
  it('transitions to defeat and resets correctly', () => {
    game.invincible = 0; game.hurt(200); expect(game.mode).toBe('lost')
    game.start(); expect(game.mode).toBe('playing'); expect(game.hp).toBe(150)
  })
})
