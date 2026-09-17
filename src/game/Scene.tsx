import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, CuboidCollider, CylinderCollider, Physics, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { game } from './core'

const ivory = '#e9efdf'
const dark = '#163c49'
const cyan = '#56e4f8'
const temp = new THREE.Object3D()
const color = new THREE.Color()

function Box({ position, scale, color: tint = ivory, rotation = [0, 0, 0], glow = false }: {
  position: [number, number, number]; scale: [number, number, number]; color?: string;
  rotation?: [number, number, number]; glow?: boolean
}) {
  return <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow>
    <boxGeometry /><meshStandardMaterial color={tint} roughness={0.5} metalness={0.35} emissive={glow ? tint : '#000'} emissiveIntensity={glow ? 1.3 : 0} />
  </mesh>
}

function Pilot() {
  const group = useRef<THREE.Group>(null!)
  const torso = useRef<THREE.Group>(null!)
  const leftLeg = useRef<THREE.Group>(null!)
  const rightLeg = useRef<THREE.Group>(null!)
  const arm = useRef<THREE.Group>(null!)
  const thrusters = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    const p = game.player
    const title = game.mode === 'title'
    const t = clock.elapsedTime
    group.current.position.set(title ? 4.5 : p.x, title ? 2.65 : p.y, title ? 7 : p.z)
    group.current.scale.setScalar(title ? 2.3 : 1)
    group.current.rotation.y = title ? 0.6 : p.yaw
    const speed = title ? 0 : Math.hypot(p.vx, p.vz)
    const walk = Math.sin(t * 19) * Math.min(speed / 12, 0.7)
    leftLeg.current.rotation.x = p.grounded ? walk : -0.5
    rightLeg.current.rotation.x = p.grounded ? -walk : 0.45
    torso.current.rotation.z = title ? Math.sin(t * 1.3) * 0.025 : game.slash > 0 ? Math.sin(game.slash * 20) * 0.2 : 0
    torso.current.rotation.x = game.dashTime > 0 ? 0.8 : 0
    arm.current.rotation.x = game.slash > 0 ? -1.5 + Math.sin(game.slash * 23) * 1.6 : -0.25
    arm.current.rotation.z = game.slash > 0 ? -0.9 : -0.12
    thrusters.current.scale.set(1, game.dashTime > 0 ? 3 : 0.7 + Math.sin(t * 35) * 0.2, 1)
    group.current.visible = !(game.invincible > 0 && game.damageFlash > 0 && Math.floor(t * 18) % 2)
  })
  return <group ref={group}>
    <group ref={torso}>
      <Box position={[0, 0.18, 0]} scale={[0.74, 0.85, 0.46]} />
      <Box position={[0, 0.37, 0.26]} scale={[0.48, 0.29, 0.12]} color={dark} rotation={[0, 0, Math.PI / 4]} />
      <Box position={[0, 0.36, 0.34]} scale={[0.12, 0.17, 0.03]} color={cyan} glow />
      <Box position={[0, -0.33, 0]} scale={[0.5, 0.23, 0.38]} color={dark} />
      <Box position={[0, 0.92, 0]} scale={[0.45, 0.42, 0.4]} />
      <Box position={[0, 0.96, 0.215]} scale={[0.39, 0.085, 0.05]} color={cyan} glow />
      <Box position={[0.19, 1.22, -0.02]} scale={[0.035, 0.38, 0.07]} color={dark} rotation={[0, 0, -0.22]} />
      <Box position={[-0.52, 0.5, 0]} scale={[0.4, 0.3, 0.5]} rotation={[0, 0, -0.22]} />
      <Box position={[0.52, 0.5, 0]} scale={[0.4, 0.3, 0.5]} rotation={[0, 0, 0.22]} />
      <Box position={[-0.6, 0.02, 0.02]} scale={[0.22, 0.67, 0.23]} color={dark} rotation={[-0.2, 0, -0.1]} />
      <group ref={arm} position={[0.56, 0.4, 0]}>
        <Box position={[0, -0.32, 0]} scale={[0.23, 0.67, 0.25]} color={dark} />
        <Box position={[0, -0.63, 0.08]} scale={[0.3, 0.25, 0.3]} />
        <Box position={[0, -0.62, 0.42]} scale={[0.15, 0.15, 0.85]} color={dark} />
        <Box position={[0, -0.62, 1.8]} scale={[0.075, 0.2, 2.15]} color={cyan} glow />
        <Box position={[0, -0.62, 2.8]} scale={[0.04, 0.11, 0.5]} color={'#d9ffff'} glow />
      </group>
      {[-1, 1].map(side => <group key={side}>
        <Box position={[side * 0.64, 0.5, -0.45]} scale={[0.27, 1.3, 0.25]} rotation={[0.25, 0, side * -0.5]} />
        <Box position={[side * 0.7, 0.66, -0.63]} scale={[0.09, 0.9, 0.12]} color={cyan} glow rotation={[0.25, 0, side * -0.5]} />
      </group>)}
      <group ref={thrusters} position={[0, -0.2, -0.4]}>
        {[-0.3, 0.3].map(x => <mesh key={x} position={[x, -0.35, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.12, 0.85, 6]} /><meshBasicMaterial color={cyan} transparent opacity={0.75} />
        </mesh>)}
      </group>
    </group>
    <group ref={leftLeg} position={[-0.23, -0.4, 0]}>
      <Box position={[0, -0.25, 0]} scale={[0.24, 0.52, 0.25]} color={dark} />
      <Box position={[0, -0.62, 0.04]} scale={[0.28, 0.4, 0.33]} />
      <Box position={[0, -0.8, 0.15]} scale={[0.3, 0.15, 0.48]} color={dark} />
    </group>
    <group ref={rightLeg} position={[0.23, -0.4, 0]}>
      <Box position={[0, -0.25, 0]} scale={[0.24, 0.52, 0.25]} color={dark} />
      <Box position={[0, -0.62, 0.04]} scale={[0.28, 0.4, 0.33]} />
      <Box position={[0, -0.8, 0.15]} scale={[0.3, 0.15, 0.48]} color={dark} />
    </group>
  </group>
}

