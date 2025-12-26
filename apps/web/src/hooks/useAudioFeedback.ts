import { useEffect, useCallback, useRef } from "react";
import { audioManager } from "@/lib/audio-manager";

/**
 * Hook for audio feedback in components
 * Handles the sequence: keys tapping → thinking loop → chime on completion
 */
export const useAudioFeedback = () => {
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
      audioManager.stop("thinking");
      audioManager.stop("keysTapping", true);
    };
  }, []);

  /**
   * Play keys tapping when AI starts responding
   */
  const playKeysTapping = useCallback(() => {
    // Clear any existing timeout
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
    }

    // Wait 0.5 seconds before starting keys tapping
    audioTimeoutRef.current = setTimeout(() => {
      audioManager.play("keysTapping");
      audioTimeoutRef.current = null;
    }, 500);
  }, []);

  /**
   * Start thinking loop when AI is building (tool calls)
   * Only starts after keys tapping has had time to play
   * DISABLED: Not playing thinking loop for now
   */
  const startThinkingLoop = useCallback(() => {
    // Disabled - not playing thinking loop
    return;
    
    // // Clear any existing thinking timeout
    // if (thinkingTimeoutRef.current) {
    //   clearTimeout(thinkingTimeoutRef.current);
    //   thinkingTimeoutRef.current = null;
    // }

    // // If keys tapping hasn't started yet (timeout still pending), wait for it
    // if (audioTimeoutRef.current) {
    //   // Keys tapping will start in 0.5s, let it play for ~3-4s, then start thinking
    //   thinkingTimeoutRef.current = setTimeout(() => {
    //     audioManager.stop("keysTapping", true);
    //     if (!audioManager.isPlaying("thinking")) {
    //       audioManager.play("thinking");
    //     }
    //     thinkingTimeoutRef.current = null;
    //   }, 4000); // 0.5s delay + 3.5s for keys tapping to play
    // } else if (audioManager.isPlaying("keysTapping")) {
    //   // Keys tapping is already playing, wait a bit then transition
    //   thinkingTimeoutRef.current = setTimeout(() => {
    //     audioManager.stop("keysTapping", true);
    //     if (!audioManager.isPlaying("thinking")) {
    //       audioManager.play("thinking");
    //     }
    //     thinkingTimeoutRef.current = null;
    //   }, 2000);
    // } else {
    //   // Keys tapping already finished or never played, start thinking immediately
    //   if (!audioManager.isPlaying("thinking")) {
    //     audioManager.play("thinking");
    //   }
    // }
  }, []);

  /**
   * Stop thinking loop when building ends
   */
  const stopThinkingLoop = useCallback(() => {
    audioManager.stop("thinking");
  }, []);

  /**
   * Stop all streaming audio (thinking loop)
   */
  const stopStreamingAudio = useCallback(() => {
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
    audioManager.stop("thinking");
    audioManager.stop("keysTapping", true);
  }, []);

  /**
   * Play chime for deliverable/fragment/checkpoint
   */
  const playChime = useCallback(() => {
    audioManager.play("chime");
  }, []);

  return {
    playKeysTapping,
    startThinkingLoop,
    stopThinkingLoop,
    stopStreamingAudio,
    playChime,
  };
};
