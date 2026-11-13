import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {Background, kickAt, Mycelium, SceneBackdrops, SeedPulse, Signal} from './network';
import {IntroLayer, type IntroStyle} from './intro';
import {EndCard, IntroText, OutroText, StepText, StepVisual} from './scenes';
import {buildTimeline} from './timeline';
import {seg} from './lib';
import type {Spec} from './types';

export const Reel: React.FC<{spec: Spec; assetBase: string}> = ({spec, assetBase}) => {
  const frame = useCurrentFrame();
  const tl = buildTimeline(spec);
  const logo = tl.scenes[tl.scenes.length - 1];
  const tint = seg(frame, logo.from, logo.from + 20);
  const kick = kickAt(
    frame,
    tl.scenes.filter((s) => s.kind === 'step' || s.kind === 'outro').map((s) => s.from + 10),
  );
  const asset = (f?: string) => (f ? `${assetBase}/${f}` : undefined);
  const backdrops = [
    {src: asset(spec.intro.backdrop), from: tl.scenes[0].from, end: tl.scenes[0].end},
    ...spec.steps.map((st, i) => ({src: asset(st.backdrop), from: tl.scenes[1 + i].from, end: tl.scenes[1 + i].end})),
  ];
  const introEnd = tl.scenes[0].end;
  const introStyle = ((spec.intro.style && spec.intro.style !== 'auto' ? spec.intro.style : 'seed') as IntroStyle);
  const seed = introStyle === 'seed';
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 + kick * 0.035})`, transformOrigin: '50% 55%'}}>
        <Background tint={tint} />
        <SceneBackdrops items={backdrops} />
        <Mycelium start={seed ? 6 : introEnd - 40} opacity={(1 - tint) * 0.9} />
        {seed ? <SeedPulse until={introEnd + 20} /> : null}
        <Sequence from={0} durationInFrames={introEnd}>
          <IntroLayer style={introStyle} dur={introEnd} />
        </Sequence>
        {tl.scenes.map((s, i) => {
          if (s.kind === 'intro') {
            return (
              <Sequence key={i} from={s.from} durationInFrames={s.dur}>
                <IntroText headline={spec.intro.headline} sub={spec.intro.sub} dur={s.dur} style={introStyle} />
              </Sequence>
            );
          }
          if (s.kind === 'step') {
            const st = spec.steps[s.idx];
            return (
              <Sequence key={i} from={s.from} durationInFrames={s.dur}>
                <StepText step={st} n={st.badge ?? String(s.idx + 1)} dur={s.dur} />
                <StepVisual visual={st.visual} dur={s.dur} note={spec.cardNote} />
              </Sequence>
            );
          }
          return null;
        })}
        <Signal scenes={tl.scenes} />
      </div>
      {tl.scenes.map((s, i) =>
        s.kind === 'outro' ? (
          <Sequence key={i} from={s.from} durationInFrames={s.dur}>
            <OutroText headline={spec.outro.headline} sub={spec.outro.sub} dur={s.dur} />
          </Sequence>
        ) : s.kind === 'logo' ? (
          <Sequence key={i} from={s.from} durationInFrames={s.dur}>
            <EndCard />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
};
