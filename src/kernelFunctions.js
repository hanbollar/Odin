import { gpu } from './init';
import { draw2dImage, resizeSpecificCanvas} from './utils'
import { mat4, vec4, vec2 } from 'gl-matrix';
import { FLOOR_HEIGHT, FLOOR_WIDTH, NUM_PARTICLES } from './utils'

const FLT_MAX = Math.pow(3.402823466, 38);
const AGENT_VIS_RADIUS = 80.0;
const PIXEL_BUFFER_RAD = 0.05;
const AGENT_DRAW_RAD = 20.0;


/************************************
**** GPU KERNEL HELPER FUNCTIONS ****
*************************************/

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
  var cos_theta = (agent_to_marker_x * agent_to_target_x + agent_to_marker_y * agent_to_target_y) / (m_distance * g_distance);

  return (1.0 + cos_theta) / (1.0 + m_distance);
}
const computeMarkerWeight_options = {
  paramTypes: { agent_x: 'Number', agent_y: 'Number', marker_x: 'Number', marker_y: 'Number', target_x: 'Number', target_y: 'Number'},
  returnType: 'Number'
}
gpu.addFunction(computeMarkerWeight, computeMarkerWeight_options);

function colorToIndex(channel_value, numParticles) {
  const temp_colorToIndex = channel_value * numParticles;
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

/**********************************
**** INITIAL PORTING FUNCTIONS ****
***********************************/

export const initialVec3toVec2KernelPassing = gpu.createKernel(function(input_array) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.x;
  const which_vec2 = this.thread.y;

  // if on y element, divide by height : divide by width
  const div_factor = (1 - vec2_element) * this.constants.screen_x + vec2_element * this.constants.screen_y;
  return input_array[which_vec2][vec2_element] / div_factor;
})
.setConstants({ screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT })
.setOutput([2, NUM_PARTICLES]);
//.setOutputToTexture(true);

export const initialColorsToImage = gpu.createKernel(function(colors) {
  // an array of vec3s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec3_element = this.thread.x;
  const which_vec3 = this.thread.y;

  return colors[which_vec3][vec3_element];
})
.setConstants({ screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT })
.setOutput([3, NUM_PARTICLES]);
//.setOutputToTexture(true);

/**************************************
**** VORONOI VELOCITY CALCULATIONS ****
***************************************/

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
  const x_i = this.thread.y;
  const y_i = this.thread.x;
  for (var i = 0; i < this.constants.length; ++i) {
    pos_x = positions_texture[i][0] * this.constants.screen_x;
    pos_y = positions_texture[i][1] * this.constants.screen_y;

    depth = coneDepth(x_i, y_i, pos_x, pos_y);

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
  var closest_x_diff = abs(x_i - positions_texture[closest_index][0] * this.constants.screen_x);
  var closest_y_diff = abs(y_i - positions_texture[closest_index][1] * this.constants.screen_y);
  var second_closest_x_diff = abs(x_i - positions_texture[second_closest_index][0] * this.constants.screen_x);
  var second_closest_y_diff = abs(y_i - positions_texture[second_closest_index][1] * this.constants.screen_y);

  var closest_dist2 = closest_x_diff * closest_x_diff + closest_y_diff * closest_y_diff;
  var second_closest_dist2 = second_closest_x_diff * second_closest_x_diff + second_closest_y_diff * second_closest_y_diff;

  var dist = closest_dist2 + second_closest_dist2;

  if (abs(closest_dist2 / dist - 0.5) < this.constants.pixel_rad) {
    // for each pixel, if there are at least two different colors within a particular distance to it, color white.
    // also if closest distance is farther than our agent checking radius, color white.
    // so that we have a buffer distance.
    // white bc color choice for particle is done through Math.random which ranges from [0, 1)
    // so will never actually create white allowing it to act as a flag.
    return 1;
  } else {
    // color_index - to allow for different channel outputs; however, hash function atm denotes all color channels for a pixel are the same
    return colors_texture[closest_index][color_index];
  }
})
.setConstants({ length: NUM_PARTICLES, screen_x : FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, flt_max: FLT_MAX, agent_vis_rad: AGENT_VIS_RADIUS, pixel_rad: PIXEL_BUFFER_RAD})
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT]);

