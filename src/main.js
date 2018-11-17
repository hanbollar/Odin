 import { makeRenderLoop, camera, cameraControls, gui, canvas, shadeScreen } from './init';
 import { mat4, vec4, vec2 } from 'gl-matrix';
 import Scene from './scene';

 // setup scene
camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
const scene = new Scene();


makeRenderLoop(
  function() {
    scene.update();
    shadeScreen(canvas.width, canvas.height);
  }
)();