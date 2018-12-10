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
  agentIndexCheck,
  agentIndexVisCheck,
  allColoringVisual,
  colorByVoronoi,
  colorByVoronoiWeighting,
  initialVec3toVec2KernelPassing,
  initialColorsToImage,
  pixelWeights,
  positionsUpdate,
  positionsUpdate_superKernel,
  positionsToScreenVisual,
  positionsToViableArray,
  summedWeightPerAgent,
  renderCheck,
  velocitiesToViableArray,
  velocityAtPositionsVisual,
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
var voronoi_weighting_green;
var outputToRender_pos = [NUM_PARTICLES * 3];
var outputToRender_vel = [NUM_PARTICLES * 3];
var pixel_weightings;
var summed_weightings = [NUM_PARTICLES];

console.log('positions');
console.log(pos_1);

/*************************
********** RUN ***********
**************************/

makeRenderLoop(
  function() {
    if (DEBUG && iter < iter_limit) { currTime = Date.now(); console.log(prevtime - currTime); prevtime = currTime; console.log('iter:' + iter);}
    if (DEBUG && iter < iter_limit) { currTime = Date.now(); prevtime = currTime; console.log('render update');  }

    // only need one color because hash function we're using has all color channels be the same value.
    voronoi_red = colorByVoronoi(pos_1, colors, targets, 0);
    pixel_weightings = pixelWeights(pos_1, voronoi_red, colors, targets);
    summed_weightings = summedWeightPerAgent(pixel_weightings, pos_1, voronoi_red, colors, targets);
    voronoi_weighting_green = colorByVoronoiWeighting(pos_1,
                                                      pixel_weightings,
                                                      summed_weightings,
                                                      voronoi_red,
                                                      colors,
                                                      targets);
    console.log(pixel_weightings);
    if (DEBUG && params.render_mode == 1) {
      // color based on which pixels are associated with which agents
      renderCheck(voronoi_red, 0);
      document.getElementsByTagName('body')[0].appendChild(renderCheck.getCanvas());
    } else if (DEBUG && params.render_mode == 2) {
      // weightings based on distance to agent and orientation in relation to target check
      renderCheck(pixel_weightings, 0);
      document.getElementsByTagName('body')[0].appendChild(renderCheck.getCanvas());
    } else if (DEBUG && params.render_mode == 3) {
      // color based on velocity weights
      renderCheck(voronoi_weighting_green, 1);
      document.getElementsByTagName('body')[0].appendChild(renderCheck.getCanvas());
    } else if (DEBUG && params.render_mode == 4) {
      // color based on pure positions
      positionsToScreenVisual(pos_1);
      document.getElementsByTagName('body')[0].appendChild(positionsToScreenVisual.getCanvas());
    } else if (DEBUG && params.render_mode == 5) {
      // full combination
      allColoringVisual(voronoi_red, voronoi_weighting_green, pos_1);
      document.getElementsByTagName('body')[0].appendChild(allColoringVisual.getCanvas());
    } else if (DEBUG && params.render_mode == 6) {
      // color positions based on update velocity
      var temp = velocitiesToViableArray(pos_2, pos_1);
      velocityAtPositionsVisual(temp, pos_1);
      document.getElementsByTagName('body')[0].appendChild(velocityAtPositionsVisual.getCanvas());
    } else if (DEBUG && params.render_mode == 7) {
      // color to voronoi check
      agentIndexVisCheck(voronoi_red, colors);
      document.getElementsByTagName('body')[0].appendChild(agentIndexVisCheck.getCanvas());
    }
    pos_2 = pos_1;//positionsUpdate_superKernel(voronoi_red, voronoi_weighting_green, pos_1, colors, targets);

    if (!DEBUG || params.render_mode != 1) {
      outputToRender_pos = positionsToViableArray(pos_2);
      outputToRender_vel = velocitiesToViableArray(pos_2, pos_1);

      // send stuff to webgl2 pipeline
      // if (not on first frame... then render...)
      // render...(outputToRender_pos1, outputToRender_pos2);
      //render.update();
    }

    // now pos_2 is the starting buffer - dont want to copy over... just switch out target reference variable.
    // swap buffers. (pos_2 will be overwritten on output so dont need to change it).
    console.log('value transfer');
    pos_1 = pos_2;
    console.log('done');

    ++iter;
    console.log(iter);
    if (DEBUG && iter < iter_limit) { currTime = Date.now(); prevtime = currTime; console.log('end: render update');  }
  }
)();