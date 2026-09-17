import { beforeEach, describe, expect, it } from 'vitest'
import { Game, groundResolver, type Enemy } from './core'

let game: Game
function advance(seconds: number) { for (let i = 0; i < seconds * 60; i++) game.tick(1 / 60) }
function enemyInFront(hp = 70): Enemy {
  game.enemies.forEach(e => { e.active = false })
  const enemy = game.enemies[0]
  Object.assign(enemy, { active: true, x: 0, y: 1.15, z: 6, hp, maxHp: hp, timer: 100, kind: 'striker' })
  return enemy
}
beforeEach(() => { game = new Game(); game.start() })

describe('movement and recovery', () => {
  it('moves relative to the camera and stops when paused', () => {
    game.keys.add('KeyW'); advance(0.5)
    expect(game.player.z).toBeLessThan(6)
    game.pause(); const z = game.player.z, time = game.time; advance(1)
    expect(game.player.z).toBe(z); expect(game.time).toBe(time)
    expect(game.keys.size).toBe(0)
  })
  it('allows two jumps, denies the third, and resets on landing', () => {
    game.jump(); advance(0.1); game.jump(); const vy = game.player.vy
    game.jump(); expect(game.player.vy).toBe(vy); expect(game.player.jumps).toBe(2)
    advance(2); expect(game.player.grounded).toBe(true); expect(game.player.jumps).toBe(0)
  })
  it('limits dashes and recharges them over time', () => {
    game.dash(); expect(game.dashes).toBe(1); game.dash(); expect(game.dashes).toBe(1)
    advance(0.35); game.dash(); expect(game.dashes).toBe(0)
    advance(1.3); expect(game.dashes).toBeGreaterThanOrEqual(1)
  })
  it('recovers from falling with a health cost', () => {
    game.player.x = 40; game.player.y = -13; game.tick(1 / 60)
    expect(game.player.x).toBe(0); expect(game.hp).toBe(85)
  })
  it('keeps the default floor solid but permits falling beyond the edge', () => {
    expect(groundResolver({ x: 0, y: 1.15, z: 0 }, { x: 0, y: -1, z: 0 }).grounded).toBe(true)
    expect(groundResolver({ x: 40, y: 1.15, z: 0 }, { x: 0, y: -1, z: 0 }).grounded).toBe(false)
  })
})

describe('combat', () => {
  it('requires range and prevents damage spam during the attack cooldown', () => {
    const enemy = enemyInFront(); game.attack(); expect(enemy.hp).toBe(42)
    game.attack(); expect(enemy.hp).toBe(42)
    game.attackCooldown = 0; enemy.z = -20; game.attack(); expect(enemy.hp).toBe(42)
  })
  it('launches enemies and player together for an aerial follow-up', () => {
    const enemy = enemyInFront(); game.attack(true)
    expect(enemy.vy).toBeGreaterThan(0); expect(game.player.vy).toBeGreaterThan(0)
    expect(game.player.grounded).toBe(false)
  })
  it('restores dashes, awards points and heals on a kill', () => {
    const enemy = enemyInFront(20); game.dashes = 0; game.hp = 70; game.attack()
    expect(enemy.active).toBe(false); expect(game.dashes).toBe(2); expect(game.hp).toBe(74)
    expect(game.kills).toBe(1); expect(game.score).toBeGreaterThan(150)
  })
  it('requires a full burst gauge and consumes it once', () => {
    const enemy = enemyInFront(300); game.energy = 99; game.ultimate(); expect(enemy.hp).toBe(300)
    game.energy = 100; game.ultimate(); expect(enemy.hp).toBe(110); expect(game.energy).toBe(0)
    game.ultimate(); expect(enemy.hp).toBe(110)
  })
  it('applies the dive shockwave on landing instead of in mid-air', () => {
    const enemy = enemyInFront(150)
    game.player.y = 5; game.player.grounded = false; game.player.jumps = 1
    game.attack(true); expect(enemy.hp).toBe(150); expect(game.pendingSlam).toBe(true)
    advance(0.5)
    expect(game.pendingSlam).toBe(false); expect(enemy.hp).toBe(85)
  })
  it('does not advance sectors before all reinforcement groups are defeated', () => {
    expect(game.getSnapshot().remaining).toBe(12)
    for (const enemy of game.enemies) if (enemy.active) game.damageEnemy(enemy, enemy.hp)
    advance(1.8)
    expect(game.wave).toBe(1); expect(game.formation).toBe(2)
    expect(game.getSnapshot().remaining).toBe(8)
  })
  it('gives invulnerability frames and ends at zero health', () => {
    game.invincible = 0; game.hurt(20); expect(game.hp).toBe(80)
    game.hurt(20); expect(game.hp).toBe(80)
    game.invincible = 0; game.hurt(100); expect(game.mode).toBe('lost')
  })
  it('runs all four waves to a victory using combat damage', () => {
    for (let wave = 1; wave <= 4; wave++) {
      expect(game.wave).toBe(wave)
      for (let formation = 0; formation < (wave === 4 ? 1 : 3); formation++) {
        for (const enemy of game.enemies) if (enemy.active) game.damageEnemy(enemy, enemy.hp)
        advance(1.8)
      }
    }
    expect(game.mode).toBe('won'); expect(game.kills).toBe(57)
    game.start(); expect(game.mode).toBe('playing'); expect(game.wave).toBe(1)
    expect(game.score).toBe(0); expect(game.hp).toBe(100); expect(game.time).toBe(0)
  })
})
