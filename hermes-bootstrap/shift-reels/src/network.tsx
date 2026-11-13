import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {C, H, W, rng, seg} from './lib';
import type {SceneDef} from './timeline';

// ---------- red de micelio ----------
type Branch = {d: string; delay: number; dur: number; w: number; end: [number, number]; node: boolean};

const buildNetwork = (): Branch[] => {
  const r = rng(7);
  const out: Branch[] = [];
  const origin: [number, number] = [540, 1180];
  const grow = (x: number, y: number, ang: number, len: number, depth: number, delay: number, w: number) => {
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    if (ey < 700 || ex < -40 || ex > W + 40 || ey > H + 40) return;
    const bend = (r() - 0.5) * len * 0.7;
    const cx = (x + ex) / 2 + Math.cos(ang + Math.PI / 2) * bend;
    const cy = (y + ey) / 2 + Math.sin(ang + Math.PI / 2) * bend;
    const d = `M ${x.toFixed(1)} ${y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    const dur = 26 + len * 0.1;
    out.push({d, delay, dur, w, end: [ex, ey], node: depth === 0 || r() > 0.7});
    if (depth > 0) {
      const kids = depth === 3 ? 2 : r() > 0.5 ? 3 : 2;
      for (let k = 0; k < kids; k++) {
        grow(ex, ey, ang + (r() - 0.5) * 1.5, len * (0.62 + r() * 0.22), depth - 1, delay + dur * 0.8, Math.max(1.6, w * 0.72));
      }
    }
  };
  const roots = 9;
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + r() * 0.3;
    grow(origin[0], origin[1], a, 230 + r() * 130, 3, 8 + i * 2, 7);
  }
  return out;
};

export const Mycelium: React.FC<{start: number; opacity: number}> = ({start, opacity}) => {
  const frame = useCurrentFrame();
  const branches = useMemo(() => buildNetwork(), []);
  return (
    <AbsoluteFill style={{opacity}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {branches.map((b, i) => {
          const p = seg(frame, start + b.delay, start + b.delay + b.dur, Easing.out(Easing.cubic));
          if (p <= 0) return null;
          const ev = evolvePath(p, b.d);
          const sway = Math.sin((frame + i * 9) / 38) * 1.2;
          const nodeP = seg(frame, start + b.delay + b.dur - 4, start + b.delay + b.dur + 14, Easing.out(Easing.back(2)));
          return (
            <g key={i} transform={`translate(${sway} 0)`}>
              <path d={b.d} fill="none" stroke={i % 3 === 0 ? C.olive : C.sage} strokeWidth={b.w} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={0.5} />
              {b.node && nodeP > 0 ? <circle cx={b.end[0]} cy={b.end[1]} r={(5 + b.w * 0.6) * nodeP} fill={i % 4 === 0 ? C.mustard : C.terracotta} opacity={0.85} /> : null}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---------- fondo base ----------
export const Background: React.FC<{tint: number}> = ({tint}) => {
  const frame = useCurrentFrame();
  const blobs = [
    {x: 160, y: 520, r: 420, c: C.sand, ph: 0},
    {x: 930, y: 1250, r: 520, c: C.sage, ph: 2},
    {x: 300, y: 1640, r: 460, c: C.sand, ph: 4},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: tint > 0.5 ? C.logoBg : C.cream}}>
      <AbsoluteFill style={{backgroundColor: C.logoBg, opacity: tint}} />
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.x - b.r + Math.sin(frame / 90 + b.ph) * 40,
            top: b.y - b.r + Math.cos(frame / 110 + b.ph) * 50,
            width: b.r * 2,
            height: b.r * 2,
            borderRadius: '50%',
            background: b.c,
            opacity: 0.2 * (1 - tint),
            filter: 'blur(40px)',
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ---------- fondos ilustrados por pantalla (sutiles) ----------
export const SceneBackdrops: React.FC<{items: {src?: string; from: number; end: number}[]}> = ({items}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {items.map((b, i) => {
        if (!b.src) return null;
        const a = b.from;
        const d = b.end + 30;
        const o = interpolate(frame, [a, a + 30, b.end, d], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        if (o <= 0) return null;
        const t = (frame - a) / (d - a);
        const sc = 1.05 + t * 0.07;
        const ty = (0.5 - t) * 60;
        const tx = Math.sin(t * 3 + i) * 18;
        return (
          <AbsoluteFill key={i} style={{opacity: o * 0.42, mixBlendMode: 'multiply', transform: `translate(${tx}px, ${ty}px) scale(${sc})`}}>
            <Img src={staticFile(b.src)} style={{width: W, height: H, objectFit: 'cover'}} />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- cometa de micelio en cada cambio ----------
const WAY: [number, number][] = [
  [540, 1180],
  [150, 900],
  [930, 1010],
  [540, 1010],
  [150, 1100],
  [930, 1150],
  [540, 760],
];

export const Signal: React.FC<{scenes: SceneDef[]}> = ({scenes}) => {
  const frame = useCurrentFrame();
  const out: React.ReactNode[] = [];
  const bounds = scenes.filter((s) => s.kind !== 'logo').map((s) => s.end);
  bounds.slice(0, -1).forEach((end, gi) => {
    const a = end - 34;
    const b = end + 2;
    const from = WAY[gi % WAY.length];
    const to = WAY[(gi + 1) % WAY.length];
    const bend = gi % 2 ? 220 : -200;
    const pos = (p: number): [number, number] => {
      const q = Math.min(1, Math.max(0, p));
      const mx = (from[0] + to[0]) / 2 + bend;
      const my = (from[1] + to[1]) / 2 - Math.abs(bend) * 0.5;
      return [(1 - q) * (1 - q) * from[0] + 2 * (1 - q) * q * mx + q * q * to[0], (1 - q) * (1 - q) * from[1] + 2 * (1 - q) * q * my + q * q * to[1]];
    };
    if (frame < a || frame > b + 24) return;
    const p = seg(frame, a, b, Easing.inOut(Easing.cubic));
    for (let k = 0; k < 16; k++) {
      const pk = p - k * 0.022;
      if (pk < 0) continue;
      const [x, y] = pos(pk);
      const r = (22 - k * 1.1) * (frame <= b ? 1 : 0);
      if (r <= 0) continue;
      out.push(<div key={`${gi}-${k}`} style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: k % 2 ? C.terracotta : C.mustard, opacity: (1 - k / 16) * 0.85, filter: k === 0 ? 'none' : 'blur(1px)'}} />);
    }
    const rp = seg(frame, b, b + 24, Easing.out(Easing.cubic));
    if (rp > 0 && rp < 1) {
      const [x, y] = pos(1);
      const rr = 40 + rp * 170;
      out.push(<div key={`r-${gi}`} style={{position: 'absolute', left: x - rr, top: y - rr, width: rr * 2, height: rr * 2, borderRadius: '50%', border: `5px solid ${C.mustard}`, opacity: (1 - rp) * 0.7}} />);
    }
  });
  return <AbsoluteFill>{out}</AbsoluteFill>;
};

export const kickAt = (frame: number, events: number[]) => {
  let k = 0;
  for (const e of events) {
    const t = frame - e;
    if (t >= 0 && t < 22) k = Math.max(k, Math.exp(-t / 5) * Math.cos(t / 2.2) * 0.5 + Math.exp(-t / 5) * 0.5);
  }
  return k;
};

export const SeedPulse: React.FC<{until: number}> = ({until}) => {
  const frame = useCurrentFrame();
  const appear = seg(frame, 0, 18, Easing.out(Easing.back(2)));
  const fade = 1 - seg(frame, until - 36, until);
  if (frame > until) return null;
  return (
    <>
      {[0, 1, 2].map((i) => {
        const t = ((frame + i * 24) % 72) / 72;
        return <div key={i} style={{position: 'absolute', left: 540 - 220 * t, top: 1180 - 220 * t, width: 440 * t, height: 440 * t, borderRadius: '50%', border: `4px solid ${C.mustard}`, opacity: (1 - t) * 0.6 * fade * appear}} />;
      })}
      <div style={{position: 'absolute', left: 540 - 34, top: 1180 - 34, width: 68, height: 68, borderRadius: 34, background: C.mustard, boxShadow: '0 0 60px rgba(207,166,61,0.8)', transform: `scale(${appear * (1 + Math.sin(frame / 6) * 0.08)})`, opacity: fade}} />
    </>
  );
};
