import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, clamp01, H, rng, SANS, SERIF, seg, W, Words} from './lib';

// Estilos de apertura. 'seed' es el original (semilla y micelio desde abajo).
export const INTRO_STYLES = ['seed', 'sunrise', 'leaves', 'hills'] as const;
export type IntroStyle = (typeof INTRO_STYLES)[number];

export const introAnim = (style: IntroStyle): 'words' | 'rise' | 'blur' | 'type' =>
  style === 'sunrise' ? 'rise' : style === 'leaves' ? 'blur' : style === 'hills' ? 'type' : 'words';

// ---------- titular con cuatro entradas distintas ----------
export const IntroHeadline: React.FC<{text: string; anim: 'words' | 'rise' | 'blur' | 'type'}> = ({text, anim}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (anim === 'words') return <Words text={text} start={8} size={110} stagger={5} />;
  const base: React.CSSProperties = {width: 900, fontFamily: SERIF, fontWeight: 700, fontSize: 110, lineHeight: 1.08, color: C.charcoal};
  if (anim === 'rise') {
    const s = spring({frame: frame - 18, fps, config: {damping: 18, stiffness: 70, mass: 1.1}});
    return <div style={{...base, opacity: clamp01(s * 1.3), transform: `translateY(${(1 - s) * 140}px) scale(${0.94 + s * 0.06})`, transformOrigin: 'left bottom', letterSpacing: (1 - s) * 6}}>{text}</div>;
  }
  if (anim === 'blur') {
    return (
      <div style={{...base, display: 'flex', flexWrap: 'wrap', columnGap: 110 * 0.26}}>
        {text.split(' ').map((w, i) => {
          const p = seg(frame, 14 + i * 6, 38 + i * 6, Easing.out(Easing.cubic));
          return <span key={i} style={{display: 'inline-block', opacity: p, filter: `blur(${(1 - p) * 18}px)`, transform: `scale(${1.12 - p * 0.12})`}}>{w}</span>;
        })}
      </div>
    );
  }
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - 10) * 1.5)));
  return <div style={base}>{text.slice(0, n)}<span style={{opacity: 0}}>{text.slice(n)}</span></div>;
};

// ---------- capas de fondo de la apertura ----------
const fadeOut = (frame: number, dur: number) => 1 - seg(frame, dur - 26, dur);

const Sunrise: React.FC<{dur: number}> = ({dur}) => {
  const frame = useCurrentFrame();
  const rise = seg(frame, 4, 52, Easing.out(Easing.cubic));
  const y = 2150 - rise * 880;
  const halos = [0, 1, 2].map((i) => {
    const t = seg(frame, 20 + i * 14, 90 + i * 14, Easing.out(Easing.cubic));
    const r = 300 + t * (260 + i * 160);
    return <div key={i} style={{position: 'absolute', left: 540 - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: i % 2 ? C.terracotta : C.mustard, opacity: (1 - t) * 0.22 * rise}} />;
  });
  return (
    <AbsoluteFill style={{opacity: fadeOut(frame, dur)}}>
      {halos}
      <div style={{position: 'absolute', left: 540 - 250, top: y - 250, width: 500, height: 500, borderRadius: '50%', background: C.mustard, boxShadow: '0 0 120px rgba(207,166,61,0.7)', opacity: 0.9}} />
      <div style={{position: 'absolute', left: 540 - 150, top: y - 150, width: 300, height: 300, borderRadius: '50%', background: C.terracotta, opacity: 0.55, transform: `scale(${1 + Math.sin(frame / 14) * 0.04})`}} />
    </AbsoluteFill>
  );
};

const LEAF = 'M0 0 C 34 -52 104 -52 140 0 C 104 52 34 52 0 0 Z';
const Leaves: React.FC<{dur: number}> = ({dur}) => {
  const frame = useCurrentFrame();
  const leaves = useMemo(() => {
    const r = rng(23);
    const cols = [C.sage, C.olive, C.mustard, C.terracotta, C.sage];
    return Array.from({length: 18}, (_, i) => ({
      x: 80 + r() * 920,
      yEnd: 1040 + r() * 760,
      delay: r() * 38,
      rot0: r() * 360,
      rot1: r() * 360 - 180,
      s: 0.7 + r() * 1.1,
      c: cols[i % cols.length],
      sway: 40 + r() * 70,
      ph: r() * 6,
    }));
  }, []);
  return (
    <AbsoluteFill style={{opacity: fadeOut(frame, dur)}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {leaves.map((l, i) => {
          const t = seg(frame, 4 + l.delay, 4 + l.delay + 70, Easing.out(Easing.quad));
          const y = -160 + t * (l.yEnd + 160);
          const x = l.x + Math.sin(t * 7 + l.ph) * l.sway * (1 - t * 0.6);
          const rot = l.rot0 + (l.rot1 - l.rot0) * t;
          return <path key={i} d={LEAF} fill={l.c} opacity={0.55 * clamp01(t * 6)} transform={`translate(${x} ${y}) rotate(${rot}) scale(${l.s})`} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

const hillPath = (base: number, amp: number, k: number, ph: number) => {
  const pts: string[] = [];
  for (let x = -20; x <= W + 20; x += 40) pts.push(`${x} ${(base + Math.sin(x / k + ph) * amp).toFixed(1)}`);
  return `M ${pts.join(' L ')} L ${W + 20} ${H + 40} L -20 ${H + 40} Z`;
};
const Hills: React.FC<{dur: number}> = ({dur}) => {
  const frame = useCurrentFrame();
  const layers = [
    {base: 1250, amp: 70, k: 170, ph: 0.4, c: C.sand, o: 0.7, d: 14},
    {base: 1420, amp: 90, k: 210, ph: 2.1, c: C.sage, o: 0.6, d: 8},
    {base: 1590, amp: 80, k: 150, ph: 4.0, c: C.olive, o: 0.55, d: 2},
  ];
  return (
    <AbsoluteFill style={{opacity: fadeOut(frame, dur)}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {layers.map((l, i) => {
          const t = seg(frame, l.d, l.d + 46, Easing.out(Easing.cubic));
          return <path key={i} d={hillPath(l.base, l.amp, l.k, l.ph)} fill={l.c} opacity={l.o} transform={`translate(${Math.sin(frame / 50 + i) * 14} ${(1 - t) * 700})`} />;
        })}
        {[0, 1, 2, 3, 4].map((i) => {
          const t = seg(frame, 44 + i * 6, 74 + i * 6, Easing.out(Easing.back(2)));
          const x = 160 + i * 190;
          const y = 1470 + (i % 2) * 90;
          return <circle key={i} cx={x} cy={y} r={20 * t} fill={i % 2 ? C.mustard : C.terracotta} opacity={0.9} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

export const IntroLayer: React.FC<{style: IntroStyle; dur: number}> = ({style, dur}) => {
  if (style === 'sunrise') return <Sunrise dur={dur} />;
  if (style === 'leaves') return <Leaves dur={dur} />;
  if (style === 'hills') return <Hills dur={dur} />;
  return null;
};
