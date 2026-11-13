import React from 'react';
import {Composition} from 'remotion';
import {Reel} from './Reel';
import {buildTimeline, FPS} from './timeline';
import type {Spec} from './types';
import example from '../examples/idea-a-votacion/spec.json';

export const Root: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={Reel as React.FC<any>}
      durationInFrames={buildTimeline(example as unknown as Spec).total}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{spec: example as unknown as Spec, assetBase: 'reels/idea-a-votacion'}}
      calculateMetadata={({props}) => ({durationInFrames: buildTimeline((props as any).spec).total})}
    />
  );
};
