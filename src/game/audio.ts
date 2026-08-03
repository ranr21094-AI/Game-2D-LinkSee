import { getSnapshot } from "./store";

class AudioDirector {
  private context: AudioContext | null = null;

  unlock(): void {
    this.context ??= new AudioContext();
    void this.context.resume();
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(Math.max(0.001, volume * getSnapshot().settings.masterVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  caneTap(kind: "tactile" | "stone" | "metal" = "tactile"): void {
    this.unlock();
    const frequency = kind === "tactile" ? 680 : kind === "metal" ? 940 : 330;
    this.tone(frequency, kind === "metal" ? 0.14 : 0.08, 0.08, kind === "metal" ? "triangle" : "square");
  }

  sweep(): void {
    this.unlock();
    this.tone(440, 0.14, 0.05, "triangle");
  }

  hint(): void {
    this.unlock();
    this.tone(780, 0.18, 0.045, "sine");
  }

  door(): void {
    this.unlock();
    this.tone(220, 0.28, 0.07, "sawtooth");
  }

  interact(): void {
    this.unlock();
    this.tone(520, 0.1, 0.05, "sine");
  }

  crossingWait(): void {
    this.unlock();
    this.tone(260, 0.22, 0.055, "sine");
  }

  crossingWalk(): void {
    this.unlock();
    this.tone(760, 0.12, 0.06, "sine");
    window.setTimeout(() => this.tone(920, 0.16, 0.05, "sine"), 150);
  }
}

export const audioDirector = new AudioDirector();
