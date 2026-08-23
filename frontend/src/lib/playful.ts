export type PlayCue = 'place' | 'recall' | 'discovery' | 'collapse' | 'achievement' | 'error'

const cues: Record<PlayCue, [number, number, number]> = {
  place: [220, 300, 0.05],
  recall: [330, 440, 0.08],
  discovery: [440, 660, 0.16],
  collapse: [280, 210, 0.11],
  achievement: [523, 784, 0.22],
  error: [180, 120, 0.16],
}

let context: AudioContext | null = null

export function playCue(name: PlayCue, enabled: boolean): void {
  if (!enabled) return
  try {
    context ??= new AudioContext()
    const [start, end, duration] = cues[name]
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = name === 'error' ? 'sawtooth' : 'sine'
    oscillator.frequency.setValueAtTime(start, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + duration)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + duration + 0.02)
  } catch {
    // Audio is decorative and must never interrupt play.
  }
}

export function haptic(pattern: number | number[], enabled: boolean): void {
  if (!enabled) return
  try { navigator.vibrate?.(pattern) } catch { /* Decorative only. */ }
}
