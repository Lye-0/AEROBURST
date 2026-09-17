export class GameAudio {
  private context?: AudioContext
  private master?: GainNode
  volume = 0.45

  unlock() {
    try {
      this.context ??= new AudioContext()
      if (!this.master) {
        this.master = this.context.createGain()
        this.master.connect(this.context.destination)
      }
      void this.context.resume()
    } catch { /* The game remains playable when audio is unavailable. */ }
  }

  private lastPlayed: Record<string, number> = {}
  play(kind: 'slash' | 'hit' | 'kill' | 'dash' | 'jump' | 'hurt' | 'burst' | 'wave' | 'skill' | 'shield' | 'lance') {
    if (!this.context || !this.master || !this.volume) return
    const ctx = this.context
    const now = ctx.currentTime
    if (now - (this.lastPlayed[kind] ?? -1) < 0.035) return
    this.lastPlayed[kind] = now
    const notes: Record<typeof kind, [number, number, number, OscillatorType]> = {
      slash: [420, 75, 0.11, 'sawtooth'], hit: [150, 40, 0.12, 'square'],
      kill: [660, 1320, 0.19, 'triangle'], dash: [110, 660, 0.18, 'sawtooth'],
      jump: [240, 550, 0.13, 'sine'], hurt: [120, 35, 0.25, 'sawtooth'],
      burst: [70, 750, 0.65, 'sawtooth'], wave: [440, 880, 0.4, 'sine'],
      skill: [90, 680, 0.35, 'sawtooth'], shield: [900, 1800, 0.2, 'sine'], lance: [1400, 90, 0.4, 'sawtooth'],
    }
    const [from, to, duration, type] = notes[kind]
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, now)
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration)
    gain.gain.setValueAtTime(this.volume * (kind === 'burst' ? 0.14 : 0.055), now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    oscillator.connect(gain).connect(this.master)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }
}
