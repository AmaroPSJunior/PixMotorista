let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

/**
 * Must be called from a user gesture at least once on mobile browsers.
 * It primes the shared Web Audio context so a later remote Firestore unlock
 * can play the same confirmation sound without another tap.
 */
export async function armPaymentSuccessSound(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.00001, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch (error) {
    console.warn('Não foi possível preparar o áudio de confirmação:', error);
  }
}

/**
 * Plays the same ascending confirmation chime used after an approved payment.
 */
export function playPaymentSuccessSound() {
  try {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent('pix:success-sound'));

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const notes = [523.25, 659.25, 783.99, 1046.50];
    const startTime = ctx.currentTime + 0.05;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.12);

      gain.gain.setValueAtTime(0, startTime + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.35, startTime + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * 0.12 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + idx * 0.12);
      osc.stop(startTime + idx * 0.12 + 0.5);
    });
  } catch (error) {
    console.warn('Não foi possível tocar o som de confirmação:', error);
  }
}
