import { memo, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { game } from './core'
import { BOOST_GATES, CACHES, DISTRICTS, FIELD, LAUNCH_PADS, ROUTES } from './world'

const dummy = new THREE.Object3D()
function Structure({ position, size, color = '#d8e2d9' }: { position: [number, number, number]; size: [number, number, number]; color?: string }) {
  return <mesh position={position} scale={size} castShadow receiveShadow><boxGeometry /><meshStandardMaterial color={color} roughness={0.7} metalness={0.12} /></mesh>
}

function District({ index }: { index: number }) {
  const d = DISTRICTS[index]
  const crystal = useRef<THREE.Mesh>(null!)
  const beacon = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    crystal.current.rotation.y = clock.elapsedTime * 0.45
    crystal.current.position.y = 11 + Math.sin(clock.elapsedTime * 1.5) * 0.7
    const state = game.zones[index].state
    const tint = state === 'cleared' ? '#baffb4' : state === 'locked' ? '#a4abc8' : d.color
    ;(crystal.current.material as THREE.MeshBasicMaterial).color.set(tint)
    ;(beacon.current.material as THREE.MeshBasicMaterial).color.set(tint)
    beacon.current.visible = state !== 'cleared'
  })
  return <group position={[d.x, 0, d.z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow><circleGeometry args={[d.radius, 80]} /><meshStandardMaterial color={index === 1 ? '#aac8ac' : index === 4 ? '#aec4cd' : '#d2dbd2'} roughness={0.85} /></mesh>
    {[d.radius - 1, d.radius - 5, 30].map((r, i) => <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}><ringGeometry args={[r, r + (i === 0 ? 0.45 : 0.12), 80]} /><meshBasicMaterial color={i === 0 ? d.color : '#8faeac'} /></mesh>)}
    <mesh ref={beacon} position={[0, 70, 0]}><cylinderGeometry args={[0.15, 1.6, 140, 12, 1, true]} /><meshBasicMaterial color={d.color} transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh ref={crystal} position={[0, 11, 0]}><octahedronGeometry args={[2.8]} /><meshBasicMaterial color={d.color} toneMapped={false} /></mesh>
    <mesh position={[0, 10, 0]} rotation={[Math.PI / 2, 0.4, 0]}><torusGeometry args={[5.3, 0.2, 8, 48]} /><meshStandardMaterial color="#e9f2df" metalness={0.6} /></mesh>
    <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[5, 6, 0.5, 8]} /><meshStandardMaterial color="#657f80" /></mesh>
    {Array.from({ length: index === 5 ? 10 : 6 }, (_, i) => {
      const angle = i / (index === 5 ? 10 : 6) * Math.PI * 2, radius = d.radius + 6
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius, height = index === 5 ? 32 : 8 + (i % 3) * 8
      return <group key={i} position={[x, 0, z]} rotation={[0, angle, 0]}>
        <Structure position={[0, height / 2, 0]} size={[4, height, 5]} />
        <Structure position={[0, height + 0.4, 0]} size={[5.5, 0.8, 6.5]} color="#f2efe0" />
        <mesh position={[0, height / 2, 2.52]}><planeGeometry args={[0.3, height * 0.8]} /><meshBasicMaterial color={d.color} /></mesh>
      </group>
    })}
    {index === 1 && Array.from({ length: 7 }, (_, i) => <group key={i} position={[Math.sin(i) * 42, 0, Math.cos(i) * 42]}>
      <Structure position={[0, 3, 0]} size={[1.2, 6, 1.2]} color="#617f73" />
      <mesh position={[0, 7, 0]} scale={[5, 4, 5]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 2 ? '#93b99d' : '#c5cc93'} flatShading /></mesh>
    </group>)}
    {(index === 3 || index === 5) && <group position={[0, index === 5 ? 48 : 30, -d.radius + 6]}>
      <mesh><torusGeometry args={[index === 5 ? 37 : 24, 1.8, 8, 80]} /><meshStandardMaterial color="#dce8df" metalness={0.35} /></mesh>
      <mesh position={[0, 0, 1]}><torusGeometry args={[index === 5 ? 34.5 : 21.5, 0.25, 6, 80]} /><meshBasicMaterial color={d.color} /></mesh>
    </group>}
    {index === 4 && [-1, 1].map(s => <group key={s} position={[s * 40, 0, -36]}>
      <mesh position={[0, 13, 0]}><cylinderGeometry args={[5, 8, 26, 8]} /><meshStandardMaterial color="#b7cad0" metalness={0.4} /></mesh>
      {[8, 15, 22].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[6.7, 0.3, 6, 32]} /><meshBasicMaterial color="#9ffff9" /></mesh>)}
    </group>)}
  </group>
}

