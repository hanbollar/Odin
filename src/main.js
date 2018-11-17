 import { makeRenderLoop, camera, cameraControls, gui } from './init';
 import { mat4, vec4, vec2 } from 'gl-matrix';
 import Scene from './scene';

// // setup gui
const params = {
  title: "GUI",
};
gui.add(params, 'title');

// setup scene
camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
const scene = new Scene();

// makeRenderLoop(
//   function() {
//     scene.update()
//   }
// )();