const platforms = [
  { x: -17, z: -14, w: 8, d: 6, h: 2.4 },
  { x: 17, z: -14, w: 8, d: 6, h: 2.4 },
  { x: 0, z: -24, w: 10, d: 5, h: 4 },
]

function Arena() {
  const buildings = useMemo(() => Array.from({ length: 55 }, (_, i) => {
    const a = i * 2.39996
    const r = 49 + (i % 6) * 16
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 10 + ((i * 17) % 37), w: 3 + i % 5, angle: a }
  }), [])
  return <group>
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[0.65, 31]} position={[0, -0.65, 0]} />
      <mesh position={[0, -0.65, 0]} receiveShadow>
        <cylinderGeometry args={[31, 30, 1.3, 96]} /><meshStandardMaterial color="#d0e0de" roughness={0.85} metalness={0.15} />
      </mesh>
      {platforms.map((p, i) => <group key={i}>
        <CuboidCollider args={[p.w / 2, p.h / 2, p.d / 2]} position={[p.x, p.h / 2, p.z]} />
        <Box position={[p.x, p.h / 2, p.z]} scale={[p.w, p.h, p.d]} color="#d9e8e5" />
        <Box position={[p.x, p.h + 0.03, p.z]} scale={[p.w - 0.2, 0.07, 0.2]} color="#54bcc6" glow />
      </group>)}
    </RigidBody>
    <mesh position={[0, -2, 0]}><cylinderGeometry args={[28, 23, 2, 12]} /><meshStandardMaterial color={dark} roughness={0.75} /></mesh>
    <mesh position={[0, -4.8, 0]}><cylinderGeometry args={[21, 13, 4, 12]} /><meshStandardMaterial color="#819eaa" /></mesh>
    {[6, 17, 29.5, 30.6].map((radius, i) => <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025 + i * 0.001, 0]}>
      <ringGeometry args={[radius, radius + (i > 1 ? 0.16 : 0.08), 96]} /><meshBasicMaterial color={i > 1 ? '#85aaab' : '#afc6c5'} />
    </mesh>)}
    {Array.from({ length: 12 }, (_, i) => <group key={i} rotation={[0, i * Math.PI / 6, 0]}>
      <Box position={[0, 0.02, 22.5]} scale={[0.055, 0.025, 14]} color="#aec8c9" />
      <Box position={[0, 0.03, 29.8]} scale={[2.3, 0.035, 0.45]} color={i % 3 === 0 ? '#ec8858' : '#93b4b7'} />
    </group>)}
    {[-20, 20].map(x => <group key={x} position={[x, 0.04, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.15, 32]} /><meshBasicMaterial color="#204a52" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[1.75, 2, 32]} /><meshBasicMaterial color="#9cffa7" /></mesh>
      <Box position={[0, 0.015, 0]} scale={[0.15, 0.025, 2]} color="#9cffa7" glow />
      <Box position={[0, 0.018, 0]} scale={[2, 0.025, 0.15]} color="#9cffa7" glow />
    </group>)}
    {Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4, x = Math.sin(a) * 32, z = Math.cos(a) * 32
      return <group key={i} position={[x, 0, z]} rotation={[0, a, 0]}>
        <Box position={[0, 2, 0]} scale={[1, 6, 1.5]} color={dark} />
        <Box position={[0, 5.2, 0]} scale={[0.75, 0.6, 1.1]} color="#e9fff9" glow />
        <Box position={[0, 2.5, -0.78]} scale={[0.16, 2.8, 0.06]} color={cyan} glow />
      </group>
    })}
    {buildings.map((b, i) => <group key={i} position={[b.x, -12, b.z]} rotation={[0, b.angle, 0]}>
      <Box position={[0, b.h / 2 - 5, 0]} scale={[b.w, b.h, b.w * 1.3]} color={i % 3 ? '#bfd4dc' : '#91b3c4'} />
      <Box position={[b.w * 0.2, b.h - 5, 0]} scale={[b.w * 0.55, 1, b.w]} color="#e9f0e9" />
      <Box position={[b.w * 0.51, b.h / 2, 0]} scale={[0.05, b.h * 0.8, 0.18]} color="#e0fcf8" glow />
    </group>)}
    <group position={[0, 7, -62]}>
      <mesh rotation={[0, 0.22, 0]}><torusGeometry args={[18, 1.2, 8, 72]} /><meshStandardMaterial color="#e1eee9" metalness={0.35} roughness={0.5} /></mesh>
      <mesh rotation={[0, 0.22, 0]} position={[0, 0, 0.5]}><torusGeometry args={[16.6, 0.12, 6, 72]} /><meshBasicMaterial color="#a2f5ec" /></mesh>
      <Box position={[-12, -16, 0]} scale={[2.5, 25, 3]} color="#a2bcc6" />
      <Box position={[12, -16, 0]} scale={[2.5, 25, 3]} color="#a2bcc6" />
    </group>
    {Array.from({ length: 24 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2.4) * (30 + i * 4), -12 - i % 3 * 2, Math.cos(i * 2.4) * (30 + i * 4)]} scale={[18 + i % 4 * 5, 2.5, 12 + i % 4 * 5]}>
      <sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#eff7f5" transparent opacity={0.75} roughness={1} depthWrite={false} />
    </mesh>)}
  </group>
}

