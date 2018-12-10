import { canvas, camera, cameraControls, gui, gl, gpu } from './init';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import {
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  initShaderProgram,
  NUM_PARTICLES
} from './utils';

class Scene {
  constructor() {
    this._simStep = 0;

    this.particle_positions = [];
    this.particle_velocities = [];
    this.particle_colors = [];
    this.particle_targets = [];
    for (var i = 0; i < NUM_PARTICLES; ++i) {
      this.particle_positions.push(vec3.create());
      this.particle_velocities.push(vec3.create());
      this.particle_colors.push(vec3.create());
      this.particle_targets.push(vec3.create());
    }

    // create initial values
    for (var i = 0.0; i < NUM_PARTICLES; ++i) {
      this.particle_positions[i][0] = Math.random() * FLOOR_WIDTH;
      this.particle_positions[i][1] = Math.random() * FLOOR_HEIGHT;
      this.particle_positions[i][2] = 0;

      // for biocrowds doesnt matter what init velo is for update since just depends on
      // available markers around current location.
      this.particle_velocities[i][0] = 0;
      this.particle_velocities[i][1] = 0;
      this.particle_velocities[i][2] = 0;

      this.particle_colors[i][0] = i / NUM_PARTICLES;
      this.particle_colors[i][1] = i / NUM_PARTICLES;
      this.particle_colors[i][2] = i / NUM_PARTICLES;

      // TODO - update targets to be a better value
      if (i % 2 == 0) {
        this.particle_targets[i][0] = FLOOR_WIDTH - FLOOR_WIDTH / 4.0;
        this.particle_targets[i][1] = i / NUM_PARTICLES * FLOOR_HEIGHT;
        this.particle_targets[i][2] = 0;
      } else {
        this.particle_targets[i][0] = FLOOR_WIDTH / 4.0;
        this.particle_targets[i][1] = i / NUM_PARTICLES * FLOOR_HEIGHT;
        this.particle_targets[i][2] = 0;
      }
    }
  }
}

export default Scene;