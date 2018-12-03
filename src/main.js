 import { makeRenderLoop, camera, cameraControls, gui, gl, gpu, canvas, params } from './init';
 import Renderer from './renderer'
 import { mat4, vec4, vec2 } from 'gl-matrix';
 import { canvasToImage } from './utils'
 import Scene from './scene';

const FLT_MAX = Math.pow(3.402823466, 38);
const AGENT_VIS_RADIUS = 5;
const PIXEL_RAD_SQUARED = 500;

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

const initialPositionsToImage = gpu.createKernel(function(positions) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.x;
  const which_vec2 = this.thread.y;

  // if on y element, divide by height : divide by width
  const div_factor = (1 - vec2_element) * this.constants.screen_x + vec2_element * this.constants.screen_y;
  return positions[which_vec2][vec2_element] / div_factor;
})
.setConstants({ screen_x: canvas.clientWidth, screen_y: canvas.clientHeight })
.setOutput([scene.numParticles, 2])
.setOutputToTexture(true);

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
  var min_depth = this.constants.flt_max;
  var index = -1;
  var red = 0;
  var green = 0;
  var blue = 0;
  
  const width = this.thread.x;
  const height = this.thread.y;
  const depth_vec3_component = this.thread.z;

  // find which particle with which this pixel is most closely associated
  var pos_x = -1;
  var pos_y = -1;
  var depth = -1;
  for (var i = 0; i < this.constants.length; ++i) {
    pos_x = positions_texture[0][i] * this.constants.screen_x;
    pos_y = positions_texture[1][i] * this.constants.screen_y;
    
    depth = coneDepth(this.vec2(width, height),
                      this.vec2(pos_x, pos_y));

    if (depth < min_depth) {
      min_depth = depth;
      index = i;

      red = colors_texture[0][index];
      green = colors_texture[1][index];
      blue = colors_texture[2][index];
    }
  }
  

  if (depth_vec3_component == 0) {
    return red;
  } else if (depth_vec3_component == 1) {
    return green;
  } else {
    return blue;
  }
})
.setConstants({ length: scene.numParticles, screen_x : canvas.clientWidth, screen_y: canvas.clientHeight, flt_max: FLT_MAX, agent_vis_rad: AGENT_VIS_RADIUS})
.setOutput([canvas.clientWidth, canvas.clientHeight, 3])
.setOutputToTexture(true);

const voronoiToCanvas = gpu.createKernel(function(voronoi_texture) {
  const pixel = voronoi_texture[this.thread.y - this.constants.screen_y / 2][this.thread.x];
  this.color(0.5, 1, 0, 1);//pixel[0], pixel[1], pixel[2], 1);
})
.setConstants({ screen_x: canvas.clientWidth, screen_y: canvas.clientHeight })
.setOutput([canvas.clientWidth, canvas.clientHeight])
.setGraphical(true);

// const voronoiToVoronoiWithWhiteBuffer = gpu.createKernel(function(voronoi_texture) {
//   // for each pixel, if there are at least two different colors within a particular distance to it, color white
//   // so that we have a buffer distance.
//   // white bc color choice for particle is done through Math.random which ranges from [0, 1)
//   // so will never actually create white allowing it to act as a flag.

//   // voronoi texture
//   // a 2darray of vec3s of color - created as 3d array is stepped through as
//   // [width][height][depth] s.t. [this.thread.z][this.thread.y][this.thread.x]

//   // voronoi output texture for getCanvas = ?
//   // NOT USING THIS UPDATE YET

//   // TODO ---------------------------------------

//   return voronoi_texture[this.thread.z][this.thread.y][this.thread.x];  
// })
// .setConstants({agent_check_rad2: PIXEL_RAD_SQUARED, screen_x: canvas.clientWidth, screen_y:canvas.clientHeight})
// .setOutput([canvas.clientWidth, canvas.clientHeight, 3])
//.setOutputToTexture(true)

// const velocityUpdate = gpu.createKernel(function(old_positions, voronoi, colors, target) {
//   // calc weight for each pixel in relation to old positions
//   // already have ^^ this technically through voronoi? need to change though process for voronoi with ids?? maybe with texture output instead

//   // follow v = sum of vi's where each vi is the mi distance * weight of mi in relation to target / ave 
  


