import { DISTRICTS } from './world'

export const BIOMES = [
  { name: '浮揚気流', rule: '低重力。青い風柱で上昇・燃料回復。', hint: '風圧砲は横へ回避。風柱を使って空中から接近。', gravity: .7, speed: 1, fuel: .8, ground: '#afcfd0', sky: '#addce5', fog: '#d4eee7', color: '#79eaf1', warden: 'ガスト・コマンダー', specialist: '風圧砲兵', boon: 'ブリンクの自然回復が速くなる', item: '追い風', itemHint: '12秒間ブースト燃料消費ゼロ', damage: 18 },
  { name: '翠風と胞子', rule: '通常重力と横風。赤い胞子床は上空で回避。', hint: '胞子床の外で戦うか、空中戦で根の攻撃を避ける。', gravity: 1.1, speed: 1, fuel: 1, ground: '#6b947b', sky: '#b0cfc1', fog: '#c2d4b0', color: '#c3e68b', warden: 'ブルーム・タイラント', specialist: '胞子散布機', boon: '撃破時の耐久回復量が増える', item: '生命の胞子', itemHint: '耐久+30、8秒間ゆっくり再生', damage: 17 },
  { name: '重圧領域', rule: '高重力。着地は速く、急降下攻撃の威力上昇。', hint: '光線の予告線から横へブリンク。攻撃後のコアが弱点。', gravity: 1.8, speed: 1.12, fuel: 1.2, ground: '#dfcaa2', sky: '#e6d5b4', fog: '#e5d5bb', color: '#ffe4a3', warden: 'プリズム・センチネル', specialist: '屈折狙撃機', boon: '急降下の範囲と威力が上がる', item: '重装の核', itemHint: '10秒間被ダメージ半減', damage: 25 },
  { name: '微重力軌道', rule: '微重力。長い滞空と燃料節約。紫の井戸に注意。', hint: '重力井戸からブリンクで離脱。追尾弾はイージスで反射。', gravity: .32, speed: 1, fuel: .55, ground: '#797eaa', sky: '#707fba', fog: '#a0add3', color: '#c8b5ff', warden: 'エクリプス・オラクル', specialist: '重力術式機', boon: 'すべてのスキル待機時間の回復が速くなる', item: '時空の欠片', itemHint: '全スキルの残り待機時間を半減', damage: 20 },
  { name: '雷雨・帯電', rule: 'やや重い重力。雷の予告円から移動して回避。', hint: '雷は高度を問わず命中。予告が出た地点から離れる。', gravity: 1.15, speed: 1, fuel: 1, ground: '#577b89', sky: '#526a83', fog: '#7d9daa', color: '#80dfff', warden: 'ライジン・コンデンサー', specialist: '雷撃誘導機', boon: '攻撃時の必殺ゲージ獲得量が増える', item: 'オーバーチャージ', itemHint: '6秒間オーバードライブ、必殺ゲージ+20', damage: 24 },
  { name: '重力潮汐', rule: '6秒ごとに微重力と高重力が切り替わる。', hint: '浮揚期は空中戦、重圧期は素早く着地して光線を回避。', gravity: .5, speed: 1, fuel: 1, ground: '#736875', sky: '#977e98', fog: '#baa2ad', color: '#ffb686', warden: '天空の覇王', specialist: '潮汐近衛機', boon: '天空の王座を解放', item: '王冠の加護', itemHint: '4秒間イージス、燃料とブリンク回復', damage: 25 },
] as const

export type Environment = { zone: number; weight: number; gravity: number; speed: number; fuel: number; windX: number; windZ: number; phase: string; phaseRemaining: number }
const bound = (v: number) => Math.max(0, Math.min(1, v))
export function environmentAt(x: number, z: number, time: number): Environment {
  let zone = -1, weight = 0
  for (const d of DISTRICTS) {
    const w = bound((d.radius + 22 - Math.hypot(x - d.x, z - d.z)) / 22)
    if (w > weight) { zone = d.id; weight = w }
  }
  if (zone < 0) return { zone, weight: 0, gravity: 1, speed: 1, fuel: 1, windX: 0, windZ: 0, phase: '開放空域', phaseRemaining: 0 }
  const biome = BIOMES[zone], heavy = time % 12 >= 6
  const g = zone === 5 ? heavy ? 1.65 : .5 : biome.gravity
  return { zone, weight, gravity: 1 + (g - 1) * weight, speed: 1 + (biome.speed - 1) * weight,
    fuel: 1 + (biome.fuel - 1) * weight,
    windX: zone === 1 ? Math.sin(time * .25) * 8 * weight : 0,
    windZ: zone === 1 ? Math.cos(time * .25) * 4 * weight : 0,
    phase: zone === 5 ? heavy ? '重圧期' : '浮揚期' : biome.name,
    phaseRemaining: zone === 5 ? 6 - time % 6 : 0 }
}

export const RESONATORS = DISTRICTS.flatMap(d => [-1, 1].map((side, index) => ({
  id: d.id * 2 + index, zone: d.id, x: d.x + side * 30, y: 1.7, z: d.z + 20,
})))
export const UPDRAFTS = [{ x: -28, z: 112, radius: 6 }, { x: 25, z: 100, radius: 6 }]
