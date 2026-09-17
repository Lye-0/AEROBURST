import { Component, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Scene } from './game/Scene'
import { game, clamp, SKILLS, type Settings } from './game/core'
import { FlightHUD, WorldMap } from './FlightHUD'

const controls = [
  ['W A S D', '移動', 'カメラの向きに合わせて移動'], ['MOUSE', '視点', 'マウスを動かして見渡す'],
  ['SPACE', '二段ジャンプ / 滑空', '空中で長押しすると滑空。ブーストと併用で上昇'], ['SHIFT', 'ブリンク / ブースト', '視点方向へ瞬間移動。長押しで高速飛行。撃破で3回分回復'],
  ['左クリック', '斬撃', '長押しで連続攻撃。空中でも使用可能'], ['右クリック', '打ち上げ / 急降下', '地上では敵を打ち上げ、空中では急降下'],
  ...SKILLS.map(s => [s.key, s.name, s.description]),
  ['Q', 'エアロバースト', 'ゲージ100%で半径48mの敵を一掃'], ['M', '全域マップ', '6地区の状況確認と目的地の指定'], ['ESC / P', 'ポーズ', '設定・操作確認・リトライ'],
]
const timeLabel = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`
function Mark() { return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m19 2-15 18h11l-2 10L29 11H18l1-9Z" fill="currentColor" /></svg> }
function SoundIcon({ muted }: { muted: boolean }) { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4V9Z" stroke="currentColor" strokeWidth="1.5" />{muted ? <path d="m17 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.5" /> : <path d="M17 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14" stroke="currentColor" strokeWidth="1.5" />}</svg> }

class SceneBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() {
    return this.state.error ? <div className="engine-error"><h2>3D画面を起動できませんでした</h2><p>ブラウザのハードウェアアクセラレーションを有効にして、再読み込みしてください。</p><button className="primary" onClick={() => location.reload()}>再読み込み</button></div> : this.props.children
  }
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null!)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    root.querySelector<HTMLButtonElement>('button')?.focus()
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      if (event.key === 'Tab') {
        const items = [...root.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]')].filter(el => !el.hasAttribute('disabled'))
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    root.addEventListener('keydown', key)
    return () => { root.removeEventListener('keydown', key); previous?.focus() }
  }, [onClose])
  return <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
    <div className="modal-heading"><div><span className="eyebrow">{subtitle}</span><h2>{title}</h2></div><button className="icon-button" aria-label="閉じる" onClick={onClose}>×</button></div>
    {children}
  </div></div>
}

function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  return <div className="settings-list">
    <label className="setting"><span>音量 <b>{Math.round(settings.volume * 100)}%</b></span><input aria-label="音量" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={e => onChange({ ...settings, volume: +e.target.value })} /></label>
    <label className="setting"><span>マウス感度 <b>{settings.sensitivity.toFixed(1)}</b></span><input aria-label="マウス感度" type="range" min="0.3" max="2" step="0.1" value={settings.sensitivity} onChange={e => onChange({ ...settings, sensitivity: +e.target.value })} /></label>
    <label className="setting toggle"><span>画面の揺れ</span><input type="checkbox" checked={settings.shake} onChange={e => onChange({ ...settings, shake: e.target.checked })} /></label>
    <label className="setting toggle"><span>画面のフラッシュ</span><input type="checkbox" checked={settings.flashes} onChange={e => onChange({ ...settings, flashes: e.target.checked })} /></label>
    <div className="setting"><span>描画品質</span><div className="segmented" role="group" aria-label="描画品質"><button aria-pressed={settings.quality === 'high'} onClick={() => onChange({ ...settings, quality: 'high' })}>高画質</button><button aria-pressed={settings.quality === 'low'} onClick={() => onChange({ ...settings, quality: 'low' })}>軽量</button></div></div>
    <p className="setting-note">設定は自動保存されます。動作が重い場合は「軽量」をお試しください。</p>
  </div>
}

function useGameInput(onMap: () => void) {
  useEffect(() => {
    const canvas = () => document.querySelector('canvas')
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input, select, textarea')) return
      if (event.code === 'Escape' || event.code === 'KeyP') {
        if (game.mode === 'playing') { game.pause(); if (document.pointerLockElement) document.exitPointerLock() }
        return
      }
      if (game.mode !== 'playing') return
      if (event.code === 'KeyM') { event.preventDefault(); onMap(); return }
      if (['Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ'].includes(event.code)) event.preventDefault()
      game.keys.add(event.code)
      if (event.code === 'ArrowLeft') { game.cameraYaw += 0.12; event.preventDefault() }
      if (event.code === 'ArrowRight') { game.cameraYaw -= 0.12; event.preventDefault() }
      if (event.code === 'ArrowUp') { game.cameraPitch = clamp(game.cameraPitch - 0.1, -0.85, 1.1); event.preventDefault() }
      if (event.code === 'ArrowDown') { game.cameraPitch = clamp(game.cameraPitch + 0.1, -0.85, 1.1); event.preventDefault() }
      if (!event.repeat) {
        if (event.code === 'Space') game.action('jump')
        if (event.code.startsWith('Shift')) game.action('dash')
        if (event.code === 'KeyQ') game.action('burst')
        const skill = SKILLS.find(s => 'Key' + s.key === event.code)
        if (skill) { event.preventDefault(); game.action(skill.id) }
      }
    }
    const keyup = (event: KeyboardEvent) => game.keys.delete(event.code)
    const mousemove = (event: MouseEvent) => {
      if (game.mode !== 'playing' || (!document.pointerLockElement && !(game.pointerFallback && event.buttons === 4))) return
      game.cameraYaw -= event.movementX * 0.0022 * game.settings.sensitivity
      game.cameraPitch = clamp(game.cameraPitch + event.movementY * 0.0018 * game.settings.sensitivity, -0.85, 1.1)
    }
    const mousedown = (event: MouseEvent) => {
      if (game.mode !== 'playing' || (event.target !== canvas() && !document.pointerLockElement)) return
      if (!document.pointerLockElement && !game.pointerFallback) { requestControl(); return }
      if (event.button === 1) event.preventDefault()
      if (event.button === 0) { game.keys.add('Mouse0'); game.action('attack') }
      if (event.button === 2) game.action('heavy')
    }
    const mouseup = () => game.keys.delete('Mouse0')
    const context = (event: MouseEvent) => { if (event.target === canvas() || document.pointerLockElement) event.preventDefault() }
    const lockchange = () => {
      const was = game.locked
      game.locked = !!document.pointerLockElement || game.pointerFallback
      if (was && !game.locked) game.pause()
      game.publish()
    }
    const blur = () => game.pause()
    const visibility = () => { if (document.hidden) game.pause() }
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup)
    window.addEventListener('mousemove', mousemove); window.addEventListener('mousedown', mousedown); window.addEventListener('mouseup', mouseup)
    window.addEventListener('contextmenu', context); window.addEventListener('blur', blur)
    document.addEventListener('pointerlockchange', lockchange); document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup)
      window.removeEventListener('mousemove', mousemove); window.removeEventListener('mousedown', mousedown); window.removeEventListener('mouseup', mouseup)
      window.removeEventListener('contextmenu', context); window.removeEventListener('blur', blur)
      document.removeEventListener('pointerlockchange', lockchange); document.removeEventListener('visibilitychange', visibility)
    }
  }, [onMap])
}
function requestControl() {
  game.audio.unlock()
  const canvas = document.querySelector('canvas')
  if (canvas?.requestPointerLock) {
    try { const result = canvas.requestPointerLock(); if (result) void result.catch(() => { game.pointerFallback = true; game.locked = true; game.publish() }) } catch { game.pointerFallback = true; game.locked = true; game.publish() }
  } else { game.pointerFallback = true; game.locked = true; game.publish() }
}

export function App() {
  const state = useSyncExternalStore(game.subscribe, game.getSnapshot)
  const [ready, setReady] = useState(false)
  const [panel, setPanel] = useState<'settings' | 'controls' | 'map' | null>(null)
  const [settings, setSettings] = useState(game.settings)
  const onReady = useCallback(() => setReady(true), [])
  const closePanel = useCallback(() => setPanel(null), [])
  const openMap = useCallback(() => { game.pause(); setPanel('map') }, [])
  useGameInput(openMap)
  useEffect(() => {
    // Explicit development-only QA surface. Never bundled into production.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
      Object.assign(window, { __AEROBURST__: game })
      return () => { delete (window as unknown as Record<string, unknown>).__AEROBURST__ }
    }
  }, [])
  function updateSettings(next: Settings) { setSettings(next); game.saveSettings(next) }
  function start() { setPanel(null); game.start(); requestControl() }
  function resume() { setPanel(null); game.resume(); requestControl() }
  const title = state.mode === 'title'
  const result = state.mode === 'won' || state.mode === 'lost'
  return <main className={`app ${title ? 'is-title' : 'is-playing'}`}>
    <div className="world"><SceneBoundary><Suspense fallback={null}><Scene onReady={onReady} quality={settings.quality} /></Suspense></SceneBoundary></div>
    <div className="vignette" />
    {settings.flashes && state.mode === 'playing' && <div className="damage-vignette" style={{ opacity: game.damageFlash * 1.5 }} />}
    {title ? <>
      <header className="title-header"><a className="brand" href="#" aria-label="AEROBURST タイトル"><Mark /><span>AEROBURST<small>AERIAL COMBAT SYSTEM</small></span></a><div className="header-actions"><span className="build-label"><i /> SYSTEM ONLINE</span><button className="icon-button" onClick={() => updateSettings({ ...settings, volume: settings.volume ? 0 : 0.45 })} aria-label={settings.volume ? '消音にする' : '音を有効にする'}><SoundIcon muted={!settings.volume} /></button><button className="text-button" onClick={() => setPanel('settings')}>設定 <span>↗</span></button></div></header>
      <section className="title-content"><div className="edition"><span>01</span> FRONTIER EXPANSION <i /></div><h1>AERO<br /><span>BURST</span></h1><p className="tagline">空を、連鎖しろ。</p><p className="intro">飛び込め。斬り抜けろ。<br />広がる世界を、解き放て。</p><div className="title-buttons"><button className="primary launch-button" disabled={!ready} onClick={start}><span>{ready ? '出撃する' : '機体を準備中…'}<small>{ready ? 'LAUNCH MISSION' : 'INITIALIZING'}</small></span><span className="button-arrow">↗</span></button><button className="secondary" onClick={() => setPanel('controls')}>操作方法 <span>↗</span></button></div><div className="mission-meta"><span><i /> SINGLE PLAYER</span><span>6 DISTRICTS / OPEN FIELD</span><span>KEYBOARD + MOUSE</span></div></section>
      <div className="pilot-label"><span>AE–01</span><i /><div>BURST FRAME<small>広域制圧戦闘機</small></div></div>
      <div className="title-coordinate">ALT. 8,400 M<br />35° 41′ N / 139° 41′ E</div>
      <footer className="title-footer"><div className="mechanic"><span>01 /</span><strong>DASH</strong><p>距離を、消す。</p></div><div className="mechanic"><span>02 /</span><strong>SLASH</strong><p>撃破を、つなぐ。</p></div><div className="mechanic"><span>03 /</span><strong>BURST</strong><p>空域を、制する。</p></div><div className="record"><span>PERSONAL BEST</span><strong>{state.best.toLocaleString().padStart(6, '0')}</strong></div></footer>
    </> : <FlightHUD state={state} onPause={() => game.pause()} onMap={openMap} />}
    {state.mode === 'paused' && !panel && <div className="modal-backdrop"><section className="pause-panel" aria-label="ポーズメニュー"><span className="eyebrow">FLIGHT SUSPENDED</span><h2>ひと息、つこう。</h2><p>準備ができたら、もう一度空へ。</p><button className="primary" onClick={resume} autoFocus>戦闘に戻る <span>↗</span></button><button className="secondary" onClick={() => setPanel('settings')}>設定</button><button className="secondary" onClick={() => setPanel('controls')}>操作方法</button><div className="pause-links"><button onClick={start}>最初からやり直す</button><button onClick={() => game.title()}>タイトルへ</button></div></section></div>}
    {result && <div className="modal-backdrop result-backdrop"><section className="result-panel"><span className="eyebrow">{state.mode === 'won' ? 'ALL SECTORS CLEAR' : 'SIGNAL LOST'}</span><h2>{state.mode === 'won' ? <>空は、<br />君のもの。</> : <>もう一度、<br />飛び立とう。</>}</h2><p>{state.mode === 'won' ? '守護機の停止を確認。作戦完了。' : '機体の耐久値がゼロになりました。'}</p><div className="result-score"><span>MISSION SCORE</span><strong>{state.score.toLocaleString()}</strong></div><div className="result-stats"><div><span>TIME</span><b>{timeLabel(state.time)}</b></div><div><span>MAX COMBO</span><b>{state.maxCombo}<small>HITS</small></b></div><div><span>DESTROYED</span><b>{state.kills}</b></div></div><button className="primary" onClick={start} autoFocus>もう一度出撃 <span>↗</span></button><button className="text-button" onClick={() => game.title()}>タイトルへ戻る</button></section></div>}
    {panel === 'settings' && <Modal title="フライト設定" subtitle="FLIGHT SETTINGS" onClose={closePanel}><SettingsPanel settings={settings} onChange={updateSettings} /></Modal>}
    {panel === 'map' && <Modal title="フロンティア全域" subtitle="TACTICAL WORLD MAP" onClose={closePanel}><WorldMap state={state} onSelect={id => { game.selectObjective(id); resume() }} /></Modal>}
    {panel === 'controls' && <Modal title="パイロットガイド" subtitle="PILOT FIELD MANUAL" onClose={closePanel}><div className="controls-list">{controls.map(([key, label, desc]) => <div className="control" key={key}><kbd>{key}</kbd><div><strong>{label}</strong><p>{desc}</p></div></div>)}</div><div className="guide-tip"><Mark /><p><strong>撃破が、次の推進力になる。</strong><br />敵を倒すとブリンクが回復し、各スキルの待機時間が短縮。緑のゲートでブースト補給。</p></div></Modal>}
    <div className="mobile-note">PCのキーボードとマウスでプレイしてください。</div>
  </main>
}
