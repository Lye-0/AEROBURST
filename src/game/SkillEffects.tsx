import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game } from './core'

const from = new THREE.Vector3(), to = new THREE.Vector3(), direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
function EffectSlot({ index }: { index: number }) {
  const ring = useRef<THREE.Mesh>(null!), beam = useRef<THREE.Mesh>(null!), blast = useRef<THREE.Mesh>(null!)
  useFrame(() => {
    const e = game.effects[index], progress = 1 - e.life / e.duration
    ring.current.visible = e.life > 0 && e.kind === 'ring'; beam.current.visible = e.life > 0 && e.kind === 'beam'; blast.current.visible = e.life > 0 && e.kind === 'blast'
    if (e.life <= 0) return
    const mesh = e.kind === 'ring' ? ring.current : e.kind === 'beam' ? beam.current : blast.current
    const material = mesh.material as THREE.MeshBasicMaterial
    material.color.set(e.color); material.opacity = (1 - progress) * (e.kind === 'blast' ? 0.3 : 0.9)
    if (e.kind === 'beam') {
      from.set(e.start.x, e.start.y, e.start.z); to.set(e.end.x, e.end.y, e.end.z); direction.subVectors(to, from)
      mesh.position.copy(from).addScaledVector(direction, 0.5); mesh.scale.set(e.radius * (1 - progress * 0.8), direction.length(), e.radius * (1 - progress * 0.8)); mesh.quaternion.setFromUnitVectors(up, direction.normalize())
    } else { mesh.position.set(e.start.x, e.kind === 'ring' ? Math.max(0.15, e.start.y - 0.8) : e.start.y, e.start.z); const size = Math.max(0.1, e.radius * Math.pow(progress, 0.5)); mesh.scale.set(size, size, size) }
  })
  return <>
    <mesh ref={ring} visible={false} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.91, 1, 64]} /><meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} blending={THREE.AdditiveBlending} /></mesh>
    <mesh ref={beam} visible={false}><cylinderGeometry args={[1, 1, 1, 8]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} /></mesh>
    <mesh ref={blast} visible={false}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial transparent depthWrite={false} wireframe toneMapped={false} /></mesh>
  </>
}
export function SkillEffects() {
  const shield = useRef<THREE.Mesh>(null!), wings = useRef<THREE.Group>(null!), aura = useRef<THREE.Mesh>(null!)
  const afterimages = useRef<THREE.InstancedMesh>(null!)
  const trails = useRef(Array.from({ length: 12 }, () => ({ x: 0, y: 0, z: 0, life: 0, yaw: 0 })))
  const cursor = useRef(0), ticker = useRef(0), object = useRef(new THREE.Object3D())
  useFrame(({ clock }, dt) => {
    const p = game.player, visible = game.mode === 'playing' || game.mode === 'paused'
    shield.current.visible = visible && game.shield > 0; shield.current.position.set(p.x, p.y, p.z); shield.current.rotation.y = clock.elapsedTime * 0.8
    wings.current.visible = visible && game.droneTime > 0; wings.current.position.set(p.x, p.y + 2, p.z); wings.current.rotation.y = clock.elapsedTime
    aura.current.visible = visible && game.overdrive > 0; aura.current.position.set(p.x, p.y, p.z); aura.current.rotation.y = clock.elapsedTime * 2
    ticker.current += dt
    if (visible && (game.dashTime > 0 || game.boosting || game.grappleTime > 0) && ticker.current > 0.025) {
      ticker.current = 0; Object.assign(trails.current[cursor.current++ % 12], { x: p.x, y: p.y, z: p.z, yaw: p.yaw, life: 0.28 })
    }
    trails.current.forEach((t, i) => { t.life = Math.max(0, t.life - dt); object.current.position.set(t.x, t.y, t.z); object.current.rotation.set(0, t.yaw, 0); object.current.scale.set(0.65 * t.life, 2.2 * t.life, 0.4 * t.life); object.current.updateMatrix(); afterimages.current.setMatrixAt(i, object.current.matrix) })
    afterimages.current.instanceMatrix.needsUpdate = true
  })
  return <>
    {game.effects.map((_, i) => <EffectSlot key={i} index={i} />)}
    <mesh ref={shield} visible={false}><icosahedronGeometry args={[3.3, 1]} /><meshBasicMaterial color="#a8d6ff" wireframe transparent opacity={0.45} depthWrite={false} /></mesh>
    <mesh ref={aura} visible={false}><icosahedronGeometry args={[2, 0]} /><meshBasicMaterial color="#ffe9b0" wireframe transparent opacity={0.7} depthWrite={false} /></mesh>
    <group ref={wings} visible={false}>{[-1, 1].map(side => <group key={side} position={[side * 2.3, 0, 0]}><mesh><octahedronGeometry args={[0.5]} /><meshStandardMaterial color="#ebe8ff" emissive="#9e88d7" emissiveIntensity={0.6} /></mesh><mesh scale={[1.8, 0.1, 0.45]}><boxGeometry /><meshBasicMaterial color="#c9afff" /></mesh></group>)}</group>
    <instancedMesh ref={afterimages} args={[undefined, undefined, 12]} frustumCulled={false}><boxGeometry /><meshBasicMaterial color="#85faff" transparent opacity={0.45} depthWrite={false} /></instancedMesh>
  </>
}
