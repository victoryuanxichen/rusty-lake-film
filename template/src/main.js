// main.js — wires the scenes into one timeline. One file per scene in src/scenes/, each exporting SHOTS.
import { shots, start } from './engine.js';
import { endCardShot } from './endcard.js';
// import { SHOTS as s01 } from './scenes/s01-xxx.js';

shots([
  // ...s01,
  ...(PROJECT.endcard?.on === false ? [] : [endCardShot()]),
]);
start();