function LandscapeInstances() {
  const towers = useRef<THREE.InstancedMesh>(null!)
  const rocks = useRef<THREE.InstancedMesh>(null!)
  const trees = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    for (let i = 0; i < 160; i++) {
      const side = i % 2 ? -1 : 1, x = side * (390 + (i * 37 % 140)), z = 280 - i * 6.5
      const h = 15 + (i * 29 % 110)
      dummy.position.set(x, h / 2 - 18, z); dummy.rotation.set(0, i * 0.23, 0); dummy.scale.set(8 + i % 7, h, 9 + i % 9); dummy.updateMatrix()
      towers.current.setMatrixAt(i, dummy.matrix); towers.current.setColorAt(i, new THREE.Color(i % 3 ? '#b1c9cb' : '#d8e3d8'))
    }
    for (let i = 0; i < 90; i++) {
      dummy.position.set(Math.sin(i * 2.4) * (430 + i % 5 * 30), -28, -220 + Math.cos(i * 2.4) * 590)
      dummy.rotation.set(i * 0.3, i, i * 0.1); dummy.scale.set(30 + i % 5 * 8, 25 + i % 4 * 10, 45); dummy.updateMatrix(); rocks.current.setMatrixAt(i, dummy.matrix)
    }
    let count = 0
    for (let i = 0; i < 400; i++) {
      const x = Math.sin(i * 13.17) * 340, z = -220 + Math.cos(i * 7.13) * 425
      if (DISTRICTS.some(d => Math.hypot(d.x - x, d.z - z) < d.radius + 20)) continue
      dummy.position.set(x, 2.2, z); dummy.rotation.set(0, i, 0); dummy.scale.set(2 + i % 3, 3 + i % 4, 2 + i % 3); dummy.updateMatrix()
      trees.current.setMatrixAt(count++, dummy.matrix)
    }
    trees.current.count = count
    for (const mesh of [towers.current, rocks.current, trees.current]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere() }
  }, [])
  return <>
    <instancedMesh ref={towers} args={[undefined, undefined, 160]}><boxGeometry /><meshStandardMaterial roughness={0.8} /></instancedMesh>
    <instancedMesh ref={rocks} args={[undefined, undefined, 90]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#749b9b" flatShading /></instancedMesh>
    <instancedMesh ref={trees} args={[undefined, undefined, 400]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#91b59d" flatShading /></instancedMesh>
  </>
}

function Collectibles() {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    CACHES.forEach((c, i) => { const g = refs.current[i]; if (!g) return; g.visible = !game.collected.has(c.id); g.rotation.y = clock.elapsedTime; g.position.y = c.y + Math.sin(clock.elapsedTime * 2 + i) * 0.4 })
  })
  return <>{CACHES.map((c, i) => <group key={c.id} ref={g => { refs.current[i] = g }} position={[c.x, c.y, c.z]}>
    <mesh><octahedronGeometry args={[0.9]} /><meshBasicMaterial color="#ffe9aa" /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.6, 0.05, 6, 24]} /><meshBasicMaterial color="#fff1ba" /></mesh>
  </group>)}</>
}

