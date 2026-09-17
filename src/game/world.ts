export const FIELD = { width: 760, depth: 960, centerZ: -230, minZ: -710, maxZ: 250 }
export const SPAWN = { x: 0, y: 1.15, z: 164 }
export const DISTRICTS = [
  { id: 0, x: 0, z: 125, radius: 50, name: 'ドーン・ポート', english: 'DAWN PORT', color: '#75dec7', count: 10, waves: 2 },
  { id: 1, x: -205, z: -35, radius: 62, name: '翠風の庭園', english: 'VERDANT GARDENS', color: '#b6d990', count: 14, waves: 2 },
  { id: 2, x: 210, z: -85, radius: 64, name: '白亜の回廊', english: 'IVORY CAUSEWAY', color: '#ffd294', count: 16, waves: 2 },
  { id: 3, x: -160, z: -285, radius: 60, name: '天球観測所', english: 'CELESTIAL ARRAY', color: '#ada9f0', count: 16, waves: 2 },
  { id: 4, x: 170, z: -370, radius: 65, name: '嵐の発電区', english: 'STORM ENGINE', color: '#71cde9', count: 18, waves: 2 },
  { id: 5, x: 0, z: -590, radius: 78, name: '天空の王座', english: 'THE SKY THRONE', color: '#ff9f7d', count: 9, waves: 1 },
] as const
export const ROUTES = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 5]] as const
export const BOOST_GATES = ROUTES.flatMap(([a, b], route) => [0.3, 0.68].map((t, i) => ({
  id: route * 2 + i, x: DISTRICTS[a].x + (DISTRICTS[b].x - DISTRICTS[a].x) * t,
  z: DISTRICTS[a].z + (DISTRICTS[b].z - DISTRICTS[a].z) * t,
  yaw: Math.atan2(DISTRICTS[b].x - DISTRICTS[a].x, DISTRICTS[b].z - DISTRICTS[a].z),
})))
export const CACHES = DISTRICTS.slice(0, 5).flatMap(d => [0, 1, 2].map(i => ({
  id: d.id * 3 + i, x: d.x + Math.sin(i * 2.1 + 0.7) * (d.radius + 18),
  y: 2.4, z: d.z + Math.cos(i * 2.1 + 0.7) * (d.radius + 18),
})))
export const LAUNCH_PADS = DISTRICTS.flatMap(d => [-1, 1].map(side => ({ x: d.x + side * (d.radius - 9), z: d.z + 5 })))
export const inField = (x: number, z: number) => Math.abs(x) < FIELD.width / 2 && z > FIELD.minZ && z < FIELD.maxZ