function EnemyModel({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null!)
  const warning = useRef<THREE.Mesh>(null!)
  const hp = useRef<THREE.Mesh>(null!)
  const striker = useRef<THREE.Group>(null!)
  const drone = useRef<THREE.Group>(null!)
  const boss = useRef<THREE.Group>(null!)
  const cannon = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    const e = game.enemies[index]
    group.current.visible = e.active
    if (!e.active) return
    group.current.position.set(e.x, e.y, e.z)
    body.current.rotation.y = e.yaw
    body.current.rotation.z = e.flash > 0 ? Math.sin(clock.elapsedTime * 70) * 0.15 : 0
    striker.current.visible = e.kind === 'striker' || e.kind === 'gunner'
    striker.current.scale.setScalar(e.kind === 'gunner' ? 1.15 : 1)
    cannon.current.visible = e.kind === 'gunner'
    drone.current.visible = e.kind === 'drone'
    drone.current.rotation.z = Math.sin(clock.elapsedTime * 2 + index) * 0.12
    boss.current.visible = e.kind === 'boss'
    hp.current.position.y = e.kind === 'boss' ? 3.5 : 1.7
    hp.current.scale.x = Math.max(0.01, e.hp / e.maxHp) * (e.kind === 'boss' ? 3 : 1.5)
    hp.current.quaternion.copy(gameCameraQuaternion)
    warning.current.visible = e.phase === 'windup'
    warning.current.position.y = -e.y + 0.06
    const size = e.kind === 'boss' ? (e.attack % 3 === 1 ? 10 : 6) : e.kind === 'striker' ? 3.5 : 1.8
    warning.current.scale.setScalar(size * (1 - e.timer * 0.12))
    ;(warning.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + (1 - e.timer) * 0.3
  })
  return <group ref={group} visible={false}>
    <group ref={body}>
      <group ref={striker}>
        <Box position={[0, 0.15, 0]} scale={[0.8, 0.85, 0.6]} color="#a44933" />
        <Box position={[0, 0.85, 0]} scale={[0.46, 0.4, 0.48]} color="#353d43" />
        <Box position={[0, 0.88, 0.25]} scale={[0.4, 0.1, 0.05]} color="#ff9369" glow />
        {[-1, 1].map(s => <group key={s}>
          <Box position={[s * 0.56, 0.32, 0]} scale={[0.3, 0.8, 0.35]} color="#de7652" rotation={[0, 0, s * 0.2]} />
          <Box position={[s * 0.25, -0.62, 0]} scale={[0.24, 0.8, 0.3]} color="#354b52" />
        </group>)}
        <Box position={[0.55, -0.07, 0.6]} scale={[0.12, 0.12, 1.4]} color="#ffb36b" glow />
      </group>
      <group ref={cannon}>
        <Box position={[-0.7, 0.4, 0.65]} scale={[0.45, 0.4, 1.8]} color="#273f4e" />
        <Box position={[-0.7, 0.4, 1.6]} scale={[0.32, 0.25, 0.15]} color="#ffc574" glow />
        <Box position={[0, 1.25, -0.2]} scale={[0.08, 0.85, 0.08]} color="#daaf6a" />
      </group>
      <group ref={drone}>
        <mesh castShadow><octahedronGeometry args={[0.8]} /><meshStandardMaterial color="#db7e4f" metalness={0.6} roughness={0.3} /></mesh>
        <Box position={[0, 0, 0.64]} scale={[0.3, 0.16, 0.15]} color="#ffe293" glow />
        {[-1, 1].map(s => <Box key={s} position={[s * 0.95, 0, 0]} scale={[1.1, 0.12, 0.55]} color="#354a51" rotation={[0, 0, s * 0.15]} />)}
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.1, 0.035, 6, 24]} /><meshBasicMaterial color="#ffb178" /></mesh>
      </group>
      <group ref={boss}>
        <Box position={[0, 0.25, 0]} scale={[2.8, 2.4, 1.65]} color="#293f48" />
        <Box position={[0, 1.6, 0.2]} scale={[1.15, 0.85, 1.1]} color="#eee5d0" />
        <Box position={[0, 1.62, 0.8]} scale={[0.9, 0.17, 0.08]} color="#ff8b45" glow />
        <mesh position={[0, 0.4, 0.9]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.55, 0.55, 0.2, 6]} /><meshBasicMaterial color="#ffa36a" /></mesh>
        {[-1, 1].map(s => <group key={s}>
          <Box position={[s * 1.8, 0.7, 0]} scale={[1.15, 1.3, 1.5]} color="#d47f57" rotation={[0, 0, s * 0.25]} />
          <Box position={[s * 2.2, -0.5, 0.3]} scale={[0.65, 1.7, 0.75]} color="#293f48" />
          <Box position={[s * 0.85, -1.6, 0]} scale={[0.8, 1.5, 1]} color="#dbd8c6" />
          <Box position={[s * 2.2, -0.75, 1.4]} scale={[0.25, 0.4, 2.8]} color="#ff9f58" glow />
        </group>)}
      </group>
    </group>
    <mesh ref={hp}><planeGeometry args={[1, 0.06]} /><meshBasicMaterial color="#f7946d" side={THREE.DoubleSide} /></mesh>
    <mesh ref={warning} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.7, 1, 48]} /><meshBasicMaterial color="#ff5b2e" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} /></mesh>
  </group>
}

