import type { CSSProperties } from 'react'
import { game, SKILLS, rankFor, type Snapshot } from './game/core'
import { CACHES, DISTRICTS, FIELD, ROUTES } from './game/world'

const timeLabel = (t: number) => Math.floor(t / 60).toString().padStart(2, '0') + ':' + Math.floor(t % 60).toString().padStart(2, '0')
const glyphs = ['⌁', '◎', '↗', '⬡', '⋈', 'ϟ']

function LocalRadar() {
  const p = game.player, d = DISTRICTS[game.objective]
  const dx = d.x - p.x, dz = d.z - p.z, scale = Math.min(0.45, 43 / (Math.hypot(dx, dz) || 1))
  return <div className="local-radar"><svg viewBox="0 0 100 100" role="img" aria-label="周辺レーダー">
    <circle cx="50" cy="50" r="47" fill="#153e4870" stroke="#ffffff50" strokeWidth=".7" />
    <circle cx="50" cy="50" r="25" fill="none" stroke="#ffffff25" strokeWidth=".5" />
    <path d="M3 50h94M50 3v94" stroke="#ffffff30" strokeWidth=".5" />
    <text x="50" y="11" textAnchor="middle" fill="#edf5df" fontSize="6">N</text>
    {game.enemies.filter(e => e.active && Math.hypot(e.x - p.x, e.z - p.z) < 95).map(e => <circle key={e.id} cx={50 + (e.x - p.x) * .45} cy={50 + (e.z - p.z) * .45} r={e.kind === 'boss' ? 3.5 : 1.7} fill="#ff9c73" />)}
    <rect x={48 + dx * scale} y={48 + dz * scale} width="4" height="4" fill="#d8ffb9" />
    <path d="m0-5-3 9 3-2 3 2Z" fill="#f5fff2" transform={`translate(50,50) rotate(${-game.cameraYaw * 180 / Math.PI})`} />
  </svg><span>100 M / LOCAL SCAN</span></div>
}

export function WorldMap({ state, onSelect }: { state: Snapshot; onSelect: (id: number) => void }) {
  const x = (v: number) => (v + FIELD.width / 2) / FIELD.width * 480
  const z = (v: number) => (v - FIELD.minZ) / FIELD.depth * 560
  const labels = { locked: 'シールド稼働中', dormant: '未解放', combat: '交戦中', cleared: '解放済み' }
  return <div className="world-map"><div className="map-chart"><svg viewBox="0 0 480 560" role="img" aria-label="6地区の全域マップ。右の地区一覧から目的地を選択できます。">
    <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#23495715" /></pattern></defs>
    <rect width="480" height="560" fill="url(#grid)" />
    {ROUTES.map(([a,b]) => <line key={`${a}-${b}`} x1={x(DISTRICTS[a].x)} y1={z(DISTRICTS[a].z)} x2={x(DISTRICTS[b].x)} y2={z(DISTRICTS[b].z)} stroke="#9fbeb4" strokeWidth="4" />)}
    {CACHES.filter(c => !game.collected.has(c.id)).map(c => <circle key={c.id} cx={x(c.x)} cy={z(c.z)} r="2.5" fill="#c09b53" />)}
    {DISTRICTS.map(d => <g key={d.id}>
      <circle cx={x(d.x)} cy={z(d.z)} r={d.radius * .5} fill={state.zones[d.id].state === 'cleared' ? '#c6dfbe' : '#d8e4db'} stroke={state.objective === d.id ? '#356966' : '#8dadac'} strokeWidth={state.objective === d.id ? 2.5 : 1} />
      <text x={x(d.x)} y={z(d.z) + 4} fill="#264f56" textAnchor="middle" fontSize="14" fontWeight="700">{state.zones[d.id].state === 'cleared' ? '✓' : String(d.id + 1).padStart(2, '0')}</text>
      <text x={x(d.x)} y={z(d.z) + d.radius * .5 + 15} fill="#42676d" textAnchor="middle" fontSize="10">{d.name}</text>
    </g>)}
    <circle cx={x(game.player.x)} cy={z(game.player.z)} r="7" fill="#fff" stroke="#25767e" strokeWidth="2" /><circle cx={x(game.player.x)} cy={z(game.player.z)} r="2.5" fill="#25767e" />
  </svg><span>FRONTIER / 760 × 960 M</span></div><div className="map-districts"><p>目的地を選んでナビを設定。<br />中枢を5つ解放すると、王座の結界が解除されます。</p>
    {DISTRICTS.map(d => <button key={d.id} disabled={state.zones[d.id].state === 'locked' || state.zones[d.id].state === 'cleared'} className={state.objective === d.id ? 'selected' : ''} onClick={() => onSelect(d.id)}>
      <b>{String(d.id + 1).padStart(2, '0')}</b><span>{d.name}<small>{labels[state.zones[d.id].state]}</small></span><i>{state.zones[d.id].state === 'cleared' ? '✓' : '↗'}</i>
    </button>)}<div className="cache-count">DATA CACHE <b>{state.collected} / {CACHES.length}</b></div></div></div>
}

