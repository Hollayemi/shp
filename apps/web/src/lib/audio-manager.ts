/**
 * Audio Manager for Shipper sound effects
 * Handles playback of UI feedback sounds with volume control
 */

type SoundType = "keysTapping" | "thinking" | "chime";

interface AudioConfig {
  path: string;
  volume: number;
  loop?: boolean;
  fadeOut?: boolean;
}

const AUDIO_CONFIG: Record<SoundType, AudioConfig> = {
  keysTapping: {
    path: "/sounds/keys-tapping.mp3",
    volume: 0.12, // Low but audible
    fadeOut: true,
  },
  thinking: {
    path: "/sounds/thinking.mp3",
    volume: 0.06, // Very low for continuous loop
    loop: true,
  },
  chime: {
    path: "/sounds/chime.mp3",
    volume: 0.15, // Low but clear for notification
  },
};

class AudioManager {
  private audioInstances: Map<SoundType, HTMLAudioElement> = new Map();
  private fadingIntervals: Map<SoundType, number> = new Map();
  private isPreloaded: boolean = false;
  private enabled: boolean = true;

  /**
   * Check if audio is enabled (always true by default)
   */
  isEnabled(): boolean {
    if (typeof window === "undefined") return false;
    return this.enabled;
  }

  /**
   * Enable audio playback
   */
  enable(): void {
    this.enabled = true;
    if (!this.isPreloaded) {
      this.preload();
    }
  }

  /**
   * Disable audio playback
   */
  disable(): void {
    this.enabled = false;
    this.cleanup();
  }


  /**
   * Preload all audio files for instant playback
   */
  private preload(): void {
    if (this.isPreloaded) return;
    
    Object.entries(AUDIO_CONFIG).forEach(([type, config]) => {
      const audio = new Audio(config.path);
      audio.volume = config.volume;
      audio.loop = config.loop || false;
      audio.preload = "auto";
      
      // Force full load for looping sounds to prevent gaps
      if (config.loop) {
        audio.load();
      }
      
      this.audioInstances.set(type as SoundType, audio);
    });
    
    this.isPreloaded = true;
  }

  /**
   * Play a sound effect (only if enabled)
   */
  play(type: SoundType): void {
    // Check if audio is enabled
    if (!this.isEnabled()) {
      return;
    }

    // Lazy preload on first play
    if (!this.isPreloaded) {
      this.preload();
    }

    const audio = this.audioInstances.get(type);
    if (!audio) {
      console.warn(`[AudioManager] Sound not preloaded: ${type}`);
      return;
    }

    // Stop any existing fade out
    this.clearFadeOut(type);

    // If it's already playing (especially for loops), don't restart
    if (!audio.paused && AUDIO_CONFIG[type].loop) {
      return;
    }

    // Reset to beginning for non-looping sounds or stopped sounds
    audio.currentTime = 0;
    audio.volume = AUDIO_CONFIG[type].volume;
    audio.play().catch((error) => {
      console.warn(`[AudioManager] Failed to play ${type}:`, error);
    });
  }

  /**
   * Stop a sound effect
   */
  stop(type: SoundType, fadeOut: boolean = false): void {
    const audio = this.audioInstances.get(type);
    if (!audio) return;

    if (fadeOut && AUDIO_CONFIG[type].fadeOut) {
      this.fadeOutAndStop(type);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  /**
   * Fade out and stop a sound
   */
  private fadeOutAndStop(type: SoundType): void {
    const audio = this.audioInstances.get(type);
    if (!audio) return;

    this.clearFadeOut(type);

    const fadeStep = 0.02;
    const fadeInterval = 50; // ms
    const targetVolume = AUDIO_CONFIG[type].volume;

    const interval = window.setInterval(() => {
      if (audio.volume > fadeStep) {
        audio.volume = Math.max(0, audio.volume - fadeStep);
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = targetVolume; // Reset for next play
        this.clearFadeOut(type);
      }
    }, fadeInterval);

    this.fadingIntervals.set(type, interval);
  }

  /**
   * Clear fade out interval
   */
  private clearFadeOut(type: SoundType): void {
    const interval = this.fadingIntervals.get(type);
    if (interval) {
      clearInterval(interval);
      this.fadingIntervals.delete(type);
    }
  }

  /**
   * Check if a sound is currently playing
   */
  isPlaying(type: SoundType): boolean {
    const audio = this.audioInstances.get(type);
    return audio ? !audio.paused : false;
  }

  /**
   * Cleanup all audio instances
   */
  cleanup(): void {
    this.fadingIntervals.forEach((interval) => clearInterval(interval));
    this.fadingIntervals.clear();
    this.audioInstances.forEach((audio) => {
      audio.pause();
      audio.src = "";
    });
    this.audioInstances.clear();
    this.isPreloaded = false;
  }
}

// Singleton instance
export const audioManager = new AudioManager();
