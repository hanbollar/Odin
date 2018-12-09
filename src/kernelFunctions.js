import { gpu } from './init';
import { draw2dImage, resizeSpecificCanvas} from './utils'
import { mat4, vec4, vec2 } from 'gl-matrix';
import { FLOOR_HEIGHT, FLOOR_WIDTH, NUM_PARTICLES } from './utils'

const FLT_MAX = Math.pow(3.402823466, 38);
const AGENT_VIS_RADIUS = 5;
const PIXEL_BUFFER_RAD = 0.05;


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

function colorToIndex(channel_value, numParticles) {
  var temp_colorToIndex = channel_value * numParticles;
  var floor_temp = floor(temp_colorToIndex) - temp_colorToIndex;
  if (floor_temp < 0) {
    floor_temp *= -1.0;
  }
  if (floor_temp < 1e-5) {
    return floor(temp_colorToIndex);
  }
  return ceil(temp_colorToIndex);
}
const colorToIndex_options = {
  paramTypes: { channel_value: 'Number', numParticles: 'Number'},
  returnType: 'Number'
}
gpu.addFunction(colorToIndex, colorToIndex_options);

/*********************************
****** GPU KERNEL METHODS ********
**********************************/

export const initialVec3toVec2KernelPassing = gpu.createKernel(function(input_array) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.y;
  const which_vec2 = this.thread.x;

  // if on y element, divide by height : divide by width
  const div_factor = (1 - vec2_element) * this.constants.screen_x + vec2_element * this.constants.screen_y;
  return input_array[which_vec2][vec2_element] / div_factor;
})
.setConstants({ screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT })
.setOutput([NUM_PARTICLES, 2]);
//.setOutputToTexture(true);

export const initialColorsToImage = gpu.createKernel(function(colors) {
  // an array of vec3s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec3_element = this.thread.x;
  const which_vec3 = this.thread.y;

  return colors[which_vec3][vec3_element];
})
.setConstants({ screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT })
.setOutput([NUM_PARTICLES, 3]);
//.setOutputToTexture(true);

export const colorByVoronoi = gpu.createKernel(function(positions_texture, colors_texture, targets_texture, color_index) {
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
    return 1;
  } else {
    // color_index - to allow for different channel outputs; however, hash function atm denotes all color channels for a pixel are the same
    return colors_texture[color_index][closest_index];
  }
})
.setConstants({ length: NUM_PARTICLES, screen_x : FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, flt_max: FLT_MAX, agent_vis_rad: AGENT_VIS_RADIUS, pixel_rad: PIXEL_BUFFER_RAD})
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])

export const colorByVoronoiWeighting = gpu.createKernel(function(positions_texture, voronoi_texture, colors_texture, targets_texture) {
  // for each pixel,
  // what is it's associated agent
  // what is the weighting of this pixel in relation to the agent and its target

  return 0.5;
})
.setConstants({ length: NUM_PARTICLES, screen_x : FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, flt_max: FLT_MAX, agent_vis_rad: AGENT_VIS_RADIUS, pixel_rad: PIXEL_BUFFER_RAD})
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])

export const renderCheck = gpu.createKernel(function(voronoi, color_index) {
	if (color_index == 0) {
		this.color(voronoi[this.thread.y][this.thread.x], 0, 0);
	} else if (color_index == 1) {
		this.color(0, voronoi[this.thread.y][this.thread.x], 0);
	} else if (color_index == 2) {
		this.color(0, 0, voronoi[this.thread.y][this.thread.x]);
	} else {
		// should reach this color index so forcing gpujs fragment shader to error
		this.color(-1, -1, -1);
	}
})
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])
.setGraphical(true);

export const velocityUpdate = gpu.createKernel(function(old_positions, voronoi_red, colors, target) {
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

  // voronoi texture position values are in 0-1 range.
  // want velocity to also be in this output range.

  return 0.01; // zero velocity for now just checking pipeline update
})
.setConstants({ length: NUM_PARTICLES, screen_x : FLOOR_WIDTH, screen_y: FLOOR_HEIGHT })
.setOutput([NUM_PARTICLES, 2])

export const positionsUpdate = gpu.createKernel(function(old_positions, velocities) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.x;
  const which_vec2 = this.thread.y;

  // new p = old p + velo
  return old_positions[which_vec2][vec2_element] + velocities[which_vec2][vec2_element];
})
.setConstants({ length: NUM_PARTICLES })
.setOutput([NUM_PARTICLES, 2]);

export const positionsUpdate_superKernel = gpu.combineKernels(positionsUpdate, velocityUpdate, function(voronoi_red, old_positions, colors, target) {
  return positionsUpdate(old_positions, velocityUpdate(old_positions, voronoi_red, colors, target));
});

export const positionsToViableArray = gpu.createKernel(function(positions_2elements) {
  // positions_2elements is an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  // our output here is an array of the form [x, 0, z, x, 0, z, ...]

  const which_vec3 = floor(this.thread.x / 3.0);
  var vec3_element = this.thread.x % 3; 

  if (vec3_element == 1) { return 0; }
  if (vec3_element == 2) { vec3_element -= 1; }
  return positions_2elements[which_vec3][vec3_element];
})
.setConstants({ length: NUM_PARTICLES })
.setOutput([NUM_PARTICLES * 3]);