export const summedWeightPerAgent = gpu.createKernel(function(pixel_weights, positions, voronoi_red, colors, targets) {
  // for each associated agent,
  // for each pixel - this associated with me? ok - add to my sum
  // in gpujs this cant be optimized to for each pixel add to agent sum because cant modify inputted ref values, can only do return 
  //  output for each thread (not per agent).
  // optimization - only check pixels in an associated RADIUS

  // voronoi_red: which agent is associated with which pixel
  // pixel_weights: the weighting for each pixel

  const x_loc = positions[this.thread.x][0] * this.constants.screen_x;
  const y_loc = positions[this.thread.x][1] * this.constants.screen_y;

  const x_start = clamp(x_loc - this.constants.agent_vis_rad, 0, this.constants.screen_x);
  const x_end = clamp(x_loc + this.constants.agent_vis_rad, 0, this.constants.screen_y);
  const y_start = clamp(y_loc - this.constants.agent_vis_rad, 0, this.constants.screen_x);
  const y_end = clamp(y_loc + this.constants.agent_vis_rad, 0, this.constants.screen_y);

  var pixel_index = -1;
  var sum = 0;
  for (var i = x_start; i < x_end; ++i) {
    for (var j = y_start; j < y_end; ++j) {
      pixel_index = colorToIndex(voronoi_red[i][j], this.constants.length);
      if (pixel_index == this.thread.x) {
        sum += pixel_weights[i][j];
      }
    }
  }

  return sum;
})
.setConstants({ length: NUM_PARTICLES, screen_x : FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, flt_max: FLT_MAX, agent_vis_rad: AGENT_VIS_RADIUS })
.setOutput([NUM_PARTICLES]);

export const pixelWeights = gpu.createKernel(function(positions, voronoi_red, colors, targets) {
  // for each pixel,
  // what is it's associated agent
  // what is the weighting of this pixel in relation to the agent and its target

  const x_i = this.thread.y;
  const y_i = this.thread.x;

  const agent_index = colorToIndex(voronoi_red[x_i][y_i], this.constants.length);
  // if not on a valid agent's index (ie in white buffer region) this has no weight
  if (agent_index == this.constants.length) { return 0;}

  return computeMarkerWeight(
                  positions[agent_index][0] * this.constants.screen_x,
  							  positions[agent_index][1] * this.constants.screen_y,
		  					  x_i,
		  					  y_i,
		  					  targets[agent_index][0] * this.constants.screen_x,
		  					  targets[agent_index][1] * this.constants.screen_y);
})
.setConstants({ length: NUM_PARTICLES, screen_x : FLOOR_WIDTH, screen_y: FLOOR_HEIGHT })
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT]);

export const actualVoronoiWeightingPerPixel = gpu.createKernel(function(positions, voronoi_pixelWeight, agent_summedWeight, voronoi_red, colors, targets, component) {
  // for each pixel, compute weight of pixel in relation to associated position

  // for each pixel,
  // what is it's associated agent
  // what is the weighting of this pixel in relation to the agent and its target
  // what is the total summed weighting of all those affecting pixel's agent
  // what is mi of this pixel in relation to pixel's agent

  const x_i = this.thread.y;
  const y_i = this.thread.x;

  const agent_index = colorToIndex(voronoi_red[x_i][y_i], this.constants.length);
  // if not on a valid agent's index (ie in white buffer region) this has no weight
  if (agent_index == this.constants.length) { return 0;}

  const mi_x = x_i - positions[agent_index][0] * this.constants.screen_x;
  const mi_y = y_i - positions[agent_index][1] * this.constants.screen_y;
  const v_weight = voronoi_pixelWeight[x_i][y_i]  / agent_summedWeight[agent_index];
  if (component == 0) {
    return mi_x * v_weight;
  } else if (component == 1) {
    return mi_y * v_weight;
  } else {
    // invalid component option:
    // this will throw errors in the fragment shader when passed to the render check
    // when drawing it on canvas in debug mode
    return -1;
  }
})
.setConstants({ length: NUM_PARTICLES, screen_x : FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, flt_max: FLT_MAX, agent_vis_rad: AGENT_VIS_RADIUS, pixel_rad: PIXEL_BUFFER_RAD})
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])

