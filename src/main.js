 import { makeRenderLoop, camera, cameraControls, gui, gl, gpu, canvas, params } from './init';
 import Renderer from './renderer'
 import { mat4, vec4, vec2 } from 'gl-matrix';
 import { draw2dImage, resizeSpecificCanvas} from './utils'
 import Scene from './scene';

const FLT_MAX = Math.pow(3.402823466, 38);
const AGENT_VIS_RADIUS = 5;
const PIXEL_BUFFER_RAD = 0.05;

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

function coneDepth(p_x, p_y, cone_x, cone_y) {
    // cone math --> dist to center of cone
    // we have height to radius ratio
    // find height of cone at this radius
    // this is depth to be returned

    var distance = sqrt((p_x - cone_x) * (p_x - cone_x) + (p_y - cone_y) * (p_y - cone_y));

    // for this, all cones will have height to radius ratio of h: 2, r: 1. so c = h / r = 2.
    const c = 2.0;

    return distance * c;
}
const coneDepth_options = {
  paramTypes: { p_x: 'Number', p_y: 'Number', cone_x: 'Number', cone_y: 'Number' },
  returnType: 'Number'
};
gpu.addFunction(coneDepth, coneDepth_options);

function computeMarkerWeight(agent_x, agent_y, marker_x, marker_y, target_x, target_y) {
  var agent_to_marker_x = agent_x - marker_x;
  var agent_to_marker_y = agent_y - marker_y;

  var agent_to_target_x = agent_x - target_x;
  var agent_to_target_y = agent_y - target_y;

  var m_distance = sqrt( agent_to_marker_x * agent_to_marker_x + agent_to_marker_y * agent_to_marker_y);
  var g_distance = sqrt( agent_to_target_x * agent_to_target_x + agent_to_target_y * agent_to_target_y);

  // cos_theta = a dot b / (len(a) * len(b))
  var cos_theta = (agent_to_marker_x * agent_to_target_x + agent_to_marker_y * agent_to_target_y) / (m_distance * g_distance)

  return (1 + cos_theta) / (1 + m_distance);
}
const computeMarkerWeight_options = {
  paramTypes: { agent_x: 'Number', agent_y: 'Number', marker_x: 'Number', marker_y: 'Number', target_x: 'Number', target_y: 'Number'},
  returnType: 'Number'
}
gpu.addFunction(computeMarkerWeight, computeMarkerWeight_options);

/*********************************
****** GPU KERNEL METHODS ********
**********************************/

const initialPositionsToImage = gpu.createKernel(function(positions) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.y;
  const which_vec2 = this.thread.x;

  // if on y element, divide by height : divide by width
  const div_factor = (1 - vec2_element) * this.constants.screen_x + vec2_element * this.constants.screen_y;
  return positions[which_vec2][vec2_element] / div_factor;
})
.setConstants({ screen_x: canvas.clientWidth, screen_y: canvas.clientHeight })
.setOutput([scene.numParticles, 2])
// .setOutputToTexture(true);

const initialTargetsToImage = gpu.createKernel(function(targets) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.x;
  const which_vec2 = this.thread.y;

  // if on y element, divide by height : divide by width
  const div_factor = (1 - vec2_element) * this.constants.screen_x + vec2_element * this.constants.screen_y;
  return targets[which_vec2][vec2_element] / div_factor;
})
.setConstants({ screen_x: canvas.clientWidth, screen_y: canvas.clientHeight })
.setOutput([scene.numParticles, 2])
// .setOutputToTexture(true);

const initialColorsToImage = gpu.createKernel(function(colors) {
  // an array of vec3s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec3_element = this.thread.x;
  const which_vec3 = this.thread.y;

  return colors[which_vec3][vec3_element];
})
.setConstants({ screen_x: canvas.clientWidth, screen_y: canvas.clientHeight })
.setOutput([scene.numParticles, 3])
// .setOutputToTexture(true);

