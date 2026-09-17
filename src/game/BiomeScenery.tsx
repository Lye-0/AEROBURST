import { memo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { game } from './core'
import { DISTRICTS } from './world'
import { BIOMES, RESONATORS, UPDRAFTS, environmentAt } from './biomes'

function Block({ p, s, color }: { p: [number, number, number]; s: [number, number, number]; color: string }) {
  return <mesh position={p} scale={s} castShadow receiveShadow><boxGeometry /><meshStandardMaterial color={color} roughness={.6} metalness={.2} /></mesh>
}
function Canopy({position,scale,color}:{position:[number,number,number];scale:[number,number,number];color:string}){
  const mesh=useRef<THREE.Mesh>(null!),world=useRef(new THREE.Vector3())
  useFrame(({camera})=>{mesh.current.getWorldPosition(world.current);const material=mesh.current.material as THREE.MeshStandardMaterial;material.opacity=world.current.distanceTo(camera.position)<9?.16:1;material.depthWrite=material.opacity===1})
  return <mesh ref={mesh} position={position} scale={scale} castShadow><icosahedronGeometry args={[1,1]} /><meshStandardMaterial color={color} flatShading transparent /></mesh>
}

function BiomeDetails({ zone }: { zone: number }) {
  const root = useRef<THREE.Group>(null!)
  const moving = useRef<THREE.Group>(null!)
  const d = DISTRICTS[zone], b = BIOMES[zone]
  useFrame(({ clock }, dt) => {
    root.current.visible = Math.hypot(game.player.x - d.x, game.player.z - d.z) < 270
    if (!moving.current) return
    moving.current.rotation.y = clock.elapsedTime * (zone === 4 ? .6 : .06)
    if (zone === 3) moving.current.position.y = Math.sin(clock.elapsedTime * .7)
    if (zone === 5) moving.current.position.y = THREE.MathUtils.damp(moving.current.position.y, game.time % 12 < 6 ? 3 : -2, 2, dt)
  })
  return <group ref={root} position={[d.x, 0, d.z]}>
    {zone === 0 && <>
      {[-1,1].map(s => <group key={s} position={[s*38,0,-30]}>
        <Block p={[0,2,0]} s={[9,4,15]} color="#668b9a" /><Block p={[0,4.4,0]} s={[10,.8,16]} color="#dae4db" />
        <Block p={[s*7,10,0]} s={[1,20,1]} color="#d7e6dd" /><Block p={[0,19,0]} s={[15,1,1.3]} color="#d7e6dd" />
        <mesh position={[0,1,10]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[8,4]} /><meshBasicMaterial color="#87d7da" /></mesh>
      </group>)}
      <group ref={moving}>{[0,1,2].map(i => <mesh key={i} position={[0,25+i*3,-30]} rotation={[Math.PI/2,.1*i,0]}><torusGeometry args={[12+i*2,.18,6,40]} /><meshBasicMaterial color="#cdf5ea" /></mesh>)}</group>
    </>}
    {zone === 1 && <>
      {Array.from({length:16},(_,i)=>{const a=i*Math.PI/8,r=43+i%3*4;return <group key={i} position={[Math.sin(a)*r,0,Math.cos(a)*r]}>
        <mesh position={[0,6,0]} castShadow><cylinderGeometry args={[.7,1.3,12,7]} /><meshStandardMaterial color="#577465" /></mesh>
        <Canopy position={[0,13,0]} scale={[6+i%3,5,6]} color={i%3===0?'#b2c48e':'#517f66'} />
        <Canopy position={[2,10,-2]} scale={[4,3,4]} color="#8eaa77" />
      </group>})}
      {Array.from({length:18},(_,i)=>{const a=i*2.4,r=30+i%3*7;return <group key={i} position={[Math.sin(a)*r,.2,Math.cos(a)*r]}>
        <mesh rotation={[-Math.PI/2,0,0]}><circleGeometry args={[3.5,9]} /><meshStandardMaterial color="#476c59" /></mesh>
        <mesh position={[0,1,0]} rotation={[0,i,.5]}><octahedronGeometry args={[1.3]} /><meshStandardMaterial color={i%2?'#d9b7c0':'#d4dc9e'} /></mesh>
      </group>})}
      <group ref={moving} />
    </>}
    {zone === 2 && <>
      {[-1,1].flatMap(s=>[-1,0,1].map(i=><group key={`${s}-${i}`} position={[s*39,0,i*22]}>
        <mesh position={[0,8,0]} castShadow><cylinderGeometry args={[2,2.5,16,8]} /><meshStandardMaterial color="#e9e0c6" /></mesh>
        <mesh position={[0,17,0]} rotation={[0,Math.PI/4,0]} castShadow><octahedronGeometry args={[4]} /><meshStandardMaterial color="#e5c888" metalness={.7} roughness={.2} /></mesh>
        <Block p={[0,16,0]} s={[7,.8,7]} color="#f2e4c5" />
      </group>))}
      {[-1,1].map(s=><Block key={s} p={[s*39,17,0]} s={[4,2,48]} color="#dcd6bf" />)}
      {[12,20,28].map(r=><mesh key={r} rotation={[-Math.PI/2,0,0]} position={[0,.09,0]}><ringGeometry args={[r,r+.16,6]} /><meshBasicMaterial color="#c3a35f" /></mesh>)}
      <group ref={moving}>{[0,1,2,3].map(i=><mesh key={i} position={[Math.sin(i*Math.PI/2)*29,5,Math.cos(i*Math.PI/2)*29]} scale={[3,6,3]} castShadow><octahedronGeometry /><meshStandardMaterial color="#998a77" flatShading /></mesh>)}</group>
    </>}
    {zone === 3 && <>
      <group ref={moving}>
        {Array.from({length:18},(_,i)=><mesh key={i} position={[Math.sin(i*2.4)*(32+i%3*9),7+i%5*4,Math.cos(i*2.4)*(32+i%3*9)]} rotation={[i*.3,i,.4]} scale={[2+i%3,1+i%2,3]} castShadow><icosahedronGeometry args={[1,0]} /><meshStandardMaterial color={i%2?'#9897b9':'#b7b4d1'} flatShading /></mesh>)}
        {[0,1,2].map(i=><mesh key={i} position={[0,26,0]} rotation={[i*.9,.3,i*.5]}><torusGeometry args={[19+i*5,.18,6,64]} /><meshBasicMaterial color={i===1?'#cab6ff':'#a4b2d2'} /></mesh>)}
      </group>
      {Array.from({length:16},(_,i)=><mesh key={i} position={[Math.sin(i*2.4)*33,.1,Math.cos(i*2.4)*33]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.5,8]} /><meshBasicMaterial color="#dfd0ff" /></mesh>)}
    </>}
    {zone === 4 && <>
      {[-1,1].flatMap(s=>[-1,1].map(t=><group key={`${s}-${t}`} position={[s*41,0,t*32]}>
        <Block p={[0,11,0]} s={[3,22,3]} color="#546c7e" />
        {[8,14,20].map(y=><mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[4,.4,6,32]} /><meshStandardMaterial color="#adc4d0" emissive="#71c9e5" emissiveIntensity={.3} /></mesh>)}
      </group>))}
      {[-1,1].map(s=><mesh key={s} position={[s*19,.09,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[12,80]} /><meshStandardMaterial color="#82999c" metalness={.8} roughness={.2} /></mesh>)}
      <group ref={moving} position={[0,25,0]}>{[0,1,2].map(i=><group key={i} rotation={[0,i*Math.PI*2/3,0]}><Block p={[15,0,0]} s={[22,.6,3]} color="#7e9ca9" /></group>)}</group>
    </>}
    {zone === 5 && <>
      {Array.from({length:12},(_,i)=><group key={i} position={[Math.sin(i*Math.PI/6)*53,0,Math.cos(i*Math.PI/6)*53]} rotation={[0,i*Math.PI/6,0]}>
        <mesh position={[0,7,0]} castShadow><coneGeometry args={[3,14,4]} /><meshStandardMaterial color="#554958" metalness={.4} /></mesh>
        <mesh position={[0,13,0]}><octahedronGeometry args={[1.5]} /><meshBasicMaterial color="#ffc393" /></mesh>
      </group>)}
      <group ref={moving}>{[0,1].map(i=><mesh key={i} position={[0,23+i*10,0]} rotation={[Math.PI/2,.15*i,0]}><torusGeometry args={[29+i*7,.4,6,64]} /><meshStandardMaterial color="#f6cda1" metalness={.6} /></mesh>)}</group>
      {[18,32,45].map(r=><mesh key={r} position={[0,.09,0]} rotation={[-Math.PI/2,0,.25]}><ringGeometry args={[r,r+.3,6]} /><meshBasicMaterial color="#b89a91" /></mesh>)}
    </>}
    <mesh position={[0,.07,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[d.radius+2,d.radius+3,80]} /><meshBasicMaterial color={b.color} transparent opacity={.35} /></mesh>
  </group>
}

function Resonator({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null!), diamond = useRef<THREE.Mesh>(null!)
  const item = RESONATORS[index], b = BIOMES[item.zone]
  useFrame(({clock})=>{group.current.visible=game.resonatorCooldowns[index]<=0;diamond.current.rotation.y=clock.elapsedTime;diamond.current.position.y=Math.sin(clock.elapsedTime*2)*.2})
  return <group ref={group} position={[item.x,item.y,item.z]}>
    <mesh ref={diamond}><icosahedronGeometry args={[1,0]} /><meshBasicMaterial color={b.color} toneMapped={false} /></mesh>
    <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.7,.12,6,24]} /><meshBasicMaterial color={b.color} /></mesh>
    <mesh position={[0,-1.5,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[2.2,2.5,24]} /><meshBasicMaterial color={b.color} /></mesh>
    <mesh position={[0,1.9,0]} rotation={[0,0,Math.PI]}><coneGeometry args={[.35,.6,4]} /><meshBasicMaterial color="#efffdf" /></mesh>
  </group>
}

