import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, CuboidCollider, CylinderCollider, Physics, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { game, viewDirection } from './core'
import { World } from './Landscape'
import { SkillEffects } from './SkillEffects'
import { SPAWN } from './world'

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
    group.current.position.set(title ? 4.5 : p.x, title ? 2.65 : p.y, title ? SPAWN.z - 2 : p.z)
    group.current.scale.setScalar(title ? 2.3 : 1)
    group.current.rotation.y = title ? 0.6 : p.yaw
    const speed = title ? 0 : Math.hypot(p.vx, p.vz)
    const walk = Math.sin(t * 19) * Math.min(speed / 12, 0.7)
    leftLeg.current.rotation.x = p.grounded ? walk : -0.5
    rightLeg.current.rotation.x = p.grounded ? -walk : 0.45
    torso.current.rotation.z = title ? Math.sin(t * 1.3) * 0.025 : game.slash > 0 ? Math.sin(game.slash * 20) * 0.2 : 0
    torso.current.rotation.x = game.dashTime > 0 || game.boosting ? 0.7 : 0
    arm.current.rotation.x = game.slash > 0 ? -1.5 + Math.sin(game.slash * 23) * 1.6 : -0.25
    arm.current.rotation.z = game.slash > 0 ? -0.9 : -0.12
    thrusters.current.scale.set(1, game.dashTime > 0 || game.boosting ? 4 : 0.7 + Math.sin(t * 35) * 0.2, 1)
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
    group.current.visible = e.active && Math.hypot(e.x - game.player.x, e.z - game.player.z) < 190
    if (!e.active) return
    group.current.position.set(e.x, e.y, e.z)
    body.current.rotation.y = e.yaw
    body.current.rotation.z = e.flash > 0 ? Math.sin(clock.elapsedTime * 70) * 0.15 : 0
    striker.current.visible = e.kind === 'striker' || e.kind === 'gunner' || e.kind === 'brute'
    striker.current.scale.setScalar(e.kind === 'brute' ? 1.65 : e.kind === 'gunner' ? 1.15 : 1)
    cannon.current.visible = e.kind === 'gunner'
    drone.current.visible = e.kind === 'drone'
    drone.current.rotation.z = Math.sin(clock.elapsedTime * 2 + index) * 0.12
    boss.current.visible = e.kind === 'boss'
    boss.current.scale.setScalar(1.5)
    hp.current.position.y = e.kind === 'boss' ? 5 : e.kind === 'brute' ? 2.5 : 1.7
    hp.current.scale.x = Math.max(0.01, e.hp / e.maxHp) * (e.kind === 'boss' ? 3 : 1.5)
    hp.current.quaternion.copy(gameCameraQuaternion)
    warning.current.visible = e.phase === 'windup'
    warning.current.position.y = -e.y + 0.06
    const size = e.kind === 'boss' ? (e.attack % 4 === 1 ? 24 : 10) : e.kind === 'brute' ? 8 : e.kind === 'striker' ? 4 : 2
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
      shots.current.setColorAt(i, color.set(s.friendly ? '#bceaff' : '#ff733a'))
    })
    shots.current.instanceMatrix.needsUpdate = true
    if (shots.current.instanceColor) shots.current.instanceColor.needsUpdate = true
    slash.current.visible = game.slash > 0
    slash.current.position.set(game.player.x, game.player.y + 0.1, game.player.z)
    slash.current.rotation.set(game.slashType ? 0.3 : -Math.PI / 2 + 0.15, game.player.yaw, game.slashSerial % 2 ? 0.4 : 2.5)
    slash.current.scale.setScalar(1.6 + (0.25 - game.slash) * 4)
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
    <instancedMesh ref={particles} args={[undefined, undefined, game.particles.length]} frustumCulled={false}><boxGeometry /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    <instancedMesh ref={shots} args={[undefined, undefined, game.shots.length]} frustumCulled={false}><octahedronGeometry /><meshBasicMaterial toneMapped={false} /></instancedMesh>
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
  const actualDirection = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const p = game.player
    if (game.mode === 'title') {
      cameraPosition.set(12, 7, SPAWN.z + 14)
      targetPosition.set(-3.5, 2, SPAWN.z - 3)
    } else {
      const radius = 10.5 + (game.dashTime > 0 || game.boosting ? 2 : 0)
      const horizontal = Math.cos(game.cameraPitch) * radius
      cameraPosition.set(p.x + Math.sin(game.cameraYaw) * horizontal, p.y + 1.8 + Math.max(0, Math.sin(game.cameraPitch)) * radius, p.z + Math.cos(game.cameraYaw) * horizontal)
      cameraPosition.y = Math.max(cameraPosition.y, 1.2)
      targetPosition.set(p.x, p.y + 1.2, p.z)
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
    if (camera.position.distanceTo(cameraPosition) > 90) camera.position.copy(cameraPosition)
    else camera.position.lerp(cameraPosition, 1 - Math.exp(-12 * Math.min(dt, 0.05)))
    if (game.mode !== 'title') {
      const aim = viewDirection(game.cameraYaw, game.cameraPitch)
      targetPosition.set(camera.position.x + aim.x * 100, camera.position.y + aim.y * 100, camera.position.z + aim.z * 100)
    }
    camera.lookAt(targetPosition)
    if (game.mode === 'playing') { camera.getWorldDirection(actualDirection); game.aimDirection = { x: actualDirection.x, y: actualDirection.y, z: actualDirection.z } }
    gameCameraQuaternion.copy(camera.quaternion)
    const perspective = camera as THREE.PerspectiveCamera
    const fov = game.mode === 'title' ? 46 : game.dashTime > 0 || game.boosting ? 86 : game.overdrive > 0 ? 77 : 69
    perspective.fov += (fov - perspective.fov) * Math.min(1, dt * 8)
    perspective.updateProjectionMatrix()
    const canvas = gl.domElement
    if (game.mode !== 'playing' && document.pointerLockElement === canvas) document.exitPointerLock()
  })
  return <RigidBody ref={rigidBody} type="kinematicPosition" colliders={false} position={[SPAWN.x, SPAWN.y, SPAWN.z]} enabledRotations={[false, false, false]}>
    <CapsuleCollider args={[0.65, 0.45]} />
  </RigidBody>
}

