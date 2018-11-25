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

    this.createParticlePositions();
  }

  createParticlePositions() {
    // TODO: later port this to be an image texture write using gpu.js for creation
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
    // TODO: later port this to be an image texture read using gpu.js for update
    var i = 0;
    var buffer_amount = 10;
    var temp_pos = vec3.create();
    var temp_velo = vec3.create();
    for (; i < this.numParticles; ++i) {
      temp_pos = this.particle_positions[i];
      temp_velo = this.particle_velocities[i];

      temp_pos = temp_pos + temp_velo;

      if (temp_pos.x < buffer_amount || temp_pos.x > canvas.width - buffer_amount
        || temp_pos.y < buffer_amount || temp_pos.y > canvas.height - buffer_amount) {

        this.particle_positions[i].x = clamp(temp_pos.x, buffer_amount, canvas.width - buffer_amount);
        this.particle_positions[i].y = clamp(temp_pos.y, buffer_amount, canvas.height - buffer_amount);

        negate(this.particle_velocities, this.particle_velocities);
      }
    }
  }

  update() {
    this._simStep += 1;
    console.log('simulation iteration:'+ this._simStep);
    //this.moveParticlePositions();
  }
}

export default Scene;