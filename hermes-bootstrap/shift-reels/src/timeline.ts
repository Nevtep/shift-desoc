import type {Spec} from './types';

export const FPS = 30;
export const OV = 10; // solape entre escenas en cuadros

export type SceneDef = {kind: 'intro' | 'step' | 'outro' | 'logo'; idx: number; from: number; dur: number; end: number};

export const buildTimeline = (spec: Spec) => {
  const scenes: SceneDef[] = [];
  const intro = Math.round((spec.intro.durationSec ?? 4.2) * FPS);
  scenes.push({kind: 'intro', idx: 0, from: 0, dur: intro, end: intro});
  let cursor = intro;
  spec.steps.forEach((st, i) => {
    const d = Math.round((st.durationSec ?? 5.4) * FPS);
    scenes.push({kind: 'step', idx: i, from: cursor - OV, dur: d + OV, end: cursor + d});
    cursor += d;
  });
  const outro = Math.round((spec.outro.durationSec ?? 2.8) * FPS);
  scenes.push({kind: 'outro', idx: 0, from: cursor - OV, dur: outro + OV, end: cursor + outro});
  cursor += outro;
  const logo = Math.round(((spec.logoSec ?? 3) + 0.5) * FPS); // +0,5 s: el logo entra medio segundo despues
  scenes.push({kind: 'logo', idx: 0, from: cursor - 6, dur: logo + 6, end: cursor + logo});
  cursor += logo;
  return {scenes, total: cursor, logoFrom: cursor - logo - 6};
};
