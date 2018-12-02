 import { makeRenderLoop, camera, cameraControls, gui, gl, gpu, canvas, params } from './init';
 import Renderer from './renderer'
 import { mat4, vec4, vec2 } from 'gl-matrix';
 import { canvasToImage } from './utils'
 import Scene from './scene';

const FLT_MAX = Math.pow(3.402823466, 38);
const AGENT_VIS_RADIUS = 5;
const AGENT_CHECK_RAD_SQUARED = 500;

 // import the renderer application
require('./main');


/*********************
*
*
*    SCENE SETUP
*
*
**********************/ 

// create renderer
var render = new Renderer();

 // setup scene
camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);

const scene = new Scene();


/*********************************
*
*
*    GPU PIPELINE FOR UPDATES
*
*
**********************************/ 


/********************************
**** SHADER HELPER FUNCTIONS ****
********************************/

function coneDepth(position, cone_center) {
    // cone math --> dist to center of cone
    // we have height to radius ratio
    // find height of cone at this radius
    // this is depth to be returned

    var distance = sqrt(  (position[0] - cone_center[0]) * (position[0] - cone_center[0])
                        + (position[1] - cone_center[1]) * (position[1] - cone_center[1]));

    // for this, all cones will have height to radius ratio of h: 2, r: 1. so c = h / r = 2.
    const c = 2.0;

    return distance * c;
}
const coneDepth_options = {
  paramTypes: { position: 'Array(2)', cone_center: 'Array(2)' },
  returnType: 'Number'
};
gpu.addFunction(coneDepth, coneDepth_options);

function computeMarkerWeight(agent_position, marker_position, target_position) {
  var agent_to_marker_x = agent_position[0] - marker_position[0]
  var agent_to_marker_y = agent_position[1] - marker_position[1];

  var agent_to_target_x = agent_position[0] - target_position[0];
  var agent_to_target_y = agent_position[1] - target_position[1];

  var m_distance = sqrt( agent_to_marker_x * agent_to_marker_x + agent_to_marker_y * agent_to_marker_y);
  var g_distance = sqrt( agent_to_target_x * agent_to_target_x + agent_to_target_y * agent_to_target_y);

  // cos_theta = a dot b / (len(a) * len(b))
  var cos_theta = (agent_to_marker_x * agent_to_target_x + agent_to_marker_y * agent_to_target_y) / (m_distance * g_distance)

  return (1 + cos_theta) / (1 + m_distance);
}
const computeMarkerWeight_options = {
  paramTypes: { agent_position: 'Array(2)', marker_position: 'Array(2)', target_position: 'Array(2)' },
  returnType: 'Number'
}
gpu.addFunction(computeMarkerWeight, computeMarkerWeight_options);


/*********************************
****** GPU KERNEL METHODS ********
**********************************/

const copyMemoryBackToFirstBuffer = gpu.createKernel(function(updated_positions) {
  const pixel = updated_positions[this.thread.x][this.thread.y];
  this.color(pixel[0], pixel[1], 0, 1);
})
.setOutput([scene.numParticles, 1])
// .setOutputToTexture(true);
.setGraphical(true);

const initialPositionsToImage = gpu.createKernel(function(positions) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.x;
  const which_vec2 = this.thread.y;

  return positions[which_vec2][vec2_element] / this.constants.screen_x;
})
.setConstants({ screen_x: canvas.clientWidth, screen_y: canvas.clientHeight })
.setOutput([scene.numParticles, 2])
.setOutputToTexture(true);

const initialTargetsToImage = gpu.createKernel(function(targets) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.x;
  const which_vec2 = this.thread.y;

  return targets[which_vec2][vec2_element] / this.constants.screen_x;
})
.setConstants({ screen_x: canvas.clientWidth, screen_y: canvas.clientHeight })
.setOutput([scene.numParticles, 2])
.setOutputToTexture(true);


const initialColorsToImage = gpu.createKernel(function(colors) {
  // an array of vec3s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec3_element = this.thread.x;
  const which_vec3 = this.thread.y;

  return colors[which_vec3][vec3_element];
})
.setConstants({ screen_x: canvas.clientWidth, screen_y: canvas.clientHeight })
.setOutput([scene.numParticles, 3])
.setOutputToTexture(true);