const scratch = new THREE.Object3D(), sky = new THREE.Color(), fog = new THREE.Color()
function LocalAtmosphere() {
  const { scene } = useThree(), particles = useRef<THREE.InstancedMesh>(null!)
  useFrame(({clock}, dt)=>{
    const env = game.mode === 'title' ? environmentAt(0,164,0) : game.environment
    const biome = env.zone < 0 ? null : BIOMES[env.zone], t = game.mode === 'paused' ? game.time : clock.elapsedTime
    sky.set('#a9d5df'); fog.set('#c4e0de')
    if(biome){sky.lerp(new THREE.Color(env.zone===5?(game.time%12<6?'#807cad':'#bca28c'):biome.sky),env.weight);fog.lerp(new THREE.Color(biome.fog),env.weight)}
    if(scene.background instanceof THREE.Color)scene.background.lerp(sky,1-Math.exp(-dt*2))
    if(scene.fog instanceof THREE.Fog){scene.fog.color.lerp(fog,1-Math.exp(-dt*2));scene.fog.near=250-(env.zone===4?150*env.weight:0);scene.fog.far=1150-(env.zone===4?580*env.weight:0)}
    particles.current.visible=env.zone>=0
    if(!biome)return
    ;(particles.current.material as THREE.MeshBasicMaterial).color.set(biome.color)
    const d=DISTRICTS[env.zone]
    for(let i=0;i<140;i++){
      const x=((i*17.31+t*(env.zone===1?6:1))%130)-65,z=((i*31.73)%130)-65
      const y=env.zone===4?35-(i*2.13+t*23)%35:2+(i*1.53+t*(env.zone===3?.2:.6))%26
      scratch.position.set(d.x+x,y,d.z+z);scratch.rotation.set(0,i+t,env.zone===4?-.15:t*.5)
      scratch.scale.set(env.zone===4?.03:.12,env.zone===4?1.4:.08,env.zone===1?.25:.08);scratch.updateMatrix();particles.current.setMatrixAt(i,scratch.matrix)
    }
    particles.current.instanceMatrix.needsUpdate=true
  })
  return <instancedMesh ref={particles} args={[undefined,undefined,140]} frustumCulled={false}><boxGeometry /><meshBasicMaterial transparent opacity={.55} depthWrite={false} /></instancedMesh>
}

export const BiomeScenery = memo(function BiomeScenery(){
  return <>
    {DISTRICTS.map(d=><BiomeDetails key={d.id} zone={d.id} />)}
    {RESONATORS.map((r,i)=><Resonator key={r.id} index={i} />)}
    {UPDRAFTS.map((u,i)=><group key={i} position={[u.x,0,u.z]}>
      <mesh position={[0,15,0]}><cylinderGeometry args={[u.radius,u.radius,30,24,1,true]} /><meshBasicMaterial color="#a0f6ee" transparent opacity={.07} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      {[0,6,12,18,24].map(y=><mesh key={y} position={[0,y+.1,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[u.radius,.065,6,32]} /><meshBasicMaterial color="#9beee4" transparent opacity={.5} depthWrite={false} /></mesh>)}
    </group>)}
    <LocalAtmosphere />
  </>
})
