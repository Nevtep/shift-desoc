import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, Img, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {AV, Avatar, Badge, C, clamp01, colorOf, Fade, rng, SANS, SERIF, seg, Typewriter, Words} from './lib';
import type {Panel, Step, Visual} from './types';
import {IntroHeadline, introAnim, type IntroStyle} from './intro';

const CARD_X = 100;
const CARD_Y = 840;
const CARD_W = 880;
const CARD_H = 650;

// ---------- textos de cada paso ----------
export const StepText: React.FC<{step: Step; n: string; dur: number}> = ({step, n, dur}) => {
  const frame = useCurrentFrame();
  const bodyP = seg(frame, 24, 44);
  return (
    <Fade from={dur - 18} to={dur} style={{position: 'absolute', left: 90, top: 260, width: 880}}>
      <Badge n={n} start={4} />
      <div style={{height: 26}} />
      <Words text={step.title} start={10} size={100} />
      <div style={{height: 24}} />
      <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 42, lineHeight: 1.32, color: C.olive, opacity: bodyP, transform: `translateY(${(1 - bodyP) * 24}px)`}}>{step.body}</div>
    </Fade>
  );
};

export const IntroText: React.FC<{headline: string; sub?: string; dur: number; style?: IntroStyle}> = ({headline, sub, dur, style = 'seed'}) => {
  const frame = useCurrentFrame();
  const p = seg(frame, 52, 74);
  return (
    <Fade from={dur - 18} to={dur} style={{position: 'absolute', left: 90, top: 300, width: 900}}>
      <IntroHeadline text={headline} anim={introAnim(style)} />
      <div style={{height: 34}} />
      {sub ? <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 42, lineHeight: 1.32, color: C.olive, opacity: p, transform: `translateY(${(1 - p) * 24}px)`}}>{sub}</div> : null}
    </Fade>
  );
};

export const OutroText: React.FC<{headline: string; sub?: string; dur: number}> = ({headline, sub, dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame: frame - 6, fps, config: {damping: 16, stiffness: 100, mass: 0.9}});
  const out = seg(frame, dur - 20, dur);
  return (
    <div style={{position: 'absolute', left: 90, top: 640, width: 900, opacity: clamp01(a * 1.5) * (1 - out), transform: `translateY(${(1 - a) * 60 - out * 40}px)`}}>
      <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 88, lineHeight: 1.1, color: C.charcoal}}>{headline}</div>
      {sub ? (
        <>
          <div style={{height: 36}} />
          <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 42, lineHeight: 1.3, color: C.olive}}>{sub}</div>
        </>
      ) : null}
    </div>
  );
};

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // el fondo ya es crema del logo (tint completo en 20 cuadros); el logo entra medio segundo despues
  const START = 25;
  const p = seg(frame, START, START + 12);
  const s = spring({frame: frame - START, fps, config: {damping: 15, stiffness: 90, mass: 1}});
  const f = Math.max(0, frame - START);
  return (
    <AbsoluteFill style={{opacity: p, justifyContent: 'center', alignItems: 'center'}}>
      <div style={{transform: `scale(${0.88 + s * 0.12 + f * 0.0004}) translateY(${(1 - s) * 30 - 60}px)`, opacity: clamp01(s * 1.6)}}>
        <Img src={staticFile('logo.png')} style={{width: 900, height: 'auto', display: 'block'}} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- tarjeta con giro 3D ----------
const useCardMotion = (dur: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 6, fps, config: {damping: 15, stiffness: 100, mass: 0.9}});
  const exit = seg(frame, dur - 16, dur - 2, Easing.in(Easing.cubic));
  return {enter, exit, rotY: -70 * (1 - enter) + 70 * exit, ty: (1 - enter) * 300, op: clamp01(enter * 1.5) * (1 - exit), tilt: Math.sin(frame / 40) * 0.25};
};

