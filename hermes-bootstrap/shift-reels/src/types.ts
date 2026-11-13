export type Comment = {text: string; c?: number};
export type DocLine = {text: string; text2?: string};
export type BarRow = {label: string; v: number; c?: 'olive' | 'terracotta' | 'mustard' | 'sage'};
export type Panel = {title: string; chip?: string; rows: BarRow[]};

export type Visual =
  | {type: 'none'}
  | {type: 'thread'; title: string; tag: string; comments: Comment[]}
  | {type: 'document'; title: string; tag: string; lines: DocLine[]; versions?: string[]; reviewers?: number; reviewersLabel?: string}
  | {type: 'bars'; panels: Panel[]; note?: string; dots?: boolean}
  | {type: 'points'; items: string[]};

export type Step = {
  badge?: string;
  title: string;
  body: string;
  visual?: Visual;
  backdrop?: string; // relativo al spec, copiado a public/reels/<slug>/
  durationSec?: number;
};

export type Spec = {
  slug: string;
  intro: {headline: string; sub?: string; backdrop?: string; durationSec?: number; style?: 'auto' | 'seed' | 'sunrise' | 'leaves' | 'hills'};
  steps: Step[];
  outro: {headline: string; sub?: string; durationSec?: number};
  cardNote?: string; // pie de las tarjetas, p. ej. "Ejemplo ilustrativo"
  logoSec?: number;
  // musica opcional: pista de public/music (o 'auto'), ventana y volumen
  music?: string | {track: string; startSec?: number; lufs?: number};
};
