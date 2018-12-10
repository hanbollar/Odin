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

// setup gui
export const gui = new DAT.GUI();
export const params = {
  title: "GUI",
  render_mode: 0,
};
gui.add(params, 'title');
gui.add(params, 'render_mode', 0, 4).step(1).onChange(function(newVal) {
    params.render_mode = newVal;
});

// GPU setup
const GPU = require('gpu.js');
export const gpu = new GPU({
    canvas: canvas,
    webgl: gl,
    mode: gpu
});

// initialize statistics widget
const stats = new Stats();
stats.setMode(1); // 0: fps, 1: ms
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
