import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useGoldStore } from '../context/GoldStoreContext';

// Homepage opener: Inanna's eight-pointed star rests in the night sky, falls like a
// comet as the visitor scrolls and strikes the ground; the brand then appears on the same night sky.
// The previous opener remains in HeroSection.tsx; swapping the import in App.tsx restores it.

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeIn = (t: number) => t * t * t;
const rand = (n: number) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const FIELD = Array.from({ length: 160 }, (_, i) => ({ x: rand(i * 3 + 1), y: rand(i * 3 + 2) * 0.78, r: rand(i * 3 + 3) * 1.2 + 0.3, ph: rand(i * 7) * 6.28 }));

function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, time: number) {
  const fall = clamp((p - 0.08) / 0.55);
  const impact = clamp((p - 0.63) / 0.08);
  const light = clamp((p - 0.66) / 0.3);
  const s = Math.min(W, H) / 700 + 0.55;
  const gy = H * 0.8;
  const fallPoint = (t: number) => {
    // Starts low enough to clear the header, which is taller on phones with a status-bar inset.
    const sx = W * 0.64, sy = H * 0.24, cx = W * 0.12, cy = H * 0.34, ex = W * 0.5, ey = gy, u = 1 - t;
    return { x: u * u * sx + 2 * u * t * cx + t * t * ex, y: u * u * sy + 2 * u * t * cy + t * t * ey };
  };

  // The night sky stays as it is throughout; the impact only throws a brief glow
  // from the ground, which is gone again by the time the brand appears.
  ctx.fillStyle = '#050A14';
  ctx.fillRect(0, 0, W, H);
  for (const f of FIELD) {
    ctx.fillStyle = `rgba(245,236,215,${0.25 + 0.3 * Math.sin(time / 800 + f.ph)})`;
    ctx.beginPath(); ctx.arc(f.x * W, f.y * H, f.r, 0, Math.PI * 2); ctx.fill();
  }
  const afterglow = Math.max(impact, light) * (1 - light);
  if (afterglow > 0) {
    const g = ctx.createRadialGradient(W / 2, gy, 0, W / 2, gy, Math.min(W, H) * 0.6);
    g.addColorStop(0, `rgba(255,228,150,${0.5 * afterglow})`);
    g.addColorStop(0.4, `rgba(212,175,55,${0.2 * afterglow})`);
    g.addColorStop(1, 'rgba(212,175,55,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // Comet tail: a smooth tapered stroke along the path just behind the star.
  const tailFade = 1 - clamp((p - 0.6) / 0.05);
  if (fall > 0 && tailFade > 0) {
    const steps = 60, length = 0.22;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    let previous = fallPoint(easeIn(clamp(fall - length)));
    for (let k = 1; k <= steps; k++) {
      const along = k / steps;
      const q = fallPoint(easeIn(clamp(fall - length * (1 - along))));
      ctx.strokeStyle = `rgba(255,214,120,${0.45 * along * along * tailFade})`;
      ctx.lineWidth = (1 + along * 9) * s;
      ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      previous = q;
    }
    ctx.restore();
  }
  if (fall > 0 && impact < 1) {
    for (let k = 0; k < 22; k++) {
      const t = clamp(fall - k * 0.02 - 0.01); if (t <= 0) break;
      const q = fallPoint(easeIn(t)); const jitter = (rand(k + Math.floor(time / 90)) - 0.5) * 18 * s;
      ctx.fillStyle = `rgba(255,246,214,${0.7 * (1 - k / 22) * (1 - impact)})`;
      ctx.beginPath(); ctx.arc(q.x + jitter, q.y - jitter * 0.6, 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // The star: resting and breathing at the top, then falling and spinning faster.
  if (impact < 1) {
    const q = fallPoint(easeIn(fall));
    if (fall === 0) q.y += Math.sin(time / 900) * 4;
    const R = (16 + fall * 10) * s, alpha = 1 - impact, rotation = time / 2600 + fall * 7;
    const glow = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, R * 3.2);
    glow.addColorStop(0, `rgba(255,236,170,${0.55 * alpha})`);
    glow.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(q.x, q.y, R * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = rotation + i * Math.PI / 8 - Math.PI / 2, r = i % 2 ? R * 0.42 : R;
      ctx.lineTo(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(232,199,102,${alpha})`; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,246,214,${alpha})`; ctx.stroke();
  }

  // Impact: a warm burst of light from the ground and a widening ring.
  if (impact > 0 && impact < 1) {
    const flash = Math.sin(impact * Math.PI);
    const burstLight = ctx.createRadialGradient(W / 2, gy, 0, W / 2, gy, Math.min(W, H) * 0.75);
    burstLight.addColorStop(0, `rgba(255,240,190,${0.8 * flash})`);
    burstLight.addColorStop(0.3, `rgba(240,196,90,${0.3 * flash})`);
    burstLight.addColorStop(1, 'rgba(240,196,90,0)');
    ctx.fillStyle = burstLight; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(255,232,170,${1 - impact})`; ctx.lineWidth = 3 * (1 - impact) + 0.5;
    ctx.beginPath(); ctx.ellipse(W / 2, gy, impact * W * 0.7, impact * H * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // Sparks thrown up from the impact.
  const burst = clamp((p - 0.63) / 0.22);
  if (burst > 0 && burst < 1) {
    for (let i = 0; i < 40; i++) {
      const angle = Math.PI + rand(i + 3) * Math.PI;
      const dist = burst * (60 + rand(i + 50) * Math.min(W, H) * 0.4);
      ctx.fillStyle = `rgba(255,236,170,${1 - burst})`;
      ctx.beginPath(); ctx.arc(W / 2 + Math.cos(angle) * dist, gy + Math.sin(angle) * dist + burst * burst * 70, 1.2 + rand(i) * 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// The browser pins the stage natively (no jitter on phones) wherever overflow: clip lets
// position: sticky work; older browsers fall back to moving the stage each frame.
const NATIVE_STICKY = typeof CSS !== 'undefined' && CSS.supports('overflow-x', 'clip');

// Plays the whole fall from the current position to the lit scene in one smooth glide.
function glideTo(targetY: number, duration = 2600) {
  const startY = window.scrollY, distance = targetY - startY, startTime = performance.now();
  let stopped = false;
  const stop = () => { stopped = true; };
  window.addEventListener('wheel', stop, { once: true, passive: true });
  window.addEventListener('touchstart', stop, { once: true, passive: true });
  const step = (now: number) => {
    if (stopped) return;
    const t = clamp((now - startTime) / duration);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    window.scrollTo(0, startY + distance * eased);
    if (t < 1) requestAnimationFrame(step);
    else { window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); }
  };
  requestAnimationFrame(step);
}

export const StarFallHero: React.FC = () => {
  const { setActiveTab } = useGoldStore();
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const section = sectionRef.current, stage = stageRef.current, canvas = canvasRef.current;
    const brand = brandRef.current, hint = hintRef.current;
    const ctx = canvas?.getContext('2d');
    if (!section || !stage || !canvas || !brand || !hint || !ctx) return;
    let frame = 0, width = 0, height = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth; height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const tick = (time: number) => {
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, rect.height - stage.clientHeight);
      const offset = clamp(-rect.top, 0, travel);
      if (!NATIVE_STICKY) stage.style.transform = `translate3d(0, ${offset}px, 0)`;
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        if (canvas.clientWidth !== width || canvas.clientHeight !== height) resize();
        const p = reduced ? 1 : offset / travel;
        drawScene(ctx, width, height, p, reduced ? 0 : time);
        const shown = clamp((p - 0.74) / 0.16);
        brand.style.opacity = String(shown);
        brand.style.transform = `translateY(${(1 - shown) * 22}px)`;
        brand.style.pointerEvents = shown > 0.6 ? 'auto' : 'none';
        hint.style.opacity = String(1 - clamp(p / 0.06));
        hint.style.pointerEvents = p < 0.06 ? 'auto' : 'none';
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [reduced]);

  return (
    <section id="inana-luxury-hero" ref={sectionRef} className="relative w-full bg-[#050A14] select-none" style={{ height: reduced ? '100svh' : '340svh' }}>
      <div ref={stageRef} className={`${NATIVE_STICKY ? 'sticky' : 'absolute inset-x-0 will-change-transform'} top-0 h-[100svh] overflow-hidden`}>
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full block" />
        <div ref={brandRef} className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 text-center" style={{ opacity: 0, pointerEvents: 'none' }}>
          {/* The brand appears in its own gold on the unchanged night sky. */}
          <img src="/inana-logo-gold.png" alt="لوگوی اینانا گلد" width={112} height={112} draggable={false}
            className="w-24 h-24 sm:w-28 sm:h-28 mb-1 object-contain drop-shadow-[0_0_18px_rgba(212,175,55,0.35)]" />
          <h1 dir="ltr" className="font-serif-brand w-full text-center text-[clamp(22px,6vw,46px)] font-bold uppercase tracking-[0.28em] indent-[0.28em] gold-gradient-text leading-none">
            INANA GOLD
          </h1>
          <p className="text-sm sm:text-base text-[#F5E8C7] font-medium">گالری اینانا برای زنان توانا</p>
          <button
            id="hero-cta-collections"
            type="button"
            onClick={() => { setActiveTab('collections'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#B38A30] text-slate-950 font-bold text-sm sm:text-base hover:brightness-105 active:scale-98 transition-all focus-visible:outline-2 focus-visible:outline-[#F5E8C7] focus-visible:outline-offset-2"
          >
            <span>مشاهده مجموعه‌ها</span>
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          </button>
        </div>
        <button
          ref={hintRef}
          type="button"
          onClick={() => {
            const section = sectionRef.current, stage = stageRef.current;
            if (!section || !stage) return;
            // To the end of the hero, where the scene is fully lit and the brand is shown.
            const end = window.scrollY + section.getBoundingClientRect().top + section.offsetHeight - stage.clientHeight;
            if (reduced) window.scrollTo(0, end); else glideTo(end);
          }}
          className="absolute inset-x-0 mx-auto w-fit bottom-[calc(var(--mobile-nav-offset)+1.25rem)] md:bottom-8 flex flex-col items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4AF37] focus-visible:outline-offset-4 rounded-2xl"
          aria-label="پایین بکشید"
        >
          <span className="rounded-full border border-[#D4AF37]/45 bg-[#0B152B]/80 px-5 py-2 text-sm font-bold text-[#E8C766] shadow-[0_0_24px_rgba(212,175,55,0.18)]">
            پایین بکشید
          </span>
          {/* Three chevrons light up top to bottom, pointing the way down. */}
          <span aria-hidden="true" className="flex flex-col items-center -space-y-1.5">
            {[0, 1, 2].map(i => (
              <span key={i} className="star-scroll-chevron block w-3 h-3 border-b-2 border-r-2 border-[#D4AF37]" style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
          </span>
        </button>
      </div>
    </section>
  );
};
