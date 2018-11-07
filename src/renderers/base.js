import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import { LIGHT_RADIUS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;
const PI_DIV_360 = 0.00872664625;

function sin_atan(angle) {
  return angle / Math.sqrt(1.0 + angle * angle);
}
function cos_atan(angle) {
  return 1.0 / Math.sqrt(1.0 + angle * angle);
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    // zero everything
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    // calculate frustum dimensions (proportional based on depth adjustment added later)
    const half_frustum_height = Math.tan(camera.fov * PI_DIV_360);
    const frustum_height = 2.0 * half_frustum_height;
    const frustum_width = camera.aspect * frustum_height;
    const half_frustum_width = 0.5 * frustum_width;
    const frustum_depth = camera.far - camera.near;

    const stride_x = frustum_width / this._xSlices;
    const stride_y = frustum_height / this._ySlices;
    const stride_z = frustum_depth / this._zSlices;

    const height_starting_index = -half_frustum_height;
    const width_starting_index = -half_frustum_width;

    // predeclaring some variables to prevent javascript memory overhead
    let light_radius = 0;  let light_position = vec4.create();
    let found_min = false;

    // Loop through lights counting number of lights at each buffer index 
    // and placing light in appropr loc in buffer for calcs
    for (let on_light = 0; on_light < NUM_LIGHTS; ++on_light) {
      // create variables of light's information
      light_radius = scene.lights[on_light].radius;
      light_position = vec4.fromValues(scene.lights[on_light].position[0],
                                           scene.lights[on_light].position[1],
                                           scene.lights[on_light].position[2],
                                           1);
      vec4.transformMat4(light_position, light_position, viewMatrix);

      // for calculations need (-) of curr depth value bc of coordinate system
      light_position[2] *= -1.0;


      /*
       * Calculate relevant z depth frustum bounds
       */
      // check which cluster slices would actually be influenced by this light
      // using math.floor bc these are cluster indices
      let cluster_z_min = Math.floor((light_position[2] - light_radius - camera.near) / stride_z);
      let cluster_z_max = Math.floor((light_position[2] + light_radius - camera.near) / stride_z) + 1;
      // check if valid index locations for cluster structure dimensions - if not, then not visible so ignore
      if (cluster_z_min >= this._zSlices || cluster_z_max < 0) {
        continue;
      }
      // cluster ranges can go outside bounds as long as overlapping with in-bounds locations
      // clamp cluster range to 0 -> slice bounds for each dimension
      cluster_z_min = Math.max(cluster_z_min, 0); cluster_z_max = Math.min(cluster_z_max, this._zSlices);

      /*
       * Calculate relevant x width frustum bounds
       */
      let cluster_x_min = this._xSlices;
      let cluster_x_max = this._xSlices;
      for(let x = 0; x <= this._xSlices; ++x) {
        let angle = width_starting_index + stride_x * x;

        // normal here: cosatan(angle), 0, -sinatan(angle) 
        // dot between light position and normal
        // dot simplified below

        let dot = light_position[0] * cos_atan(angle) - light_position[2] * sin_atan(angle);
        if(dot < light_radius) {
          cluster_x_min = Math.max(0, x - 1);
          break;
        } 
      }
      for(let x = cluster_x_min + 1; x <= this._xSlices; ++x) {
        let angle = width_starting_index + stride_x * x;

        // normal here: cosatan(angle), 0, -sinatan(angle) 
        // dot between light position and normal
        // dot simplified below
        let dot = light_position[0] * cos_atan(angle) - light_position[2] * sin_atan(angle);
        if(dot < -light_radius) {
          cluster_x_max = Math.max(0, x - 1);
          break;
        } 
      }

      /*
       * Calculate relevant y height frustum bounds
       */
      let cluster_y_min = this._ySlices;
      let cluster_y_max = this._ySlices;
      for(let y = 0; y <= this._ySlices; ++y) {
        let angle = height_starting_index + stride_y * y;

        // normal here: 0, cosatan(angle), -sinatan(angle) 
        // dot between light position and normal
        // dot simplified below
        let dot = light_position[1] * cos_atan(angle) - light_position[2] * sin_atan(angle);
        if(dot < light_radius) {
          cluster_y_min = Math.max(0, y - 1);
          break;
        } 
      }
      for (let y = 0; y <= this._ySlices; ++y) {
        let angle = height_starting_index + stride_y * y;

        // normal here: 0, cosatan(angle), -sinatan(angle) 
        // dot between light position and normal
        // dot simplified below
        let dot = light_position[1] * cos_atan(angle) - light_position[2] * sin_atan(angle);
        if(dot < -light_radius) {
          cluster_y_max = Math.max(0, y - 1);
          break;
        }
      }

      // fill in buffer locations where this light's influence should be included
      for (let z = cluster_z_min; z < cluster_z_max; ++z) {
        for (let y = cluster_y_min; y < cluster_y_max; ++y) {
          for (let x = cluster_x_min; x < cluster_x_max; ++x) {
            let index_1D =  x
                          + y * this._xSlices
                          + z * this._xSlices * this._ySlices;
            let index_light_count = this._clusterTexture.bufferIndex(index_1D, 0);

            // new light count with this light added to this cluster
            let num_lights_in_cluster = 1.0 + this._clusterTexture.buffer[index_light_count];

            // check if updating count based on this light
            if (num_lights_in_cluster <= MAX_LIGHTS_PER_CLUSTER) {
              let tex_pixel = Math.floor(num_lights_in_cluster * 0.25);
              let index_to_fill = this._clusterTexture.bufferIndex(index_1D, tex_pixel);
              let this_index = num_lights_in_cluster - tex_pixel * 4;

              this._clusterTexture.buffer[index_to_fill + this_index] = on_light;
              this._clusterTexture.buffer[index_light_count] = num_lights_in_cluster;
            }

          }//end: x iter
        }//end: y iter
      }//end: z iter

    }//end: for each light

    this._clusterTexture.update();
  }
}