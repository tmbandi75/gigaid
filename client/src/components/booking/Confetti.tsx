import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  speedX: number;
  speedY: number;
  rotationSpeed: number;
  shape: "circle" | "square" | "star" | "ribbon";
  opacity: number;
}

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", 
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
];

const SHAPES = ["circle", "square", "star", "ribbon"] as const;

function createParticle(id: number, canvasWidth: number): Particle {
  return {
    id,
    x: Math.random() * canvasWidth,
    y: -20 - Math.random() * 100,
    rotation: Math.random() * 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 8 + Math.random() * 12,
    speedX: (Math.random() - 0.5) * 4,
    speedY: 2 + Math.random() * 4,
    rotationSpeed: (Math.random() - 0.5) * 10,
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    opacity: 1,
  };
}

function Star({ size, color }: { size: number; color: string }) {
  const points = 5;
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.4;
  
  let path = "";
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = radius * Math.cos(angle) + outerRadius;
    const y = radius * Math.sin(angle) + outerRadius;
    path += (i === 0 ? "M" : "L") + `${x},${y}`;
  }
  path += "Z";
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={path} fill={color} />
    </svg>
  );
}

interface ConfettiProps {
  active: boolean;
  duration?: number;
}

export function Confetti({ active, duration = 4000 }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!active) return;

    setIsVisible(true);
    const width = window.innerWidth;
    
    // Create initial burst of particles
    const initialParticles: Particle[] = [];
    for (let i = 0; i < 80; i++) {
      initialParticles.push(createParticle(i, width));
    }
    setParticles(initialParticles);

    // Animation loop
    let animationId: number;
    let startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > duration) {
        setIsVisible(false);
        setParticles([]);
        return;
      }

      setParticles(prev => 
        prev.map(p => ({
          ...p,
          x: p.x + p.speedX,
          y: p.y + p.speedY,
          rotation: p.rotation + p.rotationSpeed,
          speedY: p.speedY + 0.1, // gravity
          opacity: Math.max(0, 1 - (elapsed / duration) * 0.5),
        })).filter(p => p.y < window.innerHeight + 50)
      );

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [active, duration]);

  if (!isVisible || particles.length === 0) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      data-testid="confetti-container"
    >
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: particle.x,
            top: particle.y,
            transform: `rotate(${particle.rotation}deg)`,
            opacity: particle.opacity,
            transition: "none",
          }}
        >
          {particle.shape === "circle" && (
            <div
              className="rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
              }}
            />
          )}
          {particle.shape === "square" && (
            <div
              className="rounded-sm"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
              }}
            />
          )}
          {particle.shape === "star" && (
            <Star size={particle.size} color={particle.color} />
          )}
          {particle.shape === "ribbon" && (
            <div
              className="rounded-full"
              style={{
                width: particle.size * 0.4,
                height: particle.size * 1.5,
                backgroundColor: particle.color,
              }}
            />
          )}
        </div>
      ))}
      
      {/* Sparkle burst effect in center */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-yellow-400 animate-ping"
              style={{
                transform: `rotate(${i * 45}deg) translateY(-40px)`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: "1s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
