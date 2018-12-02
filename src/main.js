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
*    SCENE SETUP
*
*
*/ 

// create renderer
var render = new Renderer();

 // setup scene
camera.position.set(32, 10, 32);
cameraControls.target.set(0, 0, 0);

const scene = new Scene();


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
export const positionsToImage = gpu_pToImage.createKernel(function(positions, colors) {
  // depth buffer calculations based on cone
  var max_depth = 1000000;
  var red = 0;
  var green = 0;
  var blue = 0;
  for (var i = 0; i < this.constants.length; ++i) {
    var depth = coneDepth(this.vec2(this.thread.x, this.thread.y),
                          this.vec2(positions[i][0], positions[i][1]));
    // distance
    if (depth < max_depth) {
      red = colors[i][0];
      green = colors[i][1];
      blue = colors[i][2];
      max_depth = depth;
    }
  }
  // this.color(1, 0, 1, 1);
  this.color(red, green, blue, 1);
})
.setConstants({ length: scene.numParticles })
.setOutput([canvas.clientWidth, canvas.clientHeight])
.setGraphical(true);

positionsToImage.addNativeFunction('coneDepth', `highp float coneDepth(vec2 position, vec2 cone_center)
{
    // cone math
    // dist to center of cone
    // we have height to radius ratio
    // find height of cone at this radius
    // this is depth to be returned

    highp float distance = sqrt(  (position.x - cone_center.x) * (position.x - cone_center.x)
                                + (position.y - cone_center.y) * (position.y - cone_center.y));

    // for this, all cones will have height to radius ratio of h: 2, r: 1. so c = h / r = 2.
    //highp float c = 2.0;

    //return distance * c;

    return distance;
}`);

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

    red_channel = inputImage[this.thread.x].x;
    green_channel = inputImage[this.thread.x].y;
    blue_channel = inputImage[this.thread.x].z;

  this.color(red_channel, green_channel, blue_channel, alpha_channel);
})
.setOutput([canvas.clientWidth, canvas.clientHeight])
.setGraphical(true);


/*
*
*
*    RENDER SETUP FOR SCREEN REFRESHING
*
*
*/


// shadeScreen(canvas.width, canvas.height, on_mode, canvasToImage(positionsToImage.getCanvas()));
//first iteration (cpu -> gpu)
//positionsToImage(scene.particle_positions, scene.particle_colors, scene._numParticles);
// shadeScreen(canvas.width, canvas.height, on_mode, canvasToImage(positionsToImage.getCanvas()));
// base render
//document.getElementsByTagName('body')[0].appendChild(shadeScreen.getCanvas());

makeRenderLoop(
  function() {
    scene.update();
    if (params.render_mode == 0) {
      render.update();
    } else {
      //positionsUpdate(scene.particles, canvas.width, canvas.height, 1, scene._numParticles);
      //shadeScreen(canvas.width, canvas.height, params.render_mode, positionsUpdate.getCanvas());
      //document.getElementsByTagName('body')[0].appendChild(shadeScreen.getCanvas());
      
      positionsToImage(scene.particle_positions, scene.particle_colors);
      document.getElementsByTagName('body')[0].appendChild(positionsToImage.getCanvas());
    }
  }
)();