// config.js — the agreed parameter card. The browser reads window.PROJECT, music/score.mjs reads module.exports.
const PROJECT = {
  title: 'rusty-lake-film',
  style: ['rusty-lake-film'],
  width: 1920, height: 1080,
  fps: 24,                             // 24 = film; the puppet animation does not need more
  drawFps: null,
  duration: 15,
  bpm: 66,                             // slow, ticking-clock tempo; heartbeats / pendulums sit on it
  beatOffset: 0,
  bg: '#000',
  fonts: [
    { family: 'IM Fell English', weights: [400] },     // captions (Rusty Lake-like old serif)
    { family: 'Space Grotesk', weights: [700] },       // end card wordmark
    { family: 'JetBrains Mono', weights: [500] },      // end card terminal line
  ],
  chars: '',
  post: { grain: .04, vignette: .3 },
  motionBlur: { samples: 1, shutter: .5 },             // puppet motion is slow; raise to 3 only for fast whips
  endcard: { on: true, len: 3.2, theme: 'dark', title: 'Claude Code', line: '> made with Claude Code', tr: { type: 'fade', len: .8 } },
  audio: 'assets/score.m4a',
  music: {
    preset: 'ambient',
    seed: 3,
    hits: [],                          // e.g. { t: 4.75, sfx: 'shutter' }, ticks on pendulum extremes, 'boom' v .45 for heartbeats
    sections: [{ at: 0, energy: .3 }],
  },
};
if (typeof module !== 'undefined') module.exports = PROJECT; else window.PROJECT = PROJECT;