const Shell: React.FC<{dur: number; note?: string; header?: {title: string; tag: string; tagColor?: string}; children?: React.ReactNode}> = ({dur, note, header, children}) => {
  const m = useCardMotion(dur);
  if (m.enter <= 0.001 || m.exit >= 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: CARD_X,
        top: CARD_Y,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 44,
        background: C.paper,
        boxShadow: '0 40px 80px rgba(63,59,52,0.18), 0 6px 18px rgba(63,59,52,0.10)',
        transform: `perspective(1800px) translateY(${m.ty}px) scale(${0.7 + m.enter * 0.3}) rotate(${m.tilt}deg) rotateY(${m.rotY}deg)`,
        opacity: m.op,
        overflow: 'hidden',
      }}
    >
      {header ? (
        <>
          <div style={{position: 'absolute', left: 44, top: 40, display: 'flex', alignItems: 'center', gap: 20}}>
            <Avatar size={72} color={C.olive} />
            <div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 40, color: C.charcoal, whiteSpace: 'nowrap'}}>{header.title}</div>
          </div>
          <div style={{position: 'absolute', left: 44, top: 114, whiteSpace: 'nowrap', fontFamily: SANS, fontWeight: 600, fontSize: 26, letterSpacing: 2, textTransform: 'uppercase', color: header.tagColor ?? C.olive}}>{header.tag}</div>
        </>
      ) : null}
      {children}
      {note ? (
        <div style={{position: 'absolute', left: 0, bottom: 0, width: '100%', height: 44, background: 'rgba(216,203,174,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 500, fontSize: 22, color: C.olive}}>{note}</div>
      ) : null}
    </div>
  );
};

// ---------- visual: hilo de comentarios ----------
const Thread: React.FC<{v: Extract<Visual, {type: 'thread'}>; dur: number; note?: string}> = ({v, dur, note}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <Shell dur={dur} note={note} header={{title: v.title, tag: v.tag}}>
      {v.comments.slice(0, 3).map((cm, i) => {
        const st = 40 + i * 40;
        const s = spring({frame: frame - st, fps, config: {damping: 13, stiffness: 150, mass: 0.7}});
        if (s <= 0.001) return null;
        return (
          <div key={i} style={{position: 'absolute', left: 44, top: 168 + i * 138, display: 'flex', alignItems: 'center', gap: 22, opacity: clamp01(s * 1.5), transform: `translateX(${(1 - s) * -90}px) scale(${0.85 + s * 0.15})`, transformOrigin: 'left center'}}>
            <Avatar size={78} color={AV[(cm.c ?? i) % 4]} />
            <div style={{background: i % 2 ? '#F1EBDC' : '#EFE8D4', borderRadius: 34, borderTopLeftRadius: 8, padding: '24px 34px', minWidth: 300}}>
              <Typewriter text={cm.text} start={st + 6} size={38} />
            </div>
          </div>
        );
      })}
    </Shell>
  );
};

