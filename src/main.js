import Renderer from './renderer'
import Scene from './scene';
import {
  camera, 
  cameraControls,
  canvas,
  DEBUG,
  gui,
  gl,
  gpu,
  makeRenderLoop,
  params
} from './init';
import {
  colorByVoronoi,
  initialVec3toVec2KernelPassing,
  initialColorsToImage,
  positionsUpdate,
  positionsUpdate_superKernel,
  positionsToViableArray,
  renderCheck,
  velocityUpdate
} from './kernelFunctions';
import {
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  NUM_PARTICLES
} from './utils';

/*************************
****** INIT SETUP ********
**************************/

// create renderer
var render = new Renderer();

 // setup scene
camera.position.set(32, 10, 32);
cameraControls.target.set(0, 0, 0);

const scene = new Scene();

var pos_1 = initialVec3toVec2KernelPassing(scene.particle_positions);
var pos_2;
var targets = initialVec3toVec2KernelPassing(scene.particle_targets);
var colors = initialColorsToImage(scene.particle_colors);
var iter = 0;
var iter_limit = 10;
var prevtime = 0;
var currTime = 0;
var voronoi_red = colorByVoronoi(pos_1, colors, targets, 0);
var outputToRender_pos1 = [NUM_PARTICLES * 3];
var outputToRender_pos2 = [NUM_PARTICLES * 3];


/*************************
********** RUN ***********
**************************/

makeRenderLoop(
  function() {
    console.log('here1');
    if (DEBUG && iter < iter_limit) { currTime = Date.now(); console.log(prevtime - currTime); prevtime = currTime; console.log('iter:' + iter);}
    if (DEBUG && iter < iter_limit) { currTime = Date.now(); prevtime = currTime; console.log('render update');  }

    // only need one color because hash function we're using has all color channels be the same value.
    console.log('here2');
    voronoi_red = colorByVoronoi(pos_1, colors, targets, 0);
    console.log('here3');
    if (DEBUG && params.render_mode == 1) {
      renderCheck(voronoi_red);
      document.getElementsByTagName('body')[0].appendChild(renderCheck.getCanvas());
    }
    pos_2 = positionsUpdate_superKernel(voronoi_red, pos_1, colors, targets);

    if (!DEBUG || params.render_mode != 1) {
      outputToRender_pos2 = positionsToViableArray(pos_2);

      // send stuff to webgl2 pipeline
      // if (not on first frame... then render...)
      // render...(outputToRender_pos1, outputToRender_pos2);
      //render.update();
    }

    // now pos_2 is the starting buffer - dont want to copy over... just switch out target reference variable.
    // swap buffers. (pos_2 will be overwritten on output so dont need to change it).
    pos_1 = pos_2;
    outputToRender_pos1 = outputToRender_pos2;

    if (DEBUG && iter < iter_limit) { currTime = Date.now(); prevtime = currTime; console.log('end: render update');  }
  }
)();