import React, { useEffect, useRef } from 'react';

export type BackgroundVariant =
  | 'hero-sacred'       // Home hero: Floating gold dust + subtle rotating geometric concentric rings & sacred pulses
  | 'shop-sparkles'     // Shop: Shimmering gold diamond glints & luxury mesh
  | 'gold-flow'         // Live Gold Price / Analytics: Flowing golden waveform rays & upward market sparks
  | 'collections-constellation' // Collections: 8-point Ishtar stars connecting constellations
  | 'story-mythology'   // About / Story: Ancient Mesopotamian geometric lines, subtle ziggurat arches & amber embers
  | 'favorites-twilight'// Favorites: Soft pulsing gold hearts & gentle stardust
  | 'contact-aurora'    // Contact / Atelier: Ambient royal navy & gold aura
  | 'admin-cyber';      // Admin: Minimalist subtle telemetry grid

interface DynamicBackgroundMotionProps {
  variant: BackgroundVariant;
  className?: string;
}

export const DynamicBackgroundMotion: React.FC<DynamicBackgroundMotionProps> = ({
  variant,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Initializer according to page variant
    interface Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      pulse: number;
      color?: string;
      angle?: number;
      spin?: number;
      rayLength?: number;
    }

    const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let particles: Particle[] = [];

    if (variant === 'hero-sacred') {
      // Golden particles: few in number (14 total), tiny/fine, placed away from the center logo
      const centerX = width / 2;
      const centerY = height / 2;
      const exclusionZone = width < 640 ? 145 : 190;

      particles = Array.from({ length: 14 }, () => {
        let px = Math.random() * width;
        let py = Math.random() * height;
        // Ensure initial position is outside the central logo zone
        const dist = Math.hypot(px - centerX, py - centerY);
        if (dist < exclusionZone) {
          px = px < centerX ? px - exclusionZone : px + exclusionZone;
        }
        return {
          x: px,
          y: py,
          size: Math.random() * 0.7 + 0.6, // Fine, micro-particles (0.6px - 1.3px)
          speedX: (Math.random() - 0.5) * 0.1, // Very slow, calm drift
          speedY: (Math.random() - 0.5) * 0.1 - 0.03,
          opacity: Math.random() * 0.35 + 0.15,
          pulse: Math.random() * 0.01 + 0.005,
        };
      });
    } else if (variant === 'shop-sparkles') {
      // 4-point diamond glints that twinkle like cut gemstones
      particles = Array.from({ length: 30 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.7 + 0.1,
        pulse: Math.random() * 0.03 + 0.015,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.01,
      }));
    } else if (variant === 'gold-flow') {
      // Rising upward golden energy sparks (representing appreciating gold value)
      particles = Array.from({ length: 50 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.5 + 0.8,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: -(Math.random() * 0.7 + 0.3), // upward flow
        opacity: Math.random() * 0.7 + 0.2,
        pulse: Math.random() * 0.02,
        rayLength: Math.random() * 8 + 4,
      }));
    } else if (variant === 'collections-constellation') {
      // Celestial 8-pointed star nodes that connect to each other when close
      particles = Array.from({ length: 28 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.8 + 1.2,
        speedX: (Math.random() - 0.5) * 0.35,
        speedY: (Math.random() - 0.5) * 0.35,
        opacity: Math.random() * 0.6 + 0.3,
        pulse: Math.random() * 0.015,
        angle: 0,
        spin: 0.005,
      }));
    } else if (variant === 'story-mythology') {
      // Mesopotamian embers and sacred geometrical floating particles
      particles = Array.from({ length: 35 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: -(Math.random() * 0.35 + 0.1),
        opacity: Math.random() * 0.5 + 0.2,
        pulse: Math.random() * 0.02,
      }));
    } else {
      // Default / Favorites / Contact / Admin
      particles = Array.from({ length: 30 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.5 + 0.2,
        pulse: Math.random() * 0.02,
      }));
    }

    let time = 0;

    const render = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);

      if (variant === 'hero-sacred') {
        // Floating ambient dust with gold glow - strictly away from the central logo
        const centerX = width / 2;
        const centerY = height / 2;
        const exclusionRadius = width < 640 ? 140 : 185;

        particles.forEach((p) => {
          if (!prefersReduced) {
            p.x += p.speedX;
            p.y += p.speedY;
            p.opacity += Math.sin(Date.now() * 0.0015 + p.x) * 0.003;
          }

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          // Check distance from central logo
          const dist = Math.hypot(p.x - centerX, p.y - centerY);
          if (dist < exclusionRadius) {
            return; // Keep logo area clean and uncluttered
          }

          // Soft opacity fade near exclusion boundary
          const boundaryFade = Math.min(1, (dist - exclusionRadius) / 40);
          const finalOpacity = Math.max(0.08, Math.min(0.45, p.opacity)) * boundaryFade;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212, 175, 55, ${finalOpacity})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#D4AF37';
          ctx.fill();
        });
      } else if (variant === 'shop-sparkles') {
        // Shimmering diamond 4-point stars
        particles.forEach((p) => {
          p.x += p.speedX;
          p.y += p.speedY;
          p.angle = (p.angle || 0) + (p.spin || 0.005);
          const currentOpacity = (Math.sin(time * 2 + p.x) + 1) * 0.35 + 0.1;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.strokeStyle = `rgba(230, 202, 101, ${currentOpacity})`;
          ctx.fillStyle = `rgba(255, 235, 160, ${currentOpacity * 1.2})`;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#F5E8C7';

          // Draw 4-point star
          ctx.beginPath();
          const s = p.size * 2.5;
          ctx.moveTo(0, -s);
          ctx.quadraticCurveTo(0, 0, s, 0);
          ctx.quadraticCurveTo(0, 0, 0, s);
          ctx.quadraticCurveTo(0, 0, -s, 0);
          ctx.quadraticCurveTo(0, 0, 0, -s);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      } else if (variant === 'gold-flow') {
        // Upward gold stream trails + sine wave flow
        // Background harmonic golden wave
        ctx.save();
        ctx.beginPath();
        for (let x = 0; x < width; x += 10) {
          const y = height * 0.75 + Math.sin(x * 0.005 + time * 1.5) * 35 + Math.cos(x * 0.003 - time) * 20;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        for (let x = 0; x < width; x += 10) {
          const y = height * 0.45 + Math.sin(x * 0.004 - time * 1.2) * 45;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.05)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Particles moving upward like gold sparks
        particles.forEach((p) => {
          p.x += p.speedX;
          p.y += p.speedY;

          if (p.y < 0) {
            p.y = height;
            p.x = Math.random() * width;
          }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + (p.rayLength || 6));
          ctx.strokeStyle = `rgba(212, 175, 55, ${p.opacity * 0.8})`;
          ctx.lineWidth = p.size * 0.8;
          ctx.lineCap = 'round';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#D4AF37';
          ctx.stroke();
          ctx.restore();
        });
      } else if (variant === 'collections-constellation') {
        // Celestial Star of Ishtar Constellations (lines connecting nearby nodes)
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 150) {
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = `rgba(212, 175, 55, ${(1 - dist / 150) * 0.2})`;
              ctx.lineWidth = 0.75;
              ctx.stroke();
            }
          }
        }

        particles.forEach((p) => {
          p.x += p.speedX;
          p.y += p.speedY;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          // Miniature 8-point Ishtar star node
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.fillStyle = `rgba(230, 202, 101, ${p.opacity})`;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#D4AF37';
          
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();

          // 8 tiny rays
          ctx.strokeStyle = `rgba(212, 175, 55, ${p.opacity * 0.6})`;
          ctx.lineWidth = 0.8;
          const ray = p.size * 2;
          ctx.beginPath();
          ctx.moveTo(-ray, 0); ctx.lineTo(ray, 0);
          ctx.moveTo(0, -ray); ctx.lineTo(0, ray);
          const diag = ray * 0.7;
          ctx.moveTo(-diag, -diag); ctx.lineTo(diag, diag);
          ctx.moveTo(diag, -diag); ctx.lineTo(-diag, diag);
          ctx.stroke();

          ctx.restore();
        });
      } else if (variant === 'story-mythology') {
        // Rising warm golden embers with sacred ziggurat stepped geometric ambient line
        ctx.save();
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.05)';
        ctx.lineWidth = 1;
        const stepW = 80;
        const stepH = 40;
        const centerX = width / 2;
        const baseY = height * 0.8;
        
        ctx.beginPath();
        for (let step = 0; step < 6; step++) {
          const sw = (6 - step) * stepW;
          const sy = baseY - step * stepH;
          ctx.strokeRect(centerX - sw / 2, sy, sw, stepH);
        }
        ctx.restore();

        particles.forEach((p) => {
          p.x += p.speedX + Math.sin(time + p.y * 0.01) * 0.3;
          p.y += p.speedY;

          if (p.y < 0) {
            p.y = height;
            p.x = Math.random() * width;
          }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(230, 180, 80, ${p.opacity * 0.7})`;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#D4AF37';
          ctx.fill();
        });
      } else {
        // Ambient particles for other tabs
        particles.forEach((p) => {
          p.x += p.speedX;
          p.y += p.speedY;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212, 175, 55, ${p.opacity * 0.5})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#D4AF37';
          ctx.fill();
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [variant]);

  // Distinct background radial gradients and sacred art overlays tailored to each page
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden max-w-full w-full ${className}`}>
      {/* 1. Page-Specific Luxury Ambient Lighting Gradients */}
      {variant === 'hero-sacred' && (
        <div className="absolute inset-0 opacity-30 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[600px] lg:w-[850px] aspect-square bg-gradient-to-tr from-[#1B325E] via-[#13254A] to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] sm:w-[700px] lg:w-[1100px] aspect-square border border-[#D4AF37]/15 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[500px] lg:w-[750px] aspect-square border border-[#D4AF37]/20 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] sm:w-[350px] lg:w-[450px] aspect-square border border-[#D4AF37]/25 rounded-full" />
        </div>
      )}

      {variant === 'shop-sparkles' && (
        <div className="absolute inset-0 opacity-25 overflow-hidden pointer-events-none">
          {/* Dual luxury radial spotlights over product catalog */}
          <div className="absolute top-20 right-0 sm:right-10 w-[300px] sm:w-[550px] aspect-square bg-[#D4AF37]/10 rounded-full blur-3xl" />
          <div className="absolute top-96 left-0 sm:left-10 w-[320px] sm:w-[650px] aspect-square bg-[#1E3A8A]/25 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-0 sm:right-1/4 w-[340px] sm:w-[700px] aspect-square bg-[#D4AF37]/8 rounded-full blur-3xl" />
        </div>
      )}

      {variant === 'gold-flow' && (
        <div className="absolute inset-0 opacity-30 overflow-hidden pointer-events-none">
          {/* Golden market pulse aura */}
          <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[340px] sm:w-[600px] lg:w-[800px] h-[300px] sm:h-[450px] bg-gradient-to-b from-[#D4AF37]/15 via-[#13254A]/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-0 sm:right-10 w-[280px] sm:w-[500px] aspect-square bg-[#D4AF37]/10 rounded-full blur-3xl" />
        </div>
      )}

      {variant === 'collections-constellation' && (
        <div className="absolute inset-0 opacity-30 overflow-hidden pointer-events-none">
          {/* Celestial deep blue twilight with golden constellation rings */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[340px] sm:w-[650px] lg:w-[900px] aspect-square bg-gradient-to-b from-[#1E293B]/40 via-[#13254A]/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-40 left-5 sm:left-20 w-[260px] sm:w-[400px] aspect-square border border-[#D4AF37]/10 rounded-full" />
          <div className="absolute top-60 right-5 sm:right-20 w-[300px] sm:w-[600px] aspect-square border border-[#D4AF37]/10 rounded-full" />
        </div>
      )}

      {variant === 'story-mythology' && (
        <div className="absolute inset-0 opacity-25 overflow-hidden pointer-events-none">
          {/* Mesopotamia warm amber & royal lapis lazuli glow */}
          <div className="absolute top-40 right-0 sm:right-1/3 w-[340px] sm:w-[700px] aspect-square bg-gradient-to-tr from-[#92400E]/20 via-[#1E3A8A]/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-32 left-0 sm:left-1/4 w-[300px] sm:w-[600px] aspect-square bg-[#D4AF37]/15 rounded-full blur-3xl" />
        </div>
      )}

      {variant === 'favorites-twilight' && (
        <div className="absolute inset-0 opacity-25 overflow-hidden pointer-events-none">
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[340px] sm:w-[650px] aspect-square bg-gradient-to-b from-[#BE185D]/15 via-[#1E3A8A]/30 to-transparent rounded-full blur-3xl" />
        </div>
      )}

      {variant === 'contact-aurora' && (
        <div className="absolute inset-0 opacity-25 overflow-hidden pointer-events-none">
          <div className="absolute top-36 right-0 sm:right-10 w-[300px] sm:w-[600px] aspect-square bg-[#D4AF37]/12 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-0 sm:left-10 w-[300px] sm:w-[600px] aspect-square bg-[#1E3A8A]/30 rounded-full blur-3xl" />
        </div>
      )}

      {/* 2. Interactive Canvas for dynamic particle motion */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full max-w-full" />
    </div>
  );
};