export const positionsUpdate = gpu.createKernel(function(old_positions, velocities_x, velocities_y) {
  // an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  const vec2_element = this.thread.x;
  const which_vec2 = this.thread.y;

  // used to normalize velocity
  const length = sqrt(velocities_x[which_vec2] * velocities_x[which_vec2] + velocities_y[which_vec2] * velocities_y[which_vec2]);
  var vel_element = velocities_x[which_vec2];
  if (vec2_element == 1) {
    vel_element = velocities_y[which_vec2];
  }

  // new p = old p + velo
  const influence = 0.01;
  var value = old_positions[which_vec2][vec2_element] + vel_element / length * influence;
  return clamp(value, 0, 1);
})
.setConstants({ length: NUM_PARTICLES, screen_x : FLOOR_WIDTH, screen_y: FLOOR_HEIGHT })
.setOutput([2, NUM_PARTICLES]);

/*************************
**** OUTPUT FUNCTIONS ****
**************************/

export const positionsToViableArray = gpu.createKernel(function(positions_2elements) {
  // positions_2elements is an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  // our output here is an array of the form [x, 0, z, x, 0, z, ...]

  const which_vec3 = floor(this.thread.x / 3.0);
  var vec3_element = this.thread.x % 3; 
  var mult_factor = this.constants.screen_x;

  if (vec3_element == 1) { return 0; }
  if (vec3_element == 2) {
    vec3_element -= 1;
    mult_factor = this.constants.screen_y;
  }
  return mult_factor * positions_2elements[which_vec3][vec3_element];
})
.setConstants({ length: NUM_PARTICLES, screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT })
.setOutput([NUM_PARTICLES * 3]);

export const velocitiesToViableArray = gpu.createKernel(function(positions_2elements, oldPositions_2elements) {
  // positions_2elements is an array of vec2s - created as 2d array is stepped through as
  // [width][height] s.t. [this.thread.y][this.thread.x]
  // our output here is an array of the form [x, 0, z, x, 0, z, ...]

  const which_vec3 = floor(this.thread.x / 3.0);
  var vec3_element = this.thread.x % 3; 

  if (vec3_element == 1) { return 0; }
  if (vec3_element == 2) { vec3_element -= 1; }
  return positions_2elements[which_vec3][vec3_element] - oldPositions_2elements[which_vec3][vec3_element];
})
.setConstants({ length: NUM_PARTICLES })
.setOutput([NUM_PARTICLES * 3]);

/********************************
**** VISUALIZATION FUNCTIONS ****
*********************************/

export const positionsToScreenVisual = gpu.createKernel(function(pos) {
  const x_i = this.thread.y;
  const y_i = this.thread.x;
	for (var i = 0; i < this.constants.length; ++i) {
		if (abs(pos[i][0] * this.constants.screen_x - x_i) < this.constants.draw_rad
		  && abs(pos[i][1] * this.constants.screen_y - y_i) < this.constants.draw_rad) {
			this.color(pos[i][0], 0, pos[i][1]);
		}
	}
})
.setConstants({ length: NUM_PARTICLES, screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, draw_rad: AGENT_DRAW_RAD })
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])
.setGraphical(true);