// ---------- visual: documento con ediciones y revisores ----------
const Doc: React.FC<{v: Extract<Visual, {type: 'document'}>; dur: number; note?: string}> = ({v, dur, note}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lines = v.lines.slice(0, 3);
  const versions = v.versions ?? [];
  const editIdx = lines.findIndex((l) => l.text2);
  const t0 = 26;
  const editStart = t0 + 62;
  const revTop = 240 + lines.length * 100 - 24;
  return (
    <Shell dur={dur} note={note} header={{title: v.title, tag: v.tag, tagColor: C.terracotta}}>
      <div style={{position: 'absolute', right: 44, top: 168, display: 'flex', gap: 12}}>
        {versions.map((vv, i) => {
          const st = t0 + 50 + i * 34;
          const s = spring({frame: frame - st, fps, config: {damping: 12, stiffness: 170, mass: 0.6}});
          const active = frame >= st && (i === versions.length - 1 || frame < st + 34);
          return (
            <div key={vv} style={{transform: `scale(${s})`, padding: '8px 20px', borderRadius: 24, fontFamily: SANS, fontWeight: 600, fontSize: 28, background: active ? C.olive : '#EFE8D4', color: active ? C.paper : C.olive}}>
              {vv}
            </div>
          );
        })}
      </div>
      {lines.map((ln, i) => {
        const st = t0 + i * 24;
        const lineP = seg(frame, st, st + 14);
        const y = 240 + i * 100;
        const isEdit = i === editIdx;
        const strike = isEdit ? seg(frame, editStart, editStart + 12) : 0;
        const swap = isEdit ? seg(frame, editStart + 10, editStart + 24) : 0;
        const hl = isEdit ? seg(frame, editStart + 12, editStart + 30, Easing.out(Easing.cubic)) : 0;
        return (
          <div key={i} style={{position: 'absolute', left: 44, top: y, width: 790, opacity: lineP}}>
            <div style={{position: 'absolute', left: -8, top: 8, height: 62, width: 740 * hl, background: C.mustard, opacity: 0.38, borderRadius: 14}} />
            <div style={{position: 'relative', fontFamily: SANS, fontWeight: 500, fontSize: 40, color: C.charcoal, height: 64}}>
              {isEdit && swap > 0.5 ? (
                <span style={{opacity: swap}}>{ln.text2}</span>
              ) : (
                <span style={{textDecoration: strike > 0.5 ? 'line-through' : 'none', textDecorationColor: C.terracotta, textDecorationThickness: 5, opacity: 1 - strike * 0.4}}>
                  <Typewriter text={ln.text} start={st} cps={1.6} size={40} />
                </span>
              )}
            </div>
          </div>
        );
      })}
      {new Array(Math.min(4, v.reviewers ?? 0)).fill(0).map((_, i) => {
        const st = t0 + 86 + i * 14;
        const s = spring({frame: frame - st, fps, config: {damping: 11, stiffness: 170, mass: 0.6}});
        const chk = spring({frame: frame - st - 10, fps, config: {damping: 9, stiffness: 200, mass: 0.5}});
        return (
          <div key={i} style={{position: 'absolute', left: 44 + i * 96, top: revTop, transform: `scale(${s})`}}>
            <Avatar size={78} color={AV[(i + 1) % 4]} ring />
            <svg width={34} height={34} viewBox="0 0 34 34" style={{position: 'absolute', right: -6, bottom: -4, transform: `scale(${chk})`}}>
              <circle cx="17" cy="17" r="16" fill={C.olive} stroke={C.paper} strokeWidth="3" />
              <path d="M9 17.5 L15 23 L25 11.5" fill="none" stroke={C.paper} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        );
      })}
      {v.reviewers && v.reviewersLabel ? (
        <div style={{position: 'absolute', left: 44 + Math.min(4, v.reviewers) * 96 + 10, top: revTop + 16, fontFamily: SANS, fontWeight: 500, fontSize: 30, color: C.olive, opacity: seg(frame, t0 + 100, t0 + 118)}}>{v.reviewersLabel}</div>
      ) : null}
    </Shell>
  );
};

