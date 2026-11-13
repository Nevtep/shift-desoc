import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadFraunces} from '@remotion/google-fonts/Fraunces';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import brand from './brand.json';

const fraunces = loadFraunces('normal', {weights: ['600', '700'], subsets: ['latin', 'latin-ext']});
const inter = loadInter('normal', {weights: ['400', '500', '600'], subsets: ['latin', 'latin-ext']});
export const SERIF = fraunces.fontFamily;
export const SANS = inter.fontFamily;

export const W = 1080;
export const H = 1920;

export const C: {cream: string; paper: string; logoBg: string; sand: string; sage: string; olive: string; mustard: string; terracotta: string; charcoal: string} = brand.palette;
export const AV = [C.olive, C.terracotta, C.sage, C.mustard];
export const colorOf = (n?: string) => (n ? (C as Record<string, string>)[n] ?? C.olive : C.olive);

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const seg = (f: number, a: number, b: number, ease: (t: number) => number = Easing.inOut(Easing.cubic)) =>
  interpolate(f, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

export const useSp = (delay: number, damping = 14, stiffness = 120, mass = 0.8) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping, stiffness, mass}});
};

export const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

export const Words: React.FC<{
  text: string;
  start: number;
  size: number;
  color?: string;
  family?: string;
  weight?: number;
  lh?: number;
  stagger?: number;
  width?: number;
}> = ({text, start, size, color = C.charcoal, family = SERIF, weight = 700, lh = 1.08, stagger = 4, width = 880}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{width, display: 'flex', flexWrap: 'wrap', columnGap: size * 0.26, fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: lh, color}}>
      {words.map((w, i) => {
        const s = spring({frame: frame - start - i * stagger, fps, config: {damping: 16, stiffness: 140, mass: 0.7}});
        return (
          <span key={i} style={{display: 'inline-block', opacity: clamp01(s * 1.4), transform: `translateY(${(1 - s) * 46}px) rotate(${(1 - s) * 3}deg)`, transformOrigin: 'left bottom'}}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Fade: React.FC<{from: number; to: number; children: React.ReactNode; style?: React.CSSProperties}> = ({from, to, children, style}) => {
  const frame = useCurrentFrame();
  const p = seg(frame, from, to);
  return <div style={{opacity: 1 - p, transform: `translateY(${p * -40}px)`, ...style}}>{children}</div>;
};

export const Badge: React.FC<{n: string; start: number}> = ({n, start}) => {
  const s = useSp(start, 11, 160, 0.7);
  return (
    <div
      style={{
        width: 92,
        height: 92,
        borderRadius: 46,
        background: C.mustard,
        color: C.charcoal,
        fontFamily: SERIF,
        fontWeight: 700,
        fontSize: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${s}) rotate(${(1 - s) * -40}deg)`,
        boxShadow: '0 12px 30px rgba(63,59,52,0.18)',
      }}
    >
      {n}
    </div>
  );
};

export const Avatar: React.FC<{size: number; color: string; head?: string; ring?: boolean}> = ({size, color, head = C.paper, ring}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{display: 'block'}}>
    <circle cx="50" cy="50" r="48" fill={color} />
    <circle cx="50" cy="38" r="17" fill={head} />
    <path d="M18 88 Q50 46 82 88 Z" fill={head} />
    {ring ? <circle cx="50" cy="50" r="48" fill="none" stroke={C.paper} strokeWidth="5" /> : null}
  </svg>
);

export const Typewriter: React.FC<{text: string; start: number; cps?: number; size: number; color?: string; family?: string; weight?: number}> = ({
  text,
  start,
  cps = 1.1,
  size,
  color = C.charcoal,
  family = SANS,
  weight = 500,
}) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - start) * cps)));
  const done = n >= text.length;
  const caret = !done && frame >= start && Math.floor(frame / 8) % 2 === 0;
  return (
    <span style={{fontFamily: family, fontWeight: weight, fontSize: size, color, lineHeight: 1.25}}>
      {text.slice(0, n)}
      <span style={{opacity: caret ? 1 : 0, color: C.terracotta}}>|</span>
    </span>
  );
};