const colorByVoronoi = gpu.createKernel(function(positions_texture, colors_texture, targets_texture) {
  // note: must always have at least two agents in the scene otherwise this will error.
  var closest_max_depth = this.constants.flt_max;
  var closest_index = -1;
  var second_closest_max_depth = this.constants.flt_max;
  var second_closest_index = -1;

  // find which depths and vertices this pixel is associated with
  var depth = 0;
  var pos_x = 0;
  var pos_y = 0;
  for (var i = 0; i < this.constants.length; ++i) {
    pos_x = positions_texture[0][i] * this.constants.screen_x;
    pos_y = positions_texture[1][i] * this.constants.screen_y;

    depth = coneDepth(this.thread.x, this.thread.y, pos_x, pos_y);

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

  // color based on distances
  var closest_x_diff = abs(this.thread.x - positions_texture[0][closest_index] * this.constants.screen_x);
  var closest_y_diff = abs(this.thread.y - positions_texture[1][closest_index] * this.constants.screen_y);
  var second_closest_x_diff = abs(this.thread.x - positions_texture[0][second_closest_index] * this.constants.screen_x);
  var second_closest_y_diff = abs(this.thread.y - positions_texture[1][second_closest_index] * this.constants.screen_y);

  var closest_dist2 = closest_x_diff * closest_x_diff + closest_y_diff * closest_y_diff;
  var second_closest_dist2 = second_closest_x_diff * second_closest_x_diff + second_closest_y_diff * second_closest_y_diff;

  var dist = closest_dist2 + second_closest_dist2;

  if (abs(closest_dist2 / dist - 0.5) < this.constants.pixel_rad) {
    // for each pixel, if there are at least two different colors within a particular distance to it, color white
    // so that we have a buffer distance.
    // white bc color choice for particle is done through Math.random which ranges from [0, 1)
    // so will never actually create white allowing it to act as a flag.

    this.color(1, 1, 1, 1);
  } else {
    this.color(colors_texture[0][closest_index], colors_texture[1][closest_index], 0, 1);
  }
})
.setConstants({ length: scene.numParticles, screen_x : canvas.clientWidth, screen_y: canvas.clientHeight, flt_max: FLT_MAX, agent_vis_rad: AGENT_VIS_RADIUS, pixel_rad: PIXEL_BUFFER_RAD})
.setOutput([canvas.clientWidth, canvas.clientHeight])
.setGraphical(true)

var importTexture = gpu.createKernel(function (input) {
  return input[((this.constants.screen_y - this.thread.y) * this.constants.screen_x * 4) + (this.thread.x * 4) + this.thread.z] / 255.0;
})
.setConstants({ screen_x: canvas.clientWidth, screen_y: canvas.clientHeight})
.setOutputToTexture(true)
.setOutput([canvas.clientWidth, canvas.clientHeight, 4]);

const velocityUpdate = gpu.createKernel(function(old_positions, voronoi_texture, colors, target) {
  // calc weight for each pixel in relation to old positions
  // already have ^^ this technically through voronoi? need to change though process for voronoi with ids?? maybe with texture output instead

  // follow v = sum of vi's where each vi is the mi distance * weight of mi in relation to target / ave 
  
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.x;
  const which_vec2 = this.thread.y;

  // for each position, check surrounding pixels in agent_vis_radius
  const on_pos_index = which_vec2;
  const on_col_red = colors[on_pos_index];
  const on_col_green = colors[on_pos_index];
  const on_col_blue = colors[on_pos_index];

  // voronoi texture position values are in 0-1 range.
  // want velocity to also be in this output range.

  return 0.01; // zero velocity for now just checking pipeline update
})
.setConstants({ length: scene.numParticles, screen_x : canvas.clientWidth, screen_y: canvas.clientHeight })
.setOutput([scene.numParticles, 2])
//.setOutputToTexture(true);

const positionsUpdate = gpu.createKernel(function(old_positions, velocities) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.x;
  const which_vec2 = this.thread.y;

  // new p = old p + velo
  return old_positions[which_vec2][vec2_element] + velocities[which_vec2][vec2_element];
})
.setOutput([scene.numParticles, 2])
//.setOutputToTexture(true)

const positionsUpdate_superKernel = gpu.combineKernels(velocityUpdate, positionsUpdate, function(voronoi_texture, old_positions, colors, target) {
  return positionsUpdate(old_positions, velocityUpdate(old_positions, voronoi_texture, colors, target));
});

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

var canvas2d = document.getElementById('canvas2d', {preserveDrawingBuffer: true});
var context2d = canvas2d.getContext('2d');
canvas2d = resizeSpecificCanvas(canvas2d);

var pos_1 = initialPositionsToImage(scene.particle_positions);
var pos_2;
var data;
var voronoi_texture;
var targets = initialTargetsToImage(scene.particle_targets);
var colors = initialColorsToImage(scene.particle_colors);


/*************************
****** RUN ********
**************************/

var iter = 0;
var iter_limit = 10;
var prevtime = 0;
var currTime = 0;
makeRenderLoop(
  function() {
    // begin steps for iteration loop
    if (iter < iter_limit) {console.log('iter:' + iter);}
    if (iter < iter_limit) { currTime = Date.now(); prevtime = currTime; console.log('color by voronoi');  }
    colorByVoronoi(pos_1, colors, targets);
    if (iter < iter_limit) { currTime = Date.now(); console.log((prevtime - currTime)); prevtime = currTime; console.log('end: color by voronoi, begin append to document');  }
    //document.getElementsByTagName('body')[0].appendChild(colorByVoronoi.getCanvas());
    if (iter < iter_limit) {currTime = Date.now(); console.log((prevtime - currTime)); prevtime = currTime; console.log('end: append to document, begin draw to background canvas 2d');  }
    /// convert voronoi from getCanvas to gpu texture
    /// there is the outputToTexture(true) flag but for this case, optimized for debugging purposes so doing the multiple canvases
    // voronoi to canvas 2d
    context2d = draw2dImage(colorByVoronoi.getCanvas(), context2d, colorByVoronoi.getCanvas().toDataURL());
    if (iter < iter_limit) { currTime = Date.now(); console.log((prevtime - currTime)); prevtime = currTime; console.log('end: draw to background canvas 2d, begin: getImageData');  }
    data = context2d.getImageData(0, 0, canvas2d.clientWidth, canvas2d.clientHeight).data;
    if (iter < iter_limit) { currTime = Date.now(); console.log((prevtime - currTime)); prevtime = currTime; console.log('end: getImageData, begin import texture');  }
    voronoi_texture = importTexture(data);
    if (iter < iter_limit) { console.log((prevtime - currTime)); prevtime = currTime; console.log( 'end: import texture, begin positions Update superkernel'); currTime = Date.now();  }

    pos_2 = positionsUpdate_superKernel(voronoi_texture, pos_1, colors, targets);
    if (iter < iter_limit) { currTime = Date.now(); console.log((prevtime - currTime)); prevtime = currTime;  console.log('end: positions update superkernel'); }

    // now pos_2 is the starting buffer - dont want to copy over... just switch out target reference variable.
    // swap buffers. (pos_2 will be overwritten on output so dont need to change it).
    pos_1 = pos_2;

    ++iter;
  }
)();