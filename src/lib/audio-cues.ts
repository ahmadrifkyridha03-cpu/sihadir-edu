'use client';

/**
 * Acoustic Kiosk Scanner Feedback Engine.
 * Dual-engine audio architecture:
 * 1. Plays HTML5 audio (/audio/beep-success.mp3, /audio/beep-error.mp3)
 * 2. Seamlessly falls back to real-time Web Audio API frequency synthesis
 */
export class SoundFeedbackEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Plays valid scan success feedback.
   * Attempts HTML5 Audio first; falls back to Web Audio oscillator chime (880Hz -> 1760Hz).
   */
  public playSuccess(): void {
    if (this.isMuted) return;

    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio('/audio/beep-success.mp3');
        audio.volume = 0.8;
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(() => {
            this.playSynthSuccess();
          });
        }
      } catch {
        this.playSynthSuccess();
      }
    } else {
      this.playSynthSuccess();
    }

    // Subtle tactile haptic vibration for supported mobile devices
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }

  /**
   * Synthesized Web Audio chime fallback for success.
   */
  public playSynthSuccess(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Tone 1: 880 Hz sine wave
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.1);

      // Tone 2: 1760 Hz sine wave (crisp harmonic chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1760, now + 0.08);
      gain2.gain.setValueAtTime(0.15, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.25);
    } catch {
      // Ignore audio synthesis errors on locked autoplay policies
    }
  }

  /**
   * Plays error feedback.
   * Attempts HTML5 Audio first; falls back to Web Audio oscillator double-buzz (220Hz -> 180Hz).
   */
  public playError(): void {
    if (this.isMuted) return;

    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio('/audio/beep-error.mp3');
        audio.volume = 0.8;
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(() => {
            this.playSynthError();
          });
        }
      } catch {
        this.playSynthError();
      }
    } else {
      this.playSynthError();
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([40, 30, 60]);
    }
  }

  /**
   * Synthesized Web Audio buzzer fallback for error.
   */
  public playSynthError(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      const playBuzz = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.linearRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      playBuzz(220, now, 0.12);
      playBuzz(180, now + 0.14, 0.18);
    } catch {
      // Ignore audio context errors
    }
  }

  /**
   * Gentle amber reminder tone for active cooldown / already scanned.
   */
  public playWarning(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(440, now + 0.08); // A4
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Ignore audio context errors
    }
  }
}

export const soundFeedback = new SoundFeedbackEngine();
