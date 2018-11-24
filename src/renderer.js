import { camera, cameraControls, gui, gl, canvas, resizeCanvas } from './init';
import { mat4, vec4, vec2 } from 'gl-matrix';
import { initShaderProgram } from './utils';

class Renderer {
  constructor() {
    // this._screenDimensions = vec2.create();
    // this._screenDimensions[0] = canvas.clientwidth / 2.0;
    // this._screenDimensions[1] = canvas.clientheight / 2.0;
    // this._screenQuadPositions = [
    //    1.0,  1.0,
    //   -1.0,  1.0,
    //    1.0, -1.0,
    //   -1.0, -1.0,
    // ];
    // this._vertexCount = 4;

    // this._projectionMatrix = mat4.create();
    // this._viewMatrix = mat4.create();
    // this._viewProjectionMatrix = mat4.create();

    // // Initialize a shader program; this is where all the lighting
    // // for the vertices and so forth is established.
    // const vs = `#version 300 es
    //   precision highp float;
    //   precision highp int;
    //   in vec2 aVertexPosition;
    //   uniform mat4 uModelViewMatrix;
    //   uniform mat4 uProjectionMatrix;
    //   uniform vec2 uScreenDimensions;
    //   out vec2 tex_coords;
    //   void main() {
    //     vec2 adjust = vec2(0.5, 0.5);
    //     tex_coords = aVertexPosition * adjust + adjust;
    //     gl_Position = vec4(tex_coords, 0, 1);
    //   }`;
    // const fs = `#version 300 es
    //   precision highp float;
    //   precision highp int;
    //   in vec2 tex_coords;
    //   out vec4 outColor;
    //   void main() {
    //    outColor = vec4(tex_coords.x, tex_coords.y, 0, 1);
    //   }`;
    // this.shaderProgram = initShaderProgram(gl, vs, fs);

    // // Collect all the info needed to use the shader program.
    // // Look up which attribute our shader program is using
    // // for aVertexPosition and look up uniform locations.
    // this.programInfo = {
    //   program: this.shaderProgram,
    //   attribLocations: {
    //     vertexPosition: gl.getAttribLocation(this.shaderProgram, 'aVertexPosition'),
    //   },
    //   uniformLocations: {
    //     projectionMatrix: gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix'),
    //     modelViewMatrix: gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix'),
    //     screenDimensions: gl.getUniformLocation(this.shaderProgram, 'uScreenDimensions'),
    //   },
    // };

    this.time = 0;

    gl.clearColor(0.2, 0.0, 0.2, 1.0);  
    gl.clearDepth(1.0);                 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // enable attributes as needed
    gl.enable(gl.DEPTH_TEST);           
    gl.depthFunc(gl.LEQUAL);   

    const vs = `
        attribute vec4 v_position;

        void main() {
          gl_Position = v_position;
        }     
    `;

    const fs = `
        precision mediump float;

        void main() {
           gl_FragColor = vec4(0,1,0,1); // green
        }
    `;

    this.shader_program = initShaderProgram(gl, vs, fs);
    gl.useProgram(this.shader_program);
    var vertexPositionAttribute = gl.getAttribLocation(this.shader_program, "v_position");
    var quad_vertex_buffer = gl.createBuffer();
    var quad_vertex_buffer_data = new Float32Array([ 
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad_vertex_buffer_data, gl.STATIC_DRAW);
    gl.vertexAttribPointer(vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexPositionAttribute)
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  update() {
    this.time += 1;
    // this.drawScene(gl, this.programInfo, this.buffers);
    console.log('time:'+ this.time);
  }

  // making screenspace render square for the shaders
  initBuffers(gl_context) {
    // const positionBuffer = gl_context.createBuffer();
    // gl_context.bindBuffer(gl_context.ARRAY_BUFFER, positionBuffer);
    // gl_context.bufferData(gl_context.ARRAY_BUFFER, new Float32Array(this._screenQuadPositions), gl_context.STATIC_DRAW);

    // return {
    //   position: positionBuffer,
    // };
  }

  drawScene(gl_context, programInfo, buffers) {
    // clear all values before redrawing
    // gl_context.clearColor(0.2, 0.0, 0.2, 1.0);  
    // gl_context.clearDepth(1.0);                 
    // gl_context.clear(gl_context.COLOR_BUFFER_BIT | gl_context.DEPTH_BUFFER_BIT);

    // // enable attributes as needed
    // gl_context.enable(gl_context.DEPTH_TEST);           
    // gl_context.depthFunc(gl_context.LEQUAL);            

    // // update projection matrix
    // mat4.perspective(this._projectionMatrix, camera.fov * Math.PI / 180, camera.aspect, camera.near, camera.far);

    // // positions vao
    // gl_context.bindBuffer(gl_context.ARRAY_BUFFER, this.buffers.position);
    // gl_context.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, gl_context.FLOAT, false, 0, 0);
    // gl_context.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);

    // // useMe()
    // gl_context.useProgram(this.programInfo.program);

    // // uniforms
    // gl_context.uniformMatrix4fv(this.programInfo.uniformLocations.projectionMatrix, false, this._projectionMatrix);
    // gl_context.uniformMatrix4fv(this.programInfo.uniformLocations.modelViewMatrix, false, this._viewMatrix);
    // gl_context.uniform2f(this.programInfo.uniformLocations.screenDimensions, false, this._screenDimensions);

    // // draw
    // gl_context.drawArrays(gl_context.TRIANGLE_STRIP, 0, this._vertexCount);
  }
}

export default Renderer;