export function FlightHUD({ state, onPause, onMap }: { state: Snapshot; onPause: () => void; onMap: () => void }) {
  const objective = DISTRICTS[state.objective], dz = objective.z - game.player.z, dx = objective.x - game.player.x
  const heading = Math.atan2(-dx, -dz) - game.cameraYaw
  const delta = Math.atan2(Math.sin(heading), Math.cos(heading))
  const active = state.objectiveDistance < objective.radius + 15
  return <div className={`hud frontier-hud ${state.overdrive > 0 ? 'overdrive-active' : ''} ${state.bossMaxHp > 0 ? 'has-boss' : ''}`}>
    <div className="hud-top">
      <div className="pilot-status"><div className="status-label"><span className="live-dot" /> AE–01 <span>FRONTIER FRAME</span><b>{Math.ceil(state.hp)}<small>/{state.maxHp}</small></b></div><div className="health-track"><div style={{ width: `${state.hp / state.maxHp * 100}%` }} /></div><div className="status-sub"><span>HULL INTEGRITY</span><span>{state.hp > 40 ? 'SYSTEM NORMAL' : 'HULL CRITICAL'}</span></div><div className="liberation-pips">{state.zones.slice(0,5).map((z,i) => <i key={i} className={z.state === 'cleared' ? 'complete' : ''} />)}<span>{Math.min(state.cleared,5)} / 5 CORES</span></div></div>
      <div className="objective-banner"><span className="eyebrow">{active ? state.objective === 5 ? 'FINAL ENCOUNTER' : 'LIBERATE THE CORE' : 'NEXT DESTINATION'}</span><strong>{objective.name}</strong><div><span>{Math.round(state.objectiveDistance)} m</span><small>{active ? `敵 ${state.remaining} / 増援 ${state.zones[state.objective].formation} of ${objective.waves}` : 'Shift長押しで高速移動'}</small></div></div>
      <div className="score-status"><span className="eyebrow">MISSION SCORE</span><b>{state.score.toLocaleString()}</b><span>{timeLabel(state.time)}<button className="pause-button" onClick={onPause} aria-label="ポーズ">Ⅱ</button></span></div>
    </div>
    <div className="compass-strip"><i /><i /><i />{[['N',0],['E',-Math.PI/2],['S',Math.PI],['W',Math.PI/2]].map(([label,angle]) => {
      const relative = Math.atan2(Math.sin(Number(angle)-game.cameraYaw), Math.cos(Number(angle)-game.cameraYaw))
      return Math.abs(relative) <= Math.PI/2 ? <span className="cardinal" key={label} style={{ left: `${50-Math.sin(relative)*47}%` }}>{label}</span> : null
    })}<b style={{ left: `${50 - Math.sin(delta) * 43}%` }}>{Math.abs(delta) > Math.PI / 2 ? '↶' : '◆'}<small>{String(state.objective + 1).padStart(2,'0')}</small></b></div>
    {state.bossMaxHp > 0 && <div className="boss-hud"><span>G–Ω / SOVEREIGN OF THE SKY</span><div><i style={{ width: `${state.bossHp / state.bossMaxHp * 100}%` }} /></div><p>{state.bossAttack || (state.bossHp < state.bossMaxHp / 2 ? 'OVERLOAD / PHASE II' : 'PHASE I')}</p></div>}
    {state.message && <div className="announcement" key={state.message}><strong>{state.message}</strong><p>{state.messageSub}</p></div>}
    <div className="crosshair" aria-hidden="true"><i /><i /></div>
    {!state.locked && state.mode === 'playing' && <div className="capture-hint">画面をクリックして操作開始<span>Escで解除</span></div>}
    <div className="traversal-meter"><b>{Math.round(state.speed * 3.6)}<small>KM/H</small></b><div className="fuel-track"><i style={{ height: `${state.fuel}%` }} /></div><span>{state.boosting ? 'BOOST' : 'FUEL'}</span></div>
    <div className="hud-bottom"><div className="radar-block"><LocalRadar /><button onClick={onMap}><kbd>M</kbd> 全域マップ ↗</button></div>
      <div className="arsenal"><div className="arsenal-top"><div className="blink-charge">{[0,1,2].map(i => <i key={i} style={{ background: i < state.dashes ? '#d8ffbd' : `linear-gradient(90deg,#d8ffbd ${i === state.dashes ? state.dashCharge / .75 * 100 : 0}%,#ffffff20 0)` }} />)}<span><kbd>SHIFT</kbd> BLINK / HOLD TO BOOST</span></div><span className="skill-notice">{state.skillNotice || (state.overdrive > 0 ? `OVERDRIVE ${state.overdrive.toFixed(1)}s` : '撃破でブリンク回復 / 全スキルの待機時間短縮')}</span></div>
        <div className="skill-bar">{SKILLS.map((s,i) => <div key={s.id} className={`skill-slot ${state.cooldowns[s.id] > 0 ? 'cooling' : 'available'}`} style={{ '--skill-color': s.color } as CSSProperties} title={s.description}>
          <div className="cooldown-cover" style={{ height: `${state.cooldowns[s.id] / s.cooldown * 100}%` }} /><kbd>{s.key}</kbd><span className="skill-glyph">{glyphs[i]}</span><b>{state.cooldowns[s.id] > 0 ? state.cooldowns[s.id].toFixed(1) : s.short}</b><small>{s.name}</small>
        </div>)}<div className={`skill-slot ultimate-slot ${state.energy >= 100 ? 'available' : 'cooling'}`} style={{ '--skill-color': '#d8ffbe' } as CSSProperties}><div className="cooldown-cover" style={{ height: `${100-state.energy}%` }} /><kbd>Q</kbd><span className="skill-glyph">✦</span><b>{state.energy >= 100 ? 'READY' : Math.floor(state.energy) + '%'}</b><small>エアロバースト</small></div></div>
      </div>
      <div className={`combo-status ${state.combo > 0 ? 'active' : ''}`}><span className="combo-rank">{rankFor(state.combo)}</span><div><span className="eyebrow">{state.combo >= 60 ? 'ABSOLUTE DOMINION' : 'CHAIN COMBO'}</span><strong>{state.combo}<small>HITS</small></strong><span className="kill-count">{state.kills} DESTROYED</span></div></div>
    </div>
    {game.pointerFallback && state.mode === 'playing' && <div className="fallback-hint">視点：中央ドラッグ / 矢印キー</div>}
  </div>
}
