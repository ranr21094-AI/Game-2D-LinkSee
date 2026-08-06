import rainUrl from "../assets/audio/rain.ogg";
import trafficUrl from "../assets/audio/traffic.ogg";
import busInteriorUrl from "../assets/audio/bus-interior.ogg";
import voicemailUrl from "../assets/audio/voicemail-lin.ogg";
import { convertText } from "./i18n";
import { getSnapshot } from "./store";
import type { GroundTileKey } from "./ground-tiles";
import type { SceneId } from "./types";

type AmbientId = "rain" | "traffic" | "bus";

const AMBIENT_URLS: Record<AmbientId, string> = { rain: rainUrl, traffic: trafficUrl, bus: busInteriorUrl };
const SCENE_AMBIENCE: Record<SceneId, Partial<Record<AmbientId, number>>> = {
  "bus-stop": { rain: 0.5, traffic: 0.34 },
  "bus-interior": { bus: 0.56 },
  "old-city": { rain: 0.4, traffic: 0.5 },
  ruins: { rain: 0.34, traffic: 0.08 },
};

class AudioDirector {
  private context: AudioContext | null = null;
  private ambience = new Map<AmbientId, HTMLAudioElement>();
  private scene: SceneId | null = null;
  private paused = false;
  private trafficDanger = false;

  unlock(): void {
    this.context ??= new AudioContext();
    void this.context.resume();
    (Object.keys(AMBIENT_URLS) as AmbientId[]).forEach((id) => {
      if (this.ambience.has(id)) return;
      const audio = new Audio(AMBIENT_URLS[id]);
      audio.loop = true;
      audio.preload = "auto";
      audio.addEventListener("error", () => { audio.pause(); }, { once: true });
      this.ambience.set(id, audio);
    });
    this.syncSettings();
    this.playSceneAmbience();
  }

  enterScene(scene: SceneId): void {
    this.scene = scene;
    this.trafficDanger = false;
    this.playSceneAmbience();
  }

  pause(): void {
    this.paused = true;
    this.ambience.forEach((audio) => audio.pause());
    window.speechSynthesis?.pause();
  }

  resume(): void {
    this.paused = false;
    void this.context?.resume();
    window.speechSynthesis?.resume();
    this.playSceneAmbience();
  }

  destroy(): void {
    this.ambience.forEach((audio) => { audio.pause(); audio.currentTime = 0; });
    this.ambience.clear();
    window.speechSynthesis?.cancel();
    void this.context?.close();
    this.context = null;
    this.scene = null;
  }

  syncSettings(): void {
    const settings = getSnapshot().settings;
    const sceneMix = this.scene ? SCENE_AMBIENCE[this.scene] : {};
    this.ambience.forEach((audio, id) => {
      const dangerBoost = id === "traffic" && this.trafficDanger ? 1.55 : 1;
      audio.volume = Math.min(1, (sceneMix[id] ?? 0) * settings.masterVolume * settings.ambientVolume * dangerBoost);
    });
  }

  setTrafficDanger(active: boolean): void {
    if (this.trafficDanger === active) return;
    this.trafficDanger = active;
    this.syncSettings();
  }

  private playSceneAmbience(): void {
    if (this.paused || !this.scene) return;
    const mix = SCENE_AMBIENCE[this.scene];
    this.syncSettings();
    this.ambience.forEach((audio, id) => {
      if ((mix[id] ?? 0) <= 0) audio.pause();
      else void audio.play().catch(() => undefined);
    });
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType, pan = 0): void {
    if (!this.context || this.paused) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    const settings = getSnapshot().settings;
    gain.gain.setValueAtTime(Math.max(0.001, volume * settings.masterVolume * settings.effectsVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    if (typeof this.context.createStereoPanner === "function") {
      const panner = this.context.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
      oscillator.connect(gain).connect(panner).connect(this.context.destination);
    } else {
      oscillator.connect(gain).connect(this.context.destination);
    }
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  speak(text: string): void {
    if (!("speechSynthesis" in window) || this.paused) return;
    const lang = getSnapshot().settings.assistiveTextLang;
    const spoken = convertText(text, lang);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = lang === "zh-HK" ? "zh-HK" : "zh-CN";
    const settings = getSnapshot().settings;
    utterance.volume = Math.min(1, settings.masterVolume * settings.dialogueVolume);
    window.speechSynthesis.speak(utterance);
  }

  playVoicemail(): void {
    window.speechSynthesis?.cancel();
    const audio = new Audio(voicemailUrl);
    const settings = getSnapshot().settings;
    audio.volume = Math.min(1, settings.masterVolume * settings.dialogueVolume);
    void audio.play().catch(() => {});
  }

  caneTap(kind: "tactile" | "stone" | "metal" | "fabric" | "obstacle" = "tactile"): void {
    this.unlock();
    const frequency = kind === "tactile" ? 680 : kind === "metal" ? 940 : kind === "fabric" ? 118 : kind === "obstacle" ? 185 : 330;
    this.tone(frequency, kind === "metal" ? 0.14 : kind === "obstacle" || kind === "fabric" ? 0.18 : 0.08, kind === "fabric" ? 0.045 : 0.08, kind === "metal" ? "triangle" : kind === "fabric" ? "sine" : "square");
  }

  footstep(surface: GroundTileKey | null): void {
    this.unlock();
    const frequency = surface === "metal-floor" || surface === "bus-floor" ? 225 : surface === "asphalt" || surface === "lane" ? 118 : surface === "dirt" ? 92 : surface === "sidewalk" || surface === "concrete" ? 155 : 142;
    this.tone(frequency, 0.055, 0.035, surface === "metal-floor" ? "square" : "triangle");
  }

  trafficWarning(): void { this.unlock(); this.tone(165, 0.24, 0.09, "sawtooth"); }
  hint(): void { this.unlock(); this.tone(780, 0.18, 0.045, "sine"); }
  door(): void { this.unlock(); this.tone(220, 0.28, 0.07, "sawtooth"); }
  interact(): void { this.unlock(); this.tone(520, 0.1, 0.05, "sine"); }
  listenCue(frequency: number, pan = 0): void { this.unlock(); this.tone(frequency, 0.32, 0.055, "sine", pan); }
  crossingWait(): void { this.unlock(); this.tone(260, 0.22, 0.055, "sine"); }
  cooldown(): void { this.unlock(); this.tone(142, 0.1, 0.035, "sine"); }
  crossingWalk(): void { this.unlock(); this.tone(760, 0.12, 0.06, "sine"); window.setTimeout(() => this.tone(920, 0.16, 0.05, "sine"), 150); }
}

export const audioDirector = new AudioDirector();
