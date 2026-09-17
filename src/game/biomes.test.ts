import { describe, expect, it } from 'vitest'
import { Game } from './core'
import { BIOMES, RESONATORS, UPDRAFTS, environmentAt } from './biomes'
import { attackPattern, hazardTouches, type Hazard } from './encounters'
import { DISTRICTS } from './world'

function isolatedGame(zone = 0) {
  const g = new Game(); g.start(); g.enemies.forEach(e => { e.active = false })
  g.zones.forEach(z => { z.state = 'cleared' })
  Object.assign(g.player, { x: DISTRICTS[zone].x, y: 10, z: DISTRICTS[zone].z })
  return g
}
const step = (g: Game, seconds: number) => { for(let i=0;i<seconds*60;i++)g.tick(1/60) }

describe('district environments', () => {
  it('has distinct gravity for port, corridor and observatory', () => {
    expect(environmentAt(0,125,0).gravity).toBe(.7)
    expect(environmentAt(210,-85,0).gravity).toBe(1.8)
    expect(environmentAt(-160,-285,0).gravity).toBeCloseTo(.32)
  })
  it('blends at the border and returns to normal outside', () => {
    const d = DISTRICTS[2]
    const halfway = environmentAt(d.x+d.radius+11,d.z,0)
    expect(halfway.gravity).toBeCloseTo(1.4)
    expect(environmentAt(350,220,0).zone).toBe(-1)
    expect(environmentAt(350,220,0).gravity).toBe(1)
  })
  it('alternates throne gravity every six seconds', () => {
    expect(environmentAt(0,-590,1).gravity).toBe(.5)
    expect(environmentAt(0,-590,7).gravity).toBeCloseTo(1.65)
    expect(environmentAt(0,-590,13).gravity).toBe(.5)
  })
  it('actually accelerates falls differently', () => {
    const light = isolatedGame(3), heavy = isolatedGame(2)
    step(light,.3); step(heavy,.3)
    expect(light.player.y).toBeGreaterThan(heavy.player.y+1)
  })
  it('updrafts lift the pilot and recharge fuel', () => {
    const g=isolatedGame();Object.assign(g.player,{x:UPDRAFTS[0].x,z:UPDRAFTS[0].z,y:2});g.fuel=10;step(g,.4)
    expect(g.player.y).toBeGreaterThan(5);expect(g.fuel).toBeGreaterThan(20)
  })
  it('garden wind does not redirect a blink', () => {
    const g=isolatedGame(1);g.aimDirection={x:0,y:0,z:-1};const x=g.player.x;g.dash();step(g,.1)
    expect(g.player.x).toBeCloseTo(x);expect(g.dashDirection).toEqual({x:0,y:0,z:-1})
  })
})

describe('regional hazards and enemies', () => {
  it('uses different attacks for every district', () => {
    const origin={x:0,y:2,z:0},aim={x:10,y:1,z:10}
    expect([0,1,2,3,4].map(z=>attackPattern(z,origin,aim,false,0)[0].kind)).toEqual(['wind','spores','beam','well','lightning'])
    for(let z=0;z<6;z++)expect(attackPattern(z,origin,aim,true,0).every(h=>h.warning>=.9)).toBe(true)
  })
  it('does not damage during warning and spores can be jumped over', () => {
    const spec=attackPattern(1,{x:0,y:1,z:0},{x:0,y:1,z:0},false,0)[0]
    const h:Hazard={...spec,active:true,elapsed:.2,nextHit:0}
    expect(hazardTouches(h,{x:0,y:1,z:0})).toBe(false)
    h.elapsed=1.5;expect(hazardTouches(h,{x:0,y:1,z:0})).toBe(true)
    expect(hazardTouches(h,{x:0,y:6,z:0})).toBe(false)
  })
  it('lightning hits airborne targets only within its marked footprint', () => {
    const spec=attackPattern(4,{x:0,y:1,z:0},{x:0,y:1,z:0},false,0)[0]
    const h:Hazard={...spec,active:true,elapsed:1,nextHit:0}
    expect(hazardTouches(h,{x:0,y:25,z:0})).toBe(true)
    expect(hazardTouches(h,{x:10,y:25,z:0})).toBe(false)
  })
  it('spawns stronger mobs, specialists, and a warden in the final formation', () => {
    const g=new Game();g.start();expect(g.enemies.find(e=>e.active&&e.kind==='striker')!.hp).toBe(110)
    expect(g.enemies.some(e=>e.active&&e.kind==='specialist')).toBe(true)
    g.enemies.forEach(e=>e.active=false);g.zones[0].formation=2;g.spawnFormation(0)
    expect(g.enemies.some(e=>e.active&&e.kind==='warden')).toBe(true)
  })
  it('warden armor opens during recovery and resists permanent stun', () => {
    const g=isolatedGame();const e=g.enemies[0];Object.assign(e,{active:true,kind:'warden',hp:1000,maxHp:1000,phase:'windup',zone:0})
    g.damageEnemy(e,100,true);expect(e.hp).toBe(932);expect(e.stun).toBe(0);expect(e.vy).toBe(0)
    e.phase='recover';g.damageEnemy(e,100);expect(e.hp).toBe(802)
  })
  it('hazards stop progressing when paused and expire after their duration', () => {
    const g=isolatedGame();g.queueHazard(attackPattern(1,g.player,g.player,false,0)[0]);g.pause();step(g,3);expect(g.hazards[0].elapsed).toBe(0)
    g.resume();step(g,6);expect(g.hazards[0].active).toBe(false)
  })
})

describe('resonance devices and liberation rewards', () => {
  it('applies each region effect and prevents immediate retriggering', () => {
    const g=isolatedGame();g.fuel=20;g.hp=50;g.cooldowns.lance=4
    for(const id of [0,2,4,6,8,10])expect(g.consumeResonator(id)).toBe(true)
    expect(g.tailwind).toBe(12);expect(g.regeneration).toBe(8);expect(g.armor).toBe(10)
    expect(g.cooldowns.lance).toBe(2);expect(g.overdrive).toBe(6);expect(g.shield).toBe(4)
    expect(g.consumeResonator(0)).toBe(false);expect(g.resonances).toBe(6)
  })
  it('activates a device by physical contact and respawns after 30 seconds', () => {
    const g=isolatedGame();Object.assign(g.player,RESONATORS[0]);g.tick(1/60);expect(g.tailwind).toBeGreaterThan(11)
    g.player.x+=10;step(g,30.1);expect(g.resonatorCooldowns[0]).toBe(0)
  })
  it('does not retain buffs or hazards after restarting', () => {
    const g=isolatedGame();g.consumeResonator(4);g.queueHazard(attackPattern(3,g.player,g.player,false,0)[0]);g.start()
    expect(g.armor).toBe(0);expect(g.resonances).toBe(0);expect(g.hazards.every(h=>!h.active)).toBe(true)
  })
  it('liberating the port accelerates blink recovery', () => {
    const slow=new Game(),fast=new Game();slow.start();fast.start()
    slow.enemies.forEach(e=>e.timer=999);fast.enemies.forEach(e=>e.timer=999)
    fast.zones[0].state='cleared';slow.dashes=fast.dashes=0;step(slow,.6);step(fast,.6)
    expect(slow.dashes).toBe(0);expect(fast.dashes).toBe(1)
  })
})
