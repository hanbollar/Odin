import { canvas, camera, cameraControls, gui, gl, gpu } from './init';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { initShaderProgram } from './utils';

class Scene {
  constructor() {
    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();
    this._simStep = 0;

    this._numParticles = 5;
    this.particles = [];
    this.particlesVelocity = [];
    for (var i = 0; i < this._numParticles; ++i) {
      this.particles.push(vec3.create());
      this.particlesVelocity.push(vec3.create());
    }

    this.createParticlePositions();
  }

  createParticlePositions() {
    // TODO: later port this to be an image texture write using gpu.js for creation
    for (var i = 0; i < this._numParticles; ++i) {
      this.particles[i][0] = Math.random(canvas.width);
      this.particles[i][1] = Math.random(canvas.height);
      this.particles[i][2] = 0;

      this.particlesVelocity[i][0] = Math.random(5);
      this.particlesVelocity[i][1] = Math.random(5);
      this.particlesVelocity[i][2] = 0;
    }
  }

  moveParticlePositions() {
    // TODO: later port this to be an image texture read using gpu.js for update
    var i = 0;
    var buffer_amount = 10;
    var temp_pos = vec3.create();
    var temp_velo = vec3.create();
    for (; i < this._numParticles; ++i) {
      temp_pos = this.particles[i];
      temp_velo = this.particlesVelocity[i];

      temp_pos = temp_pos + temp_velo;

      if (temp_pos.x < buffer_amount || temp_pos.x > canvas.width - buffer_amount
        || temp_pos.y < buffer_amount || temp_pos.y > canvas.height - buffer_amount) {

        this.particles[i].x = clamp(temp_pos.x, buffer_amount, canvas.width - buffer_amount);
        this.particles[i].y = clamp(temp_pos.y, buffer_amount, canvas.height - buffer_amount);

        negate(this.particlesVelocity, this.particlesVelocity);
      }
    }
  }

  update() {
    this._simStep += 1;
    console.log('simulation iteration:'+ this._simStep);
    this.moveParticlePositions();
  }
}

export default Scene;