const gameCameraQuaternion = new THREE.Quaternion()

function Effects() {
  const particles = useRef<THREE.InstancedMesh>(null!)
  const shots = useRef<THREE.InstancedMesh>(null!)
  const slash = useRef<THREE.Mesh>(null!)
  const burst = useRef<THREE.Mesh>(null!)
  const target = useRef<THREE.Group>(null!)
  useFrame(({ camera, clock }) => {
    game.particles.forEach((p, i) => {
      const life = Math.max(0, p.life / p.maxLife)
      temp.position.set(p.x, p.y, p.z); temp.scale.setScalar(p.size * life)
      temp.rotation.set(clock.elapsedTime * 4 + i, i, clock.elapsedTime * 3)
      temp.updateMatrix(); particles.current.setMatrixAt(i, temp.matrix)
      particles.current.setColorAt(i, color.set(p.color))
    })
    particles.current.instanceMatrix.needsUpdate = true
    if (particles.current.instanceColor) particles.current.instanceColor.needsUpdate = true
    game.shots.forEach((s, i) => {
      temp.position.set(s.x, s.y, s.z); temp.rotation.set(0, 0, 0); temp.scale.setScalar(s.active ? 0.23 : 0)
      temp.updateMatrix(); shots.current.setMatrixAt(i, temp.matrix)
    })
    shots.current.instanceMatrix.needsUpdate = true
    slash.current.visible = game.slash > 0
    slash.current.position.set(game.player.x, game.player.y + 0.1, game.player.z)
    slash.current.rotation.set(game.slashType ? 0.3 : -Math.PI / 2 + 0.15, game.player.yaw, game.slashSerial % 2 ? 0.4 : 2.5)
    slash.current.scale.setScalar(1 + (0.25 - game.slash) * 3)
    ;(slash.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.8, game.slash * 4)
    burst.current.visible = game.burst > 0 || game.slam > 0
    burst.current.position.set(game.burstOrigin.x, game.burstOrigin.y, game.burstOrigin.z)
    burst.current.scale.setScalar(game.burst > 0 ? 1 + (1 - game.burst) * 25 : 1 + (0.45 - game.slam) * 15)
    ;(burst.current.material as THREE.MeshBasicMaterial).opacity = (game.burst || game.slam) * 0.6
    const e = game.enemies[game.target]
    target.current.visible = !!e?.active && game.mode === 'playing'
    if (e?.active) { target.current.position.set(e.x, e.y, e.z); target.current.quaternion.copy(camera.quaternion) }
  })
  return <>
    <instancedMesh ref={particles} args={[undefined, undefined, 200]} frustumCulled={false}><boxGeometry /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    <instancedMesh ref={shots} args={[undefined, undefined, 40]} frustumCulled={false}><octahedronGeometry /><meshBasicMaterial color="#ff5727" toneMapped={false} /></instancedMesh>
    <mesh ref={slash} visible={false}><ringGeometry args={[2.2, 2.65, 32, 1, 0, Math.PI * 1.4]} /><meshBasicMaterial color="#b0fffa" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={burst} visible={false} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[1, 0.03, 8, 64]} /><meshBasicMaterial color="#b3fff3" transparent depthWrite={false} toneMapped={false} /></mesh>
    <group ref={target}>
      {[-1, 1].flatMap(x => [-1, 1].map(y => <group key={`${x}${y}`} position={[x * 0.95, y * 0.95, 0]}>
        <mesh position={[-x * 0.13, 0, 0]}><planeGeometry args={[0.28, 0.035]} /><meshBasicMaterial color="#e4ffdf" depthTest={false} /></mesh>
        <mesh position={[0, -y * 0.13, 0]}><planeGeometry args={[0.035, 0.28]} /><meshBasicMaterial color="#e4ffdf" depthTest={false} /></mesh>
      </group>))}
    </group>
  </>
}

