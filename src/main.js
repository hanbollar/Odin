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
  actualVoronoiWeightingPerPixel,
  agentIndexCheck,
  agentIndexVisCheck,
  allColoringVisual,
  colorByVoronoi,
  initialVec3toVec2KernelPassing,
  initialColorsToImage,
  pixelWeights,
  positionsUpdate,
  //positionsUpdate_superKernel,
  positionsToScreenVisual,
  positionsToViableArray,
  summedWeightPerAgent,
  renderCheck,
  renderCheckAbs,
  velocitiesToViableArray,
  velocityAtPositionsVisual,
  velToScreenVisual
} from './kernelFunctions';
import {
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  NUM_PARTICLES
} from './utils';

/*************************
****** INIT SETUP ********
**************************/

var render = new Renderer();
const scene = new Scene();
camera.position.set(0, 10, 0);

var pos_1 = initialVec3toVec2KernelPassing(scene.particle_positions);
var pos_2;
var targets = initialVec3toVec2KernelPassing(scene.particle_targets);
var colors = initialColorsToImage(scene.particle_colors);
var iter = 0;
var iter_limit = 10;
var prevtime = 0;
var currTime = 0;
var voronoi_red = colorByVoronoi(pos_1, colors, targets, 0);
var voronoi_weighting_green_x;
var voronoi_weighting_green_y;
var pixel_weightings;
var summed_weightings = [NUM_PARTICLES];
var summed_directionalWeightings_x = [NUM_PARTICLES];
var summed_directionalWeightings_y = [NUM_PARTICLES];

/*************************
********** RUN ***********
**************************/

makeRenderLoop(
  function() {
    if (params.pause) {
      return;
    }
    if (params.reset) {
      params.reset = false;
      iter = 0;
      prevtime = 0;
      currTime = 0;
      pos_1 = initialVec3toVec2KernelPassing(scene.particle_positions);
      targets = initialVec3toVec2KernelPassing(scene.particle_targets);
      colors = initialColorsToImage(scene.particle_colors);
      voronoi_red = colorByVoronoi(pos_1, colors, targets, 0);
    }

    if (DEBUG && iter < iter_limit) { currTime = Date.now(); console.log(prevtime - currTime); prevtime = currTime; console.log('iter:' + iter);}
    if (DEBUG && iter < iter_limit) { currTime = Date.now(); prevtime = currTime; console.log('render update');  }

    // only need one color because hash function we're using has all color channels be the same value.
    voronoi_red = colorByVoronoi(pos_1,colors, targets, 0);
    pixel_weightings = pixelWeights(pos_1, voronoi_red, colors, targets);
    summed_weightings = summedWeightPerAgent(pixel_weightings, pos_1, voronoi_red, colors, targets);
    voronoi_weighting_green_x = actualVoronoiWeightingPerPixel(pos_1, pixel_weightings, summed_weightings, voronoi_red, colors, targets, 0);
    voronoi_weighting_green_y = actualVoronoiWeightingPerPixel(pos_1, pixel_weightings, summed_weightings, voronoi_red, colors, targets, 1);
    summed_directionalWeightings_x = summedWeightPerAgent(voronoi_weighting_green_x, pos_1, voronoi_red, colors, targets);
    summed_directionalWeightings_y = summedWeightPerAgent(voronoi_weighting_green_y, pos_1, voronoi_red, colors, targets);

    if (params.render_mode != -1) {
      pos_2 = positionsUpdate(pos_1, summed_directionalWeightings_x, summed_directionalWeightings_y);
    } // otherwise: dont update positions

    if (params.render_mode > 0) {
      if (params.render_mode == 1) {
        // color based on which pixels are associated with which agents
        renderCheck(voronoi_red, 0);
        document.getElementsByTagName('body')[0].appendChild(renderCheck.getCanvas());
      } else if (params.render_mode == 2) {
        // weightings based on distance to agent and orientation in relation to target check
        renderCheck(pixel_weightings, 2);
        document.getElementsByTagName('body')[0].appendChild(renderCheck.getCanvas());
      } else if (params.render_mode == 3) {
        // color based on velocity weights
        renderCheckAbs(voronoi_weighting_green_x, voronoi_weighting_green_y);
        document.getElementsByTagName('body')[0].appendChild(renderCheckAbs.getCanvas());
      } else if (params.render_mode == 4) {
        // color based on pure positions
        positionsToScreenVisual(pos_1);
        document.getElementsByTagName('body')[0].appendChild(positionsToScreenVisual.getCanvas());
      } else if (params.render_mode == 5) {
        // color based on update velo of pure positions
        velToScreenVisual(pos_1, summed_directionalWeightings_x, summed_directionalWeightings_y);
        document.getElementsByTagName('body')[0].appendChild(velToScreenVisual.getCanvas());
      } else if (params.render_mode == 6) {
        // full combination
        allColoringVisual(voronoi_red, voronoi_weighting_green_x, pos_1);
        document.getElementsByTagName('body')[0].appendChild(allColoringVisual.getCanvas());
      }
    }
    
    // send stuff to webgl2 pipeline
    // if (not on first frame... then render...)
    // render...(outputToRender_pos1, outputToRender_pos2);
    render.updateAgents(positionsToViableArray(pos_2), velocitiesToViableArray(pos_2, pos_1));
    render.update();

    // now pos_2 is the starting buffer - dont want to copy over... just switch out target reference variable.
    // swap buffers. (pos_2 will be overwritten on output so dont need to change it).
    pos_1 = pos_2;

    ++iter;
    if (DEBUG && iter < iter_limit) { currTime = Date.now(); prevtime = currTime; console.log('end: render update');  }
  }
)();