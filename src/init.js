export const DEBUG = false && process.env.NODE_ENV === 'development';

import DAT from 'dat.gui';
import WebGLDebug from 'webgl-debug';
import Stats from 'stats-js';
import { PerspectiveCamera } from 'three';
import OrbitControls from 'three-orbitcontrols';
import { Spector } from 'spectorjs';

export var ABORTED = false;
export function abort(message) {
  ABORTED = true;
  throw message;
}

// Setup canvas and webgl context
export const canvas = document.getElementById('canvas');
const glContext = canvas.getContext('webgl2');
glContext.webgl2 = (typeof WebGL2RenderingContext !== "undefined" && glContext instanceof WebGL2RenderingContext);
if (!glContext.webgl2) {
  console.log('WebGL 2 is not available. Make sure it is available and properly enabled in this browser');
} else {
  console.log('WebGL 2 activated.');
}

// Get a debug context
export const gl = DEBUG ? WebGLDebug.makeDebugContext(glContext, (err, funcName, args) => {
  abort(WebGLDebug.glEnumToString(err) + ' was caused by call to: ' + funcName);
}) : glContext;
gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight);
// ^^^ cant use gl.drawingBufferWidth, gl.drawingBufferHeight here because not matching approp dimensions. forcing the fit instead.

// back canvas for gpu setup and texture passing so visual and texture vals dont conflict
var back_canvas = document.getElementById('back-canvas');
const back_canvas_context = canvas.getContext('webgl2');

// GPU setup
const GPU = require('gpu.js');
export const gpu = new GPU({
    canvas: back_canvas,
    webgl: back_canvas_context,
    mode: gpu
});

// setup gui
export const gui = new DAT.GUI({ width: 500 });
export const params = {
  title: "GPU.JS BIOCROWDS WITH WEBGL2 MARIONETTE VISUAL",
  render_mode: 0,
  pause: false,
};
gui.add(params, 'title');

gui.add(params, 'render_mode', { Simulation: '0',
                                 Just_Marionette_Movement: '-1',
                                 Agent_ids: '1',
                                 First_Pass_of_Weightings_of_Pixel_for_Agent: '2',
                                 Velocity_Weightings_for_Update: '3',
                                 Agent_Positions: '4',
                                 Velocities_of_Agents_at_Positions: '5',
                                 Combination_Agent_ids_Velocity_and_Weights: '6',
                                }).onChange(function(newVal) {

  if (newVal == 0 || newVal == -1) {
    canvas.style.display = "block";
  } else {
    canvas.style.display = "none";
  }
}).listen();

gui.add(params, 'pause');

// initialize statistics widget
const stats = new Stats();
stats.setMode(0); // 0: fps, 1: ms
stats.domElement.style.position = 'absolute';
stats.domElement.style.left = '0px';
stats.domElement.style.top = '0px';
document.body.appendChild(stats.domElement);

// Initialize camera
export const camera = new PerspectiveCamera(120, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
export const cameraControls = new OrbitControls(camera, canvas);
cameraControls.enableDamping = true;
cameraControls.enableZoom = true;
cameraControls.rotateSpeed = 0.3;
cameraControls.zoomSpeed = 1.0;
cameraControls.panSpeed = 2.0;

function setSize(width, height) {
  canvas.width = width;
  canvas.height = height;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

export function resizeCanvas() {
    var displayWidth  = canvas.clientWidth;
    var displayHeight = canvas.clientHeight;

    if (canvas.width  != displayWidth ||
        canvas.height != displayHeight) {
      setSize(displayWidth, displayHeight);
    }
}

setSize(canvas.clientWidth, canvas.clientHeight);
window.addEventListener('resize', () => setSize(canvas.clientWidth, canvas.clientHeight));

if (DEBUG) {
  const spector = new Spector();
  spector.displayUI();
}

// Creates a render loop that is wrapped with camera update and stats logging
export function makeRenderLoop(render) {
  return function tick() {
    cameraControls.update();
    stats.begin();
    render();
    stats.end();
    if (!ABORTED) {
      requestAnimationFrame(tick)
    }
  }
}

// import the main application
require('./main');