const positionsToVoronoi = gpu.createKernel(function(positions_texture, colors_texture) {
  // NOTE_ MUST ALWAYS HAVE AT LEAST TWO AGENTS IN THE SCENE
  var closest_max_depth = this.constants.flt_max;
  var closest_index = -1;
  var second_closest_max_depth = this.constants.flt_max;
  var second_closest_index = -1;
  var red = 0;
  var green = 0;
  var blue = 0;

  var identifying_pixel_loc = 0;

  // find which depths and vertices this pixel is associated with
  for (var i = 0; i < this.constants.length; ++i) {
    const pos_x = positions_texture[0][i] * this.constants.screen_x;
    const pos_y = positions_texture[1][i] * this.constants.screen_y;

    if (abs(this.thread.x - pos_x) < this.constants.agent_vis_rad
      && abs(this.thread.y - pos_y) < this.constants.agent_vis_rad) {

      red = 0;
      green = 0;
      blue = 0;
      identifying_pixel_loc = 1;
      i = this.constants.length;
    } else {
      var depth = coneDepth(this.vec2(this.thread.x, this.thread.y),
                            this.vec2(pos_x, pos_y));

      if (depth < closest_max_depth) {
        second_closest_max_depth = closest_max_depth;
        closest_max_depth = depth;
        second_closest_index = closest_index;
        closest_index = i;
      } else if (depth < second_closest_max_depth) {
        second_closest_max_depth = depth;
        second_closest_index = i;
      }
    }
  }

  // color based on distances
  var closest_x_diff = abs(this.thread.x - positions_texture[0][closest_index] * this.constants.screen_x);
  var closest_y_diff = abs(this.thread.y - positions_texture[1][closest_index] * this.constants.screen_y);
  var second_closest_x_diff = abs(this.thread.x - positions_texture[0][second_closest_index] * this.constants.screen_x);
  var second_closest_y_diff = abs(this.thread.y - positions_texture[1][second_closest_index] * this.constants.screen_y);

  var closest_dist2 = closest_x_diff * closest_x_diff + closest_y_diff + closest_y_diff;
  var second_closest_dist2 = second_closest_x_diff * second_closest_x_diff + second_closest_y_diff * second_closest_y_diff;

  if (identifying_pixel_loc != 1) {
    if (closest_dist2 < this.constants.agent_check_rad2 && second_closest_dist2 < this.constants.agent_check_rad2) {
      // if this pixel is within the check radius of the two closest particles, color white
      // white bc color choice for particle is done through Math.random which ranges from [0, 1)
      // so will never actually create white allowing it to act as a flag.
      red = 1;
      green = 1;
      blue = 1;
    } else {
      red = colors_texture[0][closest_index];
      green = colors_texture[1][closest_index];
      blue = colors_texture[2][closest_index];
    }
  }
  
  this.color(red, green, blue, 1);
})
.setConstants({ length: scene.numParticles, screen_x : canvas.clientWidth, screen_y: canvas.clientHeight, flt_max: FLT_MAX, agent_vis_rad: AGENT_VIS_RADIUS, agent_check_rad2: AGENT_CHECK_RAD_SQUARED})
.setOutput([canvas.clientWidth, canvas.clientHeight])
.setGraphical(true)

const velocityUpdate = gpu.createKernel(function(old_positions, voronoi, colors) {
  // calc weight for each pixel in relation to old positions
  // already have ^^ this technically through voronoi? need to change though process for voronoi with ids?? maybe with texture output instead

  // follow v = sum of vi's where each vi is the mi distance * weight of mi in relation to target / ave 


  const output_x = 0;
  const output_y = 0;
})
.setConstants({ length: scene.numParticles, screen_x : canvas.clientWidth, screen_y: canvas.clientHeight, flt_max: FLT_MAX, agent_vis_rad: AGENT_VIS_RADIUS })
.setOutput([scene.numParticles, 2])
// .setOutputToTexture(true);
.setGraphical(true);

const positionsUpdate = gpu.createKernel(function(old_positions, velocities_image) {
  // TODO
  const pixel = old_positions[this.thread.x][this.thread.y];
  this.color(pixel[0], pixel[1], 0, 1);


  // new p = old p + velo
})
.setOutput([scene.numParticles, 1])
// .setOutputToTexture(true)
.setGraphical(true);

/********************
*
*
*    RUN THE SIM
*
*
*********************/


/*************************
****** INIT SETUP ********
**************************/

// var positions_tex1 = initialPositionsToImage(scene.particle_positions);
// document.getElementsByTagName('body')[0].appendChild(positions_tex1.webGl.canvas);
// document.getElementsByTagName('body')[0].appendChild(initialPositionsToImage.getCanvas()); 
// var voronoi_tex = positionsToVoronoi(positions_tex1, scene.particle_colors);
// document.getElementsByTagName('body')[0].appendChild(voronoi_tex.webGl.canvas);
// var velocity_tex = velocityUpdate(positions_tex1, voronoi_tex, scene.particle_colors);
// var positions_tex2 = positionsUpdate(positions_tex1, velocity_tex);
// NOTE: IF SCREEN SIZE CHANGES MIGHT HAVE TO HANDLE BUFFER CHANGE AS WELL BETWEEN THESE CASTINGS - MAKE ADJUSTMENT BY RESTARTING SIM SO NO IMPROPER PIXEL CALCS


var initialPositions = initialPositionsToImage(scene.particle_positions);
var targets = initialTargetsToImage(scene.particle_targets);
var colors = initialColorsToImage(scene.particle_colors);
console.log(initialPositions);
positionsToVoronoi(initialPositions, colors);
document.getElementsByTagName('body')[0].appendChild(positionsToVoronoi.getCanvas()); //--------------------------
// document.getElementsByTagName('body')[0].appendChild(voronoi_tex.webGl.canvas);
// velocityUpdate(positions_tex1, voronoi_tex, scene.particle_colors).getCanvas();
// positionsUpdate(positions_tex1, velocity_tex).getCanvas();


/*************************
****** RUN ********
**************************/

makeRenderLoop(
  function() {
    scene.update();
    if (params.render_mode == 0) {
      // render.update();
    } else {
      // buffer swap
      // positions_tex1 = copyMemoryBackToFirstBuffer(positions_tex2).getCanvas();

      // voronoi_tex = positionsToVoronoi(positions_tex1, scene.particle_colors).getCanvas();
      // velocity_tex = velocityUpdate(positions_tex1, voronoi_tex, scene.particle_colors).getCanvas();
      // positions_tex2 = positionsUpdate(positions_tex1, velocity_tex).getCanvas();
      // // TODO LATER: use this tex2 as input to renderer for actual position locations of marionette

      // document.getElementsByTagName('body')[0].appendChild(voronoi_tex);
    }
  }
)();