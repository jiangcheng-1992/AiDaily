type AudioFxName = "open" | "detect" | "move" | "focus" | "reveal";

let audioContext: AudioContext | null = null;

export function playAudioFx(name: AudioFxName) {
  if (typeof window === "undefined") return;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  audioContext ??= new AudioContextCtor();
  if (audioContext.state === "suspended") void audioContext.resume();

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const settings = getFxSettings(name);

  oscillator.type = settings.type;
  oscillator.frequency.setValueAtTime(settings.startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(settings.endFrequency, now + settings.duration);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(settings.filterFrequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(settings.gain, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + settings.duration + 0.02);

  if (name === "reveal") {
    window.navigator.vibrate?.([28, 36, 42]);
  } else {
    window.navigator.vibrate?.(18);
  }
}

function getFxSettings(name: AudioFxName) {
  switch (name) {
    case "open":
      return {
        type: "sine" as OscillatorType,
        startFrequency: 96,
        endFrequency: 220,
        filterFrequency: 580,
        gain: 0.12,
        duration: 0.45,
      };
    case "detect":
      return {
        type: "triangle" as OscillatorType,
        startFrequency: 520,
        endFrequency: 880,
        filterFrequency: 1200,
        gain: 0.08,
        duration: 0.18,
      };
    case "move":
      return {
        type: "sawtooth" as OscillatorType,
        startFrequency: 240,
        endFrequency: 160,
        filterFrequency: 900,
        gain: 0.045,
        duration: 0.14,
      };
    case "focus":
      return {
        type: "sine" as OscillatorType,
        startFrequency: 660,
        endFrequency: 990,
        filterFrequency: 1800,
        gain: 0.06,
        duration: 0.22,
      };
    case "reveal":
      return {
        type: "triangle" as OscillatorType,
        startFrequency: 120,
        endFrequency: 1320,
        filterFrequency: 2200,
        gain: 0.16,
        duration: 0.72,
      };
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