export const velToScreenVisual = gpu.createKernel(function(pos, vel_x, vel_y) {
  const x_i = this.thread.y;
  const y_i = this.thread.x;
  var bool = 0;
  for (var i = 0; i < this.constants.length; ++i) {
    if (abs(pos[i][0] * this.constants.screen_x - x_i) < this.constants.draw_rad
      && abs(pos[i][1] * this.constants.screen_y - y_i) < this.constants.draw_rad) {
      this.color(vel_x[i], 0, vel_y[i]);
      bool = 1;
    }
  }
  if (bool == 0) {
    this.color(1, 1, 1);
  }
})
.setConstants({ length: NUM_PARTICLES, screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, draw_rad: AGENT_DRAW_RAD })
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])
.setGraphical(true);


export const allColoringVisual = gpu.createKernel(function(voronoi_red, voronoi_green, pos) {
	const x_i = this.thread.y;
  const y_i = this.thread.x;

  var red = voronoi_red[x_i][y_i];
	var green = voronoi_green[x_i][y_i];
  var blue = 0;

  for (var i = 0; i < this.constants.length; ++i) {
    if (abs(pos[i][0] * this.constants.screen_x - x_i) < this.constants.draw_rad
        && abs(pos[i][1] * this.constants.screen_y - y_i) < this.constants.draw_rad) {
      red = 1;
      blue = 1;
    }
  }
  this.color(red, green, blue);
})
.setConstants({ length: NUM_PARTICLES, screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, draw_rad: AGENT_DRAW_RAD })
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])
.setGraphical(true);

export const velocityAtPositionsVisual = gpu.createKernel(function(velocities, pos) {
	var red = 0;
  var green = 0;
  var blue = 0;

  const x_i = this.thread.y;
  const y_i = this.thread.x;

  for (var i = 0; i < this.constants.length; ++i) {
    if (abs(pos[i][0] * this.constants.screen_x - x_i) < this.constants.draw_rad
        && abs(pos[i][1] * this.constants.screen_y - y_i) < this.constants.draw_rad) {
      green = velocities[i][0];
      blue = velocities[i][1];
    }
  }
  this.color(red, green, blue);
})
.setConstants({ length: NUM_PARTICLES, screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, draw_rad: AGENT_DRAW_RAD })
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])
.setGraphical(true);

export const renderCheck = gpu.createKernel(function(voronoi, color_index) {
  if (color_index == 0) {
    this.color(voronoi[this.thread.y][this.thread.x], 0, 0);
  } else if (color_index == 1) {
    this.color(0, voronoi[this.thread.y][this.thread.x], 0);
  } else if (color_index == 2) {
    this.color(0, 0, voronoi[this.thread.y][this.thread.x]);
  } else {
    // should never reach this color index so forcing gpujs fragment shader to error
    this.color(-1, -1, -1);
  }
})
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])
.setGraphical(true);

export const renderCheckAbs = gpu.createKernel(function(voronoi_x, voronoi_y) {
  const a = 10.0; // influence
  this.color( abs(a * voronoi_x[this.thread.y][this.thread.x]),
              0,
              abs(a * voronoi_y[this.thread.y][this.thread.x]));
})
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])
.setGraphical(true);

export const agentIndexCheck = gpu.createKernel(function(voronoi_red, colors) {
  const agent_index = colorToIndex(voronoi_red[this.thread.y][this.thread.x], this.constants.length);
  return colors[agent_index][0];
})
.setConstants({ length: NUM_PARTICLES, screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, draw_rad: AGENT_DRAW_RAD })
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT]);

export const agentIndexVisCheck = gpu.createKernel(function(voronoi_red, colors) {
  const agent_index = colorToIndex(voronoi_red[this.thread.y][this.thread.x], this.constants.length);
  if (agent_index >= this.constants.length) {
    this.color(1, 0, 0);
  } else {
    this.color(colors[agent_index][0], 0, 0);
  }
})
.setConstants({ length: NUM_PARTICLES, screen_x: FLOOR_WIDTH, screen_y: FLOOR_HEIGHT, draw_rad: AGENT_DRAW_RAD })
.setOutput([FLOOR_WIDTH, FLOOR_HEIGHT])
.setGraphical(true);