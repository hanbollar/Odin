import { gl } from './init';
import { mat4, vec4 } from 'gl-matrix';
import { loadShaderProgram } from './utils';
//import vsSource from '../shaders/quad.vert.glsl';
import vsSource from './shaders/quad.vert.glsl';
import fsSource from './shaders/quad.frag.glsl';

class Scene {
  constructor() {
    this.screen = [];

    // Initialize a shader program. The fragment shader source is compiled based on the number of lights
    this._shaderProgram = loadShaderProgram(vsSource, fsSource({
      uniforms: ['u_viewProjectionMatrix'],
      attribs: ['a_position', 'a_normal', 'a_uv']
    }) );

    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();
  }

  update() {
    // TODO: implement so calls tick for crowd sim movement
  }

  render(camera, scene) {
    // Update the camera matrices
    camera.updateMatrixWorld();
    mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
    mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
    mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

    // Bind the default null framebuffer which is the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Render to the whole screen
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Clear the frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use this shader program
    gl.useProgram(this._shaderProgram.glShaderProgram);

    // Upload the camera matrix
    gl.uniformMatrix4fv(this._shaderProgram.u_viewProjectionMatrix, false, this._viewProjectionMatrix);

    renderFullscreenQuad(this._shaderProgram.glShaderProgram);
  }
}

export default Scene;