function Controller({ onReady }: { onReady: () => void }) {
  const rigidBody = useRef<RapierRigidBody>(null!)
  const { world, rapier } = useRapier()
  const { camera, gl } = useThree()
  const characterController = useMemo(() => {
    const c = world.createCharacterController(0.03)
    c.enableAutostep(0.35, 0.2, true)
    c.enableSnapToGround(0.2)
    return c
  }, [world])
  useEffect(() => { onReady(); return () => { world.removeCharacterController(characterController) } }, [world, characterController, onReady])
  useBeforePhysicsStep(() => {
    if (!rigidBody.current || game.mode !== 'playing') return
    const body = rigidBody.current
    const prev = body.translation()
    const p = game.player
    if (Math.hypot(prev.x - p.x, prev.y - p.y, prev.z - p.z) > 0.5) body.setTranslation(p, true)
    game.tick(1 / 60, (position, movement) => {
      characterController.computeColliderMovement(body.collider(0), movement)
      const corrected = characterController.computedMovement()
      return { position: { x: position.x + corrected.x, y: position.y + corrected.y, z: position.z + corrected.z }, grounded: characterController.computedGrounded() }
    })
    body.setNextKinematicTranslation(game.player)
  })
  const cameraPosition = useMemo(() => new THREE.Vector3(), [])
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const p = game.player
    if (game.mode === 'title') {
      cameraPosition.set(12, 7, 22)
      targetPosition.set(-3.5, 2, 6)
    } else {
      const radius = 8.5 + (game.dashTime > 0 ? 1 : 0)
      const horizontal = Math.cos(game.cameraPitch) * radius
      cameraPosition.set(p.x + Math.sin(game.cameraYaw) * horizontal, p.y + 1.8 + Math.sin(game.cameraPitch) * radius, p.z + Math.cos(game.cameraYaw) * horizontal)
      cameraPosition.y = Math.max(cameraPosition.y, 1.2)
      targetPosition.set(p.x, p.y + 1, p.z)
      const cameraDirection = cameraPosition.clone().sub(targetPosition)
      const cameraDistance = cameraDirection.length()
      cameraDirection.normalize()
      const ray = new rapier.Ray(targetPosition, cameraDirection)
      const obstacle = world.castRay(ray, cameraDistance, true, undefined, undefined, undefined, rigidBody.current)
      if (obstacle) cameraPosition.copy(targetPosition).addScaledVector(cameraDirection, Math.max(0.7, obstacle.timeOfImpact - 0.3))
      if (game.settings.shake && game.shake > 0) {
        cameraPosition.x += (Math.random() - 0.5) * game.shake * 0.65
        cameraPosition.y += (Math.random() - 0.5) * game.shake * 0.45
      }
    }
    camera.position.lerp(cameraPosition, 1 - Math.exp(-8 * Math.min(dt, 0.05)))
    camera.lookAt(targetPosition)
    gameCameraQuaternion.copy(camera.quaternion)
    const perspective = camera as THREE.PerspectiveCamera
    const fov = game.mode === 'title' ? 46 : game.dashTime > 0 ? 79 : 65
    perspective.fov += (fov - perspective.fov) * Math.min(1, dt * 8)
    perspective.updateProjectionMatrix()
    const canvas = gl.domElement
    if (game.mode !== 'playing' && document.pointerLockElement === canvas) document.exitPointerLock()
  })
  return <RigidBody ref={rigidBody} type="kinematicPosition" colliders={false} position={[0, 1.15, 9]} enabledRotations={[false, false, false]}>
    <CapsuleCollider args={[0.65, 0.45]} />
  </RigidBody>
}

export const Scene = memo(function Scene({ onReady, quality }: { onReady: () => void; quality: 'high' | 'low' }) {
  return <Canvas shadows={quality === 'high'} dpr={quality === 'high' ? [1, 1.5] : 1}
    camera={{ position: [12, 7, 22], fov: 46, near: 0.1, far: 300 }}
    gl={{ antialias: quality === 'high', alpha: false, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15 }}>
    <color attach="background" args={['#b8d9e8']} />
    <fog attach="fog" args={['#c9e2eb', 45, 170]} />
    <hemisphereLight args={['#e6f8ff', '#6896a0', 2.2]} />
    <directionalLight position={[20, 35, 15]} intensity={3} color="#fff5d6" castShadow={quality === 'high'}
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-38} shadow-camera-right={38} shadow-camera-top={38} shadow-camera-bottom={-38}
      shadow-camera-near={1} shadow-camera-far={90} shadow-bias={-0.0005} shadow-normalBias={0.045} />
    <Physics timeStep={1 / 60} gravity={[0, -27, 0]} interpolate>
      <Arena /><Controller onReady={onReady} />
    </Physics>
    <Pilot />
    {game.enemies.map(e => <EnemyModel key={e.id} index={e.id} />)}
    <Effects />
  </Canvas>
})