export const World = memo(function World() {
  return <group>
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[FIELD.width / 2, 6, FIELD.depth / 2]} position={[0, -6, FIELD.centerZ]} />
      <Structure position={[0, -6, FIELD.centerZ]} size={[FIELD.width, 12, FIELD.depth]} color="#b9cbb4" />
      {DISTRICTS.map(d => <group key={d.id}>
        <CuboidCollider args={[7, 3, 10]} position={[d.x + d.radius - 4, 3, d.z - 24]} />
        <Structure position={[d.x + d.radius - 4, 3, d.z - 24]} size={[14, 6, 20]} />
        {Array.from({ length: d.id === 5 ? 10 : 6 }, (_, i) => {
          const a = i / (d.id === 5 ? 10 : 6) * Math.PI * 2, r = d.radius + 6, h = d.id === 5 ? 32 : 8 + (i % 3) * 8
          return <CuboidCollider key={i} args={[2, h / 2, 2.5]} position={[d.x + Math.sin(a) * r, h / 2, d.z + Math.cos(a) * r]} rotation={[0, a, 0]} />
        })}
      </group>)}
    </RigidBody>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -32, -230]}><planeGeometry args={[2800, 2800]} /><meshStandardMaterial color="#81becb" metalness={0.4} roughness={0.3} /></mesh>
    {ROUTES.map(([a, b]) => {
      const start = DISTRICTS[a], end = DISTRICTS[b], length = Math.hypot(end.x - start.x, end.z - start.z), angle = Math.atan2(end.x - start.x, end.z - start.z)
      return <group key={`${a}-${b}`} position={[(start.x + end.x) / 2, 0.05, (start.z + end.z) / 2]} rotation={[0, angle, 0]}>
        <Structure position={[0, 0, 0]} size={[15, 0.08, length]} color="#cbd8cf" />
        {[-1, 1].map(s => <mesh key={s} position={[s * 6.5, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.14, length]} /><meshBasicMaterial color="#ecf5df" /></mesh>)}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}><planeGeometry args={[0.16, length]} /><meshBasicMaterial color="#799f99" /></mesh>
      </group>
    })}
    {DISTRICTS.map(d => <District key={d.id} index={d.id} />)}
    {BOOST_GATES.map(g => <group key={g.id} position={[g.x, 6, g.z]} rotation={[0, g.yaw, 0]}>
      <mesh><torusGeometry args={[6, 0.35, 6, 32, Math.PI]} /><meshStandardMaterial color="#ebf3d7" /></mesh>
      <mesh><torusGeometry args={[5.45, 0.11, 6, 32, Math.PI]} /><meshBasicMaterial color="#d2ffbc" /></mesh>
      <Structure position={[-6, -3, 0]} size={[0.6, 6, 0.6]} color="#bed2b9" /><Structure position={[6, -3, 0]} size={[0.6, 6, 0.6]} color="#bed2b9" />
    </group>)}
    {LAUNCH_PADS.map((p, i) => <group key={i} position={[p.x, 0.1, p.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[3, 24]} /><meshBasicMaterial color="#376961" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[2.5, 2.85, 24]} /><meshBasicMaterial color="#ccffb9" /></mesh>
      <Structure position={[0, 0.025, 0]} size={[0.18, 0.05, 3]} color="#ccffb9" /><Structure position={[0, 0.025, 0]} size={[3, 0.05, 0.18]} color="#ccffb9" />
    </group>)}
    <LandscapeInstances /><Collectibles />
    <mesh position={[450, 300, -950]}><sphereGeometry args={[55, 24, 16]} /><meshBasicMaterial color="#fff3cd" fog={false} /></mesh>
    {Array.from({ length: 16 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2.4) * 650, 80 + i % 3 * 25, -300 + Math.cos(i * 2.4) * 700]} scale={[75 + i % 3 * 35, 9, 30]}>
      <icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color="#f2f6e9" transparent opacity={0.55} depthWrite={false} />
    </mesh>)}
  </group>
})