function SunLight({ shadows }: { shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null!)
  useFrame(() => { const p = game.player; light.current.position.set(p.x - 30, p.y + 65, p.z + 30); light.current.target.position.set(p.x, 0, p.z); light.current.target.updateMatrixWorld() })
  return <directionalLight ref={light} intensity={3.1} color="#fff4d3" castShadow={shadows} shadow-mapSize={[2048, 2048]}
    shadow-camera-left={-65} shadow-camera-right={65} shadow-camera-top={65} shadow-camera-bottom={-65}
    shadow-camera-near={1} shadow-camera-far={180} shadow-bias={-0.0003} shadow-normalBias={0.06} />
}

export const Scene = memo(function Scene({ onReady, quality }: { onReady: () => void; quality: 'high' | 'low' }) {
  return <Canvas shadows={quality === 'high'} dpr={quality === 'high' ? [1, 1.5] : 1}
    camera={{ position: [12, 7, SPAWN.z + 14], fov: 46, near: 0.1, far: 1600 }}
    gl={{ antialias: quality === 'high', alpha: false, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15 }}>
    <color attach="background" args={['#a9d5df']} />
    <fog attach="fog" args={['#c4e0de', 250, 1150]} />
    <hemisphereLight args={['#e4f8ff', '#779a79', 1.8]} />
    <SunLight shadows={quality === 'high'} />
    <Physics timeStep={1 / 60} gravity={[0, -27, 0]} interpolate>
      <World /><Controller onReady={onReady} />
    </Physics>
    <Pilot />
    {game.enemies.map(e => <EnemyModel key={e.id} index={e.id} />)}
    <Effects /><SkillEffects />
  </Canvas>
})