//   // an array of vec2s - created as 2d array is stepped through as
//   // [width][height] s.t. [this.thread.y][this.thread.x]
//   const vec2_element = this.thread.x;
//   const which_vec2 = this.thread.y;

//   // for each position, check surrounding pixels in agent_vis_radius
//   const on_pos_index = which_vec2;
//   const on_col_red = colors[on_pos_index];
//   const on_col_green = colors[on_pos_index];
//   const on_col_blue = colors[on_pos_index];

//   return 0; // zero velocity for now just checking pipeline update
// })
// .setConstants({ length: scene.numParticles, screen_x : canvas.clientWidth, screen_y: canvas.clientHeight })
// .setOutput([scene.numParticles, 2])
// //.setOutputToTexture(true);

// const positionsUpdate = gpu.createKernel(function(old_positions, velocities) {
//   // an array of vec2s - created as 2d array is stepped through as
//   // [width][height] s.t. [this.thread.y][this.thread.x]
//   const vec2_element = this.thread.x;
//   const which_vec2 = this.thread.y;

//   // new p = old p + velo
//   return old_positions[which_vec2][vec2_element] + velocities[which_vec2][vec2_element];
// })
// .setOutput([scene.numParticles, 2])
// //.setOutputToTexture(true)

// const renderPositionsToCanvas = gpu.createKernel(function(positions) {
//   const pixel_x = this.thread.x;
//   const pixel_y = this.thread.y;
//   var pos_x = 0;
//   var pos_y = 0;

//   var red = 0;
//   var green = 0;
//   var blue = 0;

//   for (var i = 0; i < this.constants.length; ++i) {
//     pos_x = positions[0][i] * this.constants.screen_x;
//     pos_y = positions[1][i] * this.constants.screen_y;

//     if (abs(pixel_x - pos_x) < this.constants.agent_vis_rad
//         && abs(pixel_y - pos_y) < this.constants.agent_vis_rad) {

//       red += 0.3;
//       green += 0.3;
//       blue += 0.3;
//     }
//   }

//   this.color(red, green, blue, 1);
// })
// .setConstants({length: scene.numParticles, screen_x : canvas.clientWidth, screen_y: canvas.clientHeight, agent_vis_rad: AGENT_VIS_RADIUS})
// .setOutput([canvas.clientWidth, canvas.clientHeight])
// .setGraphical(true);

// const copyMemoryBackToFirstBuffer = gpu.createKernel(function(updated_positions) {
//   return updated_positions[this.thread.y][this.thread.x];
// })
// .setOutput([scene.numParticles, 2])
// .setOutputToTexture(true);

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

var pos_1 = initialPositionsToImage(scene.particle_positions);
var targets = initialTargetsToImage(scene.particle_targets);
var colors = initialColorsToImage(scene.particle_colors);
// begin steps for iteration loop
var voronoi = positionsToVoronoi(pos_1, colors);
voronoiToCanvas(voronoi);
document.getElementsByTagName('body')[0].appendChild(vornoiToCanvas.getCanvas());

//var voronoiWithWhite = voronoiToVoronoiWithWhiteBuffer(voronoi);
// var velocities = velocityUpdate(pos_1, voronoi, colors, targets);
// var pos_2 = positionsUpdate(pos_1, velocities);
// renderPositionsToCanvas(pos_2);
//pos_1 = copyMemoryBackToFirstBuffer(pos_2);
//document.getElementsByTagName('body')[0].appendChild(renderPositionsToCanvas.getCanvas());


/*************************
****** RUN ********
**************************/

makeRenderLoop(
  function() {
    // scene.update();

    // if (params.render_mode == 0) {
    //   // render.update();
    // } else {
      // buffer swap
      // positions_tex1 = copyMemoryBackToFirstBuffer(positions_tex2).getCanvas();

      // voronoi_tex = positionsToVoronoi(positions_tex1, scene.particle_colors).getCanvas();
      // velocity_tex = velocityUpdate(positions_tex1, voronoi_tex, scene.particle_colors).getCanvas();
      // positions_tex2 = positionsUpdate(positions_tex1, velocity_tex).getCanvas();
      // // TODO LATER: use this tex2 as input to renderer for actual position locations of marionette

      // document.getElementsByTagName('body')[0].appendChild(voronoi_tex);
    // }
  }
)();