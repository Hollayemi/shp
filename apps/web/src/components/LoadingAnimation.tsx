"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Sailboat } from "lucide-react";
import { useTheme } from "next-themes";

interface LoadingAnimationProps {
  className?: string;
  showText?: boolean;
  text?: string;
}

const WaveCurve = ({ 
  delay = 0, 
  amplitude = 30,
  frequency = 2,
  speed = 3,
  color = "#3b82f6",
  y = 0,
  opacity = 0.3,
  phase = 0,
  drift = 30,
  bob = 6,
  foam = false,
  underlay = false,
  idSuffix = "0"
}: {
  delay?: number;
  amplitude?: number;
  frequency?: number;
  speed?: number;
  color?: string;
  y?: number;
  opacity?: number;
  phase?: number; // phase offset for staggering
  drift?: number; // horizontal drift distance
  bob?: number;   // vertical bob amplitude
  foam?: boolean; // add subtle foam highlight
  underlay?: boolean; // softly filled underlay for volume
  idSuffix?: string; // unique id suffix for gradient defs
}) => {
  // Generate wave points for smooth curve - much wider for full coverage
  const generateWavePoints = (time: number) => {
    const points: string[] = [];
    const width = 1200; // Wider for better coverage
    const segments = 140; // More segments for smoother curves
    
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * width - width/2;
      const waveY = Math.sin((i / segments) * frequency * Math.PI * 2 + time + phase) * amplitude;
      points.push(`${x},${waveY + y}`);
    }
    return points.join(' L ');
  };

  return (
    <motion.svg
      style={{
        position: "absolute",
        left: "-10%",
        top: "50%",
        transform: "translateY(-50%)",
        width: "120%",
        height: "280px",
        overflow: "visible",
        zIndex: 1
      }}
      viewBox="-600 -140 1200 280"
      preserveAspectRatio="none"
    >
      {/* Underlay gradient for subtle wave body */}
      {underlay && (
        <defs>
          <linearGradient id={`waveGrad-${idSuffix}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
      )}

      <motion.g
        animate={{ x: 0, y: [0, -bob, 0] }}
        transition={{ duration: speed * 4, delay, repeat: Infinity, ease: "easeInOut" }}
      >
        {underlay && (
          <motion.path
            d={`M -600,${Math.sin(0 + phase) * amplitude + y} L ${generateWavePoints(0)} L 600,${Math.sin(0 + phase) * amplitude + y} L 600,140 L -600,140 Z`}
            fill={`url(#waveGrad-${idSuffix})`}
            opacity={opacity * 0.6}
            animate={{
              d: [
                `M -600,${Math.sin(0 + phase) * amplitude + y} L ${generateWavePoints(0)} L 600,${Math.sin(0 + phase) * amplitude + y} L 600,140 L -600,140 Z`,
                `M -600,${Math.sin(Math.PI + phase) * amplitude + y} L ${generateWavePoints(Math.PI)} L 600,${Math.sin(Math.PI + phase) * amplitude + y} L 600,140 L -600,140 Z`,
                `M -600,${Math.sin(Math.PI * 2 + phase) * amplitude + y} L ${generateWavePoints(Math.PI * 2)} L 600,${Math.sin(Math.PI * 2 + phase) * amplitude + y} L 600,140 L -600,140 Z`,
                `M -600,${Math.sin(0 + phase) * amplitude + y} L ${generateWavePoints(0)} L 600,${Math.sin(0 + phase) * amplitude + y} L 600,140 L -600,140 Z`,
              ]
            }}
            transition={{ duration: speed, delay, repeat: Infinity, repeatType: "loop", ease: "linear" }}
          />
        )}

        <motion.path
          d={`M -600,${Math.sin(0 + phase) * amplitude + y} L ${generateWavePoints(0)} L 600,${Math.sin(0 + phase) * amplitude + y}`}
          fill="none"
          stroke={color}
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          opacity={opacity}
          animate={{
            d: [
              `M -600,${Math.sin(0 + phase) * amplitude + y} L ${generateWavePoints(0)} L 600,${Math.sin(0 + phase) * amplitude + y}`,
              `M -600,${Math.sin(Math.PI + phase) * amplitude + y} L ${generateWavePoints(Math.PI)} L 600,${Math.sin(Math.PI + phase) * amplitude + y}`,
              `M -600,${Math.sin(Math.PI * 2 + phase) * amplitude + y} L ${generateWavePoints(Math.PI * 2)} L 600,${Math.sin(Math.PI * 2 + phase) * amplitude + y}`,
              `M -600,${Math.sin(0 + phase) * amplitude + y} L ${generateWavePoints(0)} L 600,${Math.sin(0 + phase) * amplitude + y}`
            ]
          }}
          transition={{ duration: speed, delay, repeat: Infinity, repeatType: "loop", ease: "linear" }}
        />
        {foam && (
          <motion.path
            d={`M -600,${Math.sin(Math.PI/2 + phase) * amplitude + (y - 4)} L ${generateWavePoints(Math.PI / 2)} L 600,${Math.sin(Math.PI/2 + phase) * amplitude + (y - 4)}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            opacity={opacity * 0.35}
            animate={{
              d: [
                `M -600,${Math.sin(Math.PI/2 + phase) * amplitude + (y - 4)} L ${generateWavePoints(Math.PI / 2)} L 600,${Math.sin(Math.PI/2 + phase) * amplitude + (y - 4)}`,
                `M -600,${Math.sin(Math.PI * 1.5 + phase) * amplitude + (y - 4)} L ${generateWavePoints(Math.PI * 1.5)} L 600,${Math.sin(Math.PI * 1.5 + phase) * amplitude + (y - 4)}`,
                `M -600,${Math.sin(Math.PI/2 + phase) * amplitude + (y - 4)} L ${generateWavePoints(Math.PI / 2)} L 600,${Math.sin(Math.PI/2 + phase) * amplitude + (y - 4)}`
              ]
            }}
            transition={{ duration: speed * 1.2, delay, repeat: Infinity, ease: "linear" }}
          />
        )}
      </motion.g>
    </motion.svg>
  );
};

const SailboatIcon = () => {
  return (
    <motion.div
      initial={{ 
        x: -200, 
        y: 40, // Lower position to be at wave level
        rotate: -3
      }}
      animate={{ 
        x: [-50, 50, -50], // Horizontal wave-riding motion
        y: [40, 25, 45, 30, 40], // Following wave crests and troughs
        rotate: [-3, 1, -1, 2, -3] // Realistic tilting as it rides waves
      }}
      transition={{
        duration: 8, // Longer duration for realistic wave motion
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className="relative z-10"
    >
      <motion.div
        animate={{
          clipPath: [
            "polygon(0 0, 100% 0, 100% 100%, 0 100%)", // Fully visible
            "polygon(0 0, 100% 0, 100% 90%, 0 90%)", // Slightly clipped
            "polygon(0 0, 100% 0, 100% 80%, 0 80%)", // More clipped (under wave)
            "polygon(0 0, 100% 0, 100% 95%, 0 95%)", // Less clipped
            "polygon(0 0, 100% 0, 100% 100%, 0 100%)", // Fully visible again
          ]
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 0.25, 0.5, 0.75, 1] // Sync with wave motion
        }}
        style={{ overflow: "hidden" }}
      >
        <Sailboat 
          size={160} 
          className="text-blue-600 drop-shadow-2xl filter"
        />
      </motion.div>
    </motion.div>
  );
};

const Seagull = ({ 
  delay = 0,
  x = 0,
  y = 0
}: {
  delay?: number;
  x?: number;
  y?: number;
}) => {
  return (
    <motion.div
      initial={{ 
        x: x - 300, 
        y: y,
        opacity: 0
      }}
      animate={{ 
        x: [x - 300, x + 400],
        y: [y, y - 30, y],
        opacity: [0, 1, 0]
      }}
      transition={{
        duration: 12,
        delay: delay,
        repeat: Infinity,
        ease: "linear"
      }}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: -8,
        marginTop: -8,
      }}
    >
      <div className="text-gray-400 text-xl">⋀</div>
    </motion.div>
  );
};

const Cloud = ({ 
  delay = 0,
  x = 0,
  y = 0,
  size = 1
}: {
  delay?: number;
  x?: number;
  y?: number;
  size?: number;
}) => {
  return (
    <motion.div
      initial={{ 
        x: x - 200, 
        opacity: 0
      }}
      animate={{ 
        x: [x - 200, x + 300],
        opacity: [0, 0.6, 0]
      }}
      transition={{
        duration: 15,
        delay: delay,
        repeat: Infinity,
        ease: "linear"
      }}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: -30 * size,
        marginTop: y,
        transform: `scale(${size * 1.5})`,
      }}
    >
      <div className="text-gray-300 text-4xl opacity-70">☁</div>
    </motion.div>
  );
};

const OceanBackground = ({ isDark }: { isDark: boolean }) => {
  const gradientClass = isDark 
    ? "bg-gradient-radial from-blue-500/15 via-cyan-600/8 to-transparent"
    : "bg-gradient-radial from-blue-400/10 via-cyan-500/5 to-transparent";
    
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.3, 0.2, 0.4, 0.3] }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={`absolute inset-0 ${gradientClass}`}
    />
  );
};

export const LoadingAnimation = ({ 
  className = "", 
  showText = true, 
  text = "Setting sail..." 
}: LoadingAnimationProps) => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Theme-aware wave colors
  const isDark = resolvedTheme === 'dark';
  
  const waveColors = isDark ? [
    "#3b82f6", // blue-500
    "#06b6d4", // cyan-500
    "#0891b2", // cyan-600
    "#0284c7", // sky-600
    "#1d4ed8", // blue-700
  ] : [
    "#60a5fa", // blue-400
    "#38bdf8", // sky-400
    "#22d3ee", // cyan-400
    "#06b6d4", // cyan-500
    "#0ea5e9", // sky-500
  ];

  const waves = [
    { delay: 0, amplitude: 18, frequency: 1.1, speed: 4, color: waveColors[0], y: 70, opacity: 0.5, phase: 0.0, drift: 24, bob: 6, foam: true, underlay: true, idSuffix: "front" },
    { delay: 0.6, amplitude: 26, frequency: 0.9, speed: 5.2, color: waveColors[1], y: 90, opacity: 0.35, phase: 0.6, drift: 18, bob: 5, foam: false },
    { delay: 1.2, amplitude: 14, frequency: 1.7, speed: 3.6, color: waveColors[2], y: 110, opacity: 0.45, phase: 1.2, drift: 30, bob: 7, foam: false },
    { delay: 1.8, amplitude: 34, frequency: 0.7, speed: 6.4, color: waveColors[3], y: 50, opacity: 0.25, phase: 1.8, drift: 12, bob: 4, foam: false },
    { delay: 2.4, amplitude: 22, frequency: 1.4, speed: 4.8, color: waveColors[4], y: 130, opacity: 0.3, phase: 2.4, drift: 20, bob: 6, foam: false },
  ];

  const seagulls = [
    { delay: 0, x: -80, y: -60 },
    { delay: 3, x: 50, y: -80 },
    { delay: 6, x: -120, y: -40 },
  ];

  const clouds = [
    { delay: 0, x: -100, y: -180, size: 0.8 },
    { delay: 4, x: 80, y: -160, size: 1.2 },
    { delay: 8, x: -50, y: -200, size: 1 },
  ];

  return (
    <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
      <OceanBackground isDark={isDark} />
      
      {/* Animated Waves */}
      {waves.map((wave, index) => (
        <WaveCurve
          key={`wave-${index}`}
          delay={wave.delay}
          amplitude={wave.amplitude}
          frequency={wave.frequency}
          speed={wave.speed}
          color={wave.color}
          y={wave.y}
          opacity={wave.opacity}
          phase={(wave as any).phase}
          drift={(wave as any).drift}
          bob={(wave as any).bob}
          foam={(wave as any).foam}
          underlay={(wave as any).underlay}
          idSuffix={(wave as any).idSuffix ?? `${index}`}
        />
      ))}

      {/* Dimmer overlay for better text readability (smooth, long cycle) */}
      <motion.div
        className="absolute inset-0 z-5"
        animate={{ opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 100%)" }}
      />

      {/* Center Content with Perfect Alignment */}
      <div className="relative z-10 flex items-center justify-center w-full h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center"
        >
          {showText && (
            <motion.p
              initial={{ opacity: 0.8 }}
              animate={{ opacity: [0.8, 1, 0.9, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="text-xl md:text-4xl text-foreground font-bold inter-var"
            >
              {text}
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
}; 