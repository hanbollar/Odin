 import { makeRenderLoop, camera, cameraControls, gui, gl, canvas, params } from './init';
 import Renderer from './renderer'
 import { mat4, vec4, vec2 } from 'gl-matrix';
 import { canvasToImage } from './utils'
 import Scene from './scene';

 // import the renderer application
require('./main');

/*
*
*
*    GPU PIPELINE FOR UPDATES
*
*
*/ 


// var imageKernel = gpu.createKernel(function(image) {
//   const pixel = image[this.thread.y][this.thread.x];
//   this.color(pixel[0], pixel[1], pixel[2], pixel[3]);
// }, {
//   output : [276, 183],
//   graphical: true
// });

const gpu_pToImage = new GPU({
    canvas: canvas,
    webgl: gl,
    mode: gpu
});
export const positionsToImage = gpu_pToImage.createKernel(function(prevCalculatedPositions, dimX, dimY, dimZ, numPositions) {
  // TODO: make this work for x and y dimensions and not just linear in x direction
  var on_index = this.thread.x;
  if (this.thread.x < numPositions) {
    this.color(prevCalculatedPositions[on_index][0] / dimX,
               prevCalculatedPositions[on_index][1] / dimY,
               prevCalculatedPositions[on_index][2] / dimZ, 1);
  }
})
.setOutput([canvas.clientWidth, canvas.clientHeight])
.setGraphical(true);

const gpu_pUpdate = new GPU({
    canvas: canvas,
    webgl: gl,
    mode: gpu
});
export const positionsUpdate = gpu_pUpdate.createKernel(function(inputImage, dimX, dimY, dimZ, numPositions) {
  // TODO: make this work for x and y dimensions and not just linear in x direction
  var on_index = this.thread.x;
  if (this.thread.x < numPositions) {
    this.color(inputImage[on_index][0] + 0.1,
               inputImage[on_index][1] + 0.1,
               inputImage[on_index][2] + 0.1, 1);
  }
})
.setOutput([canvas.clientWidth, canvas.clientHeight])
.setGraphical(true);

const gpu = new GPU({
    canvas: canvas,
    webgl: gl,
    mode: gpu
});

export const shadeScreen = gpu.createKernel(function(widthDim, heightDim, on_mode, inputImage) {
  var xLoc = this.thread.x / widthDim;
  var yLoc = this.thread.y / heightDim;

  var red_channel = 0;
  var green_channel = 0;
  var blue_channel = 0;
  var alpha_channel = 1;

  var debug_view = 0;
  var noise_demo = 1;
  var image_test = 2;

  // like a fragment shader kernel - default test

  if (on_mode == 0) {
    // shader debug view
    red_channel = this.thread.x/widthDim;
    green_channel = this.thread.y/heightDim;
  } else if (on_mode == noise_demo){
    // noise function demo
    red_channel = random(this.vec2(xLoc, yLoc));
  } else if (on_mode == image_test) {
    // Input type not supported (WebGL): [object HTMLCanvasElement]
    // red_channel = inputImage[this.thread.x].x;
    // green_channel = inputImage[this.thread.x].y;
    // blue_channel = inputImage[this.thread.x].z;
  } else {
    blue_channel = 1;
  }

  this.color(red_channel, green_channel, blue_channel, alpha_channel);
})
.setOutput([canvas.clientWidth, canvas.clientHeight])
.setGraphical(true);

shadeScreen.addNativeFunction('random', `highp float random(vec2 co)
{
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt= dot(co.xy ,vec2(a,b));
    highp float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}`);


/*
*
*
*    SCENE AND RENDER SETUP FOR SCREEN REFRESHING
*
*
*/

// create renderer
var render = new Renderer();

 // setup scene
camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
const scene = new Scene();


// shadeScreen(canvas.width, canvas.height, on_mode, canvasToImage(positionsToImage.getCanvas()));
//first iteration (cpu -> gpu)
// positionsToImage(scene.particles, canvas.width, canvas.height, 1, scene._numParticles);
// shadeScreen(canvas.width, canvas.height, on_mode, canvasToImage(positionsToImage.getCanvas()));
// base render
//document.getElementsByTagName('body')[0].appendChild(shadeScreen.getCanvas());

function rendering() {
  positionsUpdate(scene.particles, canvas.width, canvas.height, 1, scene._numParticles);
  shadeScreen(canvas.width, canvas.height, params.render_mode, positionsUpdate.getCanvas());

  //update render for each sim iteration loop
  document.getElementsByTagName('body')[0].appendChild(shadeScreen.getCanvas());
}

makeRenderLoop(
  function() {
    scene.update();
    render.update();
  }
)();