// ---------- visual: paneles de barras + avatares que votan ----------
const BarPanel: React.FC<{p: Panel; i: number; dur: number}> = ({p, i, dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const start = 8 + i * 18;
  const s = spring({frame: frame - start, fps, config: {damping: 15, stiffness: 110, mass: 0.9}});
  const exit = seg(frame, dur - 16, dur - 2, Easing.in(Easing.cubic));
  if (s <= 0.001 || exit >= 1) return null;
  const two = p.rows.length <= 2;
  return (
    <div style={{position: 'absolute', left: CARD_X, top: CARD_Y + i * 320, width: CARD_W, height: 300, borderRadius: 40, background: C.paper, boxShadow: '0 30px 60px rgba(63,59,52,0.16)', opacity: clamp01(s * 1.4) * (1 - exit), transform: `translateY(${(1 - s) * 120}px) scale(${0.9 + s * 0.1})`}}>
      <div style={{position: 'absolute', left: 40, top: 28, fontFamily: SERIF, fontWeight: 600, fontSize: 40, color: C.charcoal}}>{p.title}</div>
      {p.chip ? <div style={{position: 'absolute', right: 40, top: 30, padding: '6px 20px', borderRadius: 22, background: '#EFE8D4', fontFamily: SANS, fontWeight: 600, fontSize: 24, color: C.olive}}>{p.chip}</div> : null}
      {p.rows.slice(0, 3).map((r, k) => {
        const g = seg(frame, start + 16 + k * 10, start + 70 + k * 10, Easing.out(Easing.cubic));
        const top = 100 + k * (two ? 82 : 58);
        const bh = two ? 52 : 40;
        return (
          <div key={k} style={{position: 'absolute', left: 40, top, display: 'flex', alignItems: 'center', gap: 22}}>
            <div style={{width: 130, fontFamily: SANS, fontWeight: 600, fontSize: 32, color: C.charcoal, whiteSpace: 'nowrap'}}>{r.label}</div>
            <div style={{width: 620, height: bh, borderRadius: bh / 2, background: '#EFE8D4', overflow: 'hidden'}}>
              <div style={{width: `${Math.min(1, r.v) * 100 * g}%`, height: '100%', borderRadius: bh / 2, background: colorOf(r.c)}} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const VoteDots: React.FC<{panels: number; dur: number}> = ({panels, dur}) => {
  const frame = useCurrentFrame();
  const dots = useMemo(() => {
    const r = rng(21);
    return new Array(14).fill(0).map((_, i) => {
      const pi = i % panels;
      return {i, t0: 24 + i * 5, sx: 540 + (r() - 0.5) * 360, sy: CARD_Y + 300 + (r() - 0.5) * 120, tx: 220 + r() * 520, ty: CARD_Y + pi * 320 + 130 + r() * 50, c: AV[i % 4], lift: 120 + r() * 160};
    });
  }, [panels]);
  const out = seg(frame, dur - 16, dur - 2);
  return (
    <>
      {dots.map((d) => {
        const p = seg(frame, d.t0, d.t0 + 34, Easing.inOut(Easing.cubic));
        if (p <= 0 || p >= 1) return null;
        const x = d.sx + (d.tx - d.sx) * p + Math.sin(p * Math.PI * 2 + d.i) * 24;
        const y = d.sy + (d.ty - d.sy) * p - Math.sin(p * Math.PI) * d.lift;
        const sc = 0.5 + Math.sin(p * Math.PI) * 0.7;
        return (
          <div key={d.i} style={{position: 'absolute', left: x - 22, top: y - 22, transform: `scale(${sc})`, opacity: Math.min(1, p * 5) * (1 - Math.max(0, (p - 0.85) * 6)) * (1 - out)}}>
            <Avatar size={44} color={d.c} />
          </div>
        );
      })}
    </>
  );
};

const BarsVisual: React.FC<{v: Extract<Visual, {type: 'bars'}>; dur: number}> = ({v, dur}) => {
  const frame = useCurrentFrame();
  const panels = v.panels.slice(0, 2);
  const a = seg(frame, 60, 80) * (1 - seg(frame, dur - 20, dur - 4));
  return (
    <>
      {panels.map((p, i) => (
        <BarPanel key={i} p={p} i={i} dur={dur} />
      ))}
      {v.dots === false ? null : <VoteDots panels={panels.length} dur={dur} />}
      {v.note ? <div style={{position: 'absolute', left: 100, width: 880, top: CARD_Y + panels.length * 320 - 8, textAlign: 'center', fontFamily: SANS, fontWeight: 500, fontSize: 26, color: C.olive, opacity: a}}>{v.note}</div> : null}
    </>
  );
};

// ---------- visual: lista de puntos (genérico) ----------
const Points: React.FC<{v: Extract<Visual, {type: 'points'}>; dur: number}> = ({v, dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const exit = seg(frame, dur - 16, dur - 2, Easing.in(Easing.cubic));
  return (
    <>
      {v.items.slice(0, 4).map((t, i) => {
        const st = 8 + i * 18;
        const s = spring({frame: frame - st, fps, config: {damping: 14, stiffness: 120, mass: 0.8}});
        const chk = spring({frame: frame - st - 12, fps, config: {damping: 9, stiffness: 200, mass: 0.5}});
        if (s <= 0.001 || exit >= 1) return null;
        return (
          <div key={i} style={{position: 'absolute', left: CARD_X, top: CARD_Y + i * 158, width: CARD_W, height: 134, borderRadius: 40, background: C.paper, boxShadow: '0 24px 50px rgba(63,59,52,0.15)', display: 'flex', alignItems: 'center', gap: 28, padding: '0 40px', opacity: clamp01(s * 1.4) * (1 - exit), transform: `translateX(${(1 - s) * 160}px) scale(${0.92 + s * 0.08})`}}>
            <svg width={64} height={64} viewBox="0 0 64 64" style={{flex: 'none', transform: `scale(${chk})`}}>
              <circle cx="32" cy="32" r="31" fill={AV[i % 4]} />
              <path d="M18 33 L28 43 L46 22" fill="none" stroke={C.paper} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 40, lineHeight: 1.2, color: C.charcoal}}>{t}</div>
          </div>
        );
      })}
    </>
  );
};

export const StepVisual: React.FC<{visual?: Visual; dur: number; note?: string}> = ({visual, dur, note}) => {
  if (!visual || visual.type === 'none') return null;
  if (visual.type === 'thread') return <Thread v={visual} dur={dur} note={note} />;
  if (visual.type === 'document') return <Doc v={visual} dur={dur} note={note} />;
  if (visual.type === 'bars') return <BarsVisual v={visual} dur={dur} />;
  return <Points v={visual} dur={dur} />;
};
