import { camera, cameraControls, gui, gl } from './init';
import { mat4, vec4, vec2 } from 'gl-matrix';
import { initShaderProgram } from './utils';

class Scene {
  constructor() {
    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();
    this.time = 0;
  }

  update() {
    // TODO: implement so calls tick for crowd sim movement
    this.time += 1;
    // this.drawScene(gl, this.programInfo, this.buffers);
    console.log('time:'+ this.time);
  }
}

export default Scene;