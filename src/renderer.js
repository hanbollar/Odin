import { camera, cameraControls, gui, gl, canvas, resizeCanvas } from './init';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { initShaderProgram, mat4FromArray } from './utils';

class Renderer {
  constructor() {
    this.time = 0;

    const vs = `#version 300 es
        in vec4 v_position;
        uniform mat4 u_viewProj;

        out vec2 uv_color;

        void main() {
          gl_Position = v_position;
          uv_color = vec2(v_position[0], v_position[1]);
        }     
    `;

    const fs = `#version 300 es
        precision mediump float;

        in vec2 uv_color;

        out vec4 fragColor;

        void main() {
            fragColor = vec4(uv_color[0], uv_color[1], 0.0, 1.0);
        }
    `;

    // shader program
    this.shader_program = initShaderProgram(gl, vs, fs);

    this.locations = {
        v_position: gl.getAttribLocation(this.shader_program, 'v_position'),
        u_MVP: gl.getUniformLocation(this.shader_program, 'u_viewProj'),
    };

    // variables to be used in program
    this.quad_vertex_buffer_data = new Float32Array([ 
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0]);
    this.viewMatrix = mat4.create();
    this.projectionMatrix = mat4.create();
    this.VP = mat4.create();
    this.canvas_dimensions = vec2.create();
  }

  update() {
    this.time += 1;
    console.log('time:'+ this.time);

    // updating values
    mat4FromArray(this.viewMatrix, camera.modelViewMatrix.elements);
    mat4FromArray(this.projectionMatrix, camera.projectionMatrix.elements);
    mat4.multiply(this.VP, this.projectionMatrix, this.viewMatrix);

    this.canvas_dimensions[0] = canvas.clientWidth;
    this.canvas_dimensions[1] = canvas.clientHeight;

    // draw
    this.drawScene();
  }

  drawScene() {
    // clear all values before redrawing
    gl.clearColor(0.2, 0.0, 0.2, 1.0);  
    gl.clearDepth(1.0);                 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  

    // useMe()
    gl.useProgram(this.shader_program);

    // vbo
    var quad_vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.quad_vertex_buffer_data, gl.STATIC_DRAW);
    
    // vao
    gl.enableVertexAttribArray(this.locations.v_position);
    gl.vertexAttribPointer(this.locations.v_position, 2, gl.FLOAT, false, 0, 0);
    
    // uniforms
    gl.uniformMatrix4fv(this.locations.u_viewProj, false, this.VP);

    // draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // after draw
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);        
  }
}

export default Renderer;