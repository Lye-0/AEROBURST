import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game } from './core'
import { BIOMES } from './biomes'

const direction = new THREE.Vector3(), vertical = new THREE.Vector3(0,1,0)
function HazardSlot({index}:{index:number}) {
  const group=useRef<THREE.Group>(null!),ring=useRef<THREE.Mesh>(null!),disc=useRef<THREE.Mesh>(null!),beam=useRef<THREE.Mesh>(null!),column=useRef<THREE.Mesh>(null!)
  useFrame(()=>{
    const h=game.hazards[index]
    group.current.visible=h.active
    if(!h.active)return
    const warning=h.elapsed<h.warning, isLine=h.kind==='beam'||h.kind==='wind'
    const tint=warning?'#ff937b':h.kind==='spores'?'#ef786f':BIOMES[h.zone].color, progress=Math.max(0,(h.elapsed-h.warning)/h.duration)
    const radius=h.kind==='shockwave'&&!warning?h.radius*progress:h.radius
    ring.current.visible=!isLine;disc.current.visible=!isLine&&(warning||h.kind!=='shockwave');beam.current.visible=isLine;column.current.visible=!warning&&(h.kind==='lightning'||h.kind==='well')
    ring.current.position.set(h.start.x,.2,h.start.z);ring.current.scale.setScalar(Math.max(.1,radius))
    disc.current.position.copy(ring.current.position);disc.current.scale.setScalar(Math.max(.1,radius))
    ;(ring.current.material as THREE.MeshBasicMaterial).color.set(tint)
    ;(ring.current.material as THREE.MeshBasicMaterial).opacity=warning?.65:.85
    ;(disc.current.material as THREE.MeshBasicMaterial).color.set(tint)
    ;(disc.current.material as THREE.MeshBasicMaterial).opacity=warning?.05+.12*(h.elapsed/h.warning):h.kind==='spores'?.3:.12
    if(isLine){
      direction.set(h.end.x-h.start.x,h.end.y-h.start.y,h.end.z-h.start.z)
      beam.current.position.set((h.start.x+h.end.x)/2,(h.start.y+h.end.y)/2,(h.start.z+h.end.z)/2)
      beam.current.scale.set(h.radius,direction.length(),h.radius)
      beam.current.quaternion.setFromUnitVectors(vertical,direction.normalize())
      ;(beam.current.material as THREE.MeshBasicMaterial).color.set(tint);(beam.current.material as THREE.MeshBasicMaterial).opacity=warning?.15:.6
    }
    if(column.current.visible){column.current.position.set(h.start.x,h.kind==='lightning'?25:4,h.start.z);column.current.scale.set(h.kind==='lightning'?.35:radius*.35,h.kind==='lightning'?50:8,h.kind==='lightning'?.35:radius*.35);column.current.rotation.y=h.elapsed*3;(column.current.material as THREE.MeshBasicMaterial).color.set(tint)}
  })
  return <group ref={group} visible={false}>
    <mesh ref={ring} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.94,1,48]} /><meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh ref={disc} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[1,48]} /><meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh ref={beam}><cylinderGeometry args={[1,1,1,8]} /><meshBasicMaterial transparent depthWrite={false} toneMapped={false} /></mesh>
    <mesh ref={column}><cylinderGeometry args={[.25,1,1,8]} /><meshBasicMaterial transparent opacity={.65} depthWrite={false} wireframe /></mesh>
  </group>
}
export function HazardEffects(){return <>{game.hazards.map((_,i)=><HazardSlot key={i} index={i}/>)}</>}
