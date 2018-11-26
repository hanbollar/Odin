import { canvas, camera, cameraControls, gui, gl, gpu } from './init';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { initShaderProgram } from './utils';

class Scene {
  constructor() {
    this._simStep = 0;

    this.numParticles = 10;
    this.particle_positions = [];
    this.particle_velocities = [];
    this.particle_colors = [];
    for (var i = 0; i < this.numParticles; ++i) {
      this.particle_positions.push(vec3.create());
      this.particle_velocities.push(vec3.create());
      this.particle_colors.push(vec3.create());
    }

    // create initial values
    for (var i = 0; i < this.numParticles; ++i) {
      this.particle_positions[i][0] = Math.random() * canvas.width;
      this.particle_positions[i][1] = Math.random() * canvas.height;
      this.particle_positions[i][2] = 0;

      this.particle_velocities[i][0] = Math.random() * 5;
      this.particle_velocities[i][1] = Math.random() * 5;
      this.particle_velocities[i][2] = 0;

      this.particle_colors[i][0] = Math.random();
      this.particle_colors[i][1] = Math.random();
      this.particle_colors[i][2] = Math.random();
    }
  }

  moveParticlePositions() {
    // TODO: later port this to be an image texture update
  }

  update() {
    // TODO: move gpu calls to here
  }
}

export default Scene;