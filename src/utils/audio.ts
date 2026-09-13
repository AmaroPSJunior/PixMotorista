/**
 * Plays a pleasant ascending 4-tone chime sound via Web Audio API
 * indicating payment approval and feature unlock.
 */
export function playPaymentSuccessSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Ascending harmonic frequencies (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const startTime = ctx.currentTime + 0.05;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.12);

      // Envelope: fast attack, smooth decay
      gain.gain.setValueAtTime(0, startTime + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.35, startTime + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * 0.12 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + idx * 0.12);
      osc.stop(startTime + idx * 0.12 + 0.5);
    });
  } catch (e) {
    console.warn('Não foi possível tocar o som de confirmação:', e);
  }
}
