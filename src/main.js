// import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
// import Scene from './scene';

// // setup gui
// const params = {
//   title: "GUI",
// };
// gui.add(params, 'title');

// // setup scene
// const scene = new Scene();
// camera.position.set(-10, 8, 0);
// cameraControls.target.set(0, 2, 0);
// gl.enable(gl.DEPTH_TEST);

// // render and update function linking
// function render() {
//   scene.update();
//   params._renderer.render(camera, scene);
// }
// makeRenderLoop(render)();

/************************************************************
*************************************************************
*************************************************************
******************************************************************************************************************/
// "use strict";

import { mat4, vec4 } from 'gl-matrix';

export const canvas = document.getElementById('canvas');
 canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
const gl_context = canvas.getContext('webgl2');
//console.log('gl_context: '+ gl_context);

var isWebGL2 = !!gl_context;
if(!isWebGL2) {
  console.log('WebGL 2 is not available. Make sure it is available and properly enabled in this browser');
} else {
  console.log('WebGL 2 confirmed');
}

// var vertexShaderSource = `#version 300 es

// // an attribute is an input (in) to a vertex shader.
// // It will receive data from a buffer
// in vec2 a_position;
// in vec2 a_texCoord;

// // Used to pass in the resolution of the canvas
// uniform vec2 u_resolution;

// // Used to pass the texture coordinates to the fragment shader
// out vec2 v_texCoord;

// // all shaders have a main function
// void main() {

//   // convert the position from pixels to 0.0 to 1.0
//   vec2 zeroToOne = a_position / u_resolution;

//   // convert from 0->1 to 0->2
//   vec2 zeroToTwo = zeroToOne * 2.0;

//   // convert from 0->2 to -1->+1 (clipspace)
//   vec2 clipSpace = zeroToTwo - 1.0;

//   gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

//   // pass the texCoord to the fragment shader
//   // The GPU will interpolate this value between points.
//   v_texCoord = a_texCoord;
// }
// `;

// var fragmentShaderSource = `#version 300 es

// // fragment shaders don't have a default precision so we need
// // to pick one. mediump is a good default. It means "medium precision"
// precision mediump float;

// // our texture
// uniform sampler2D u_image;

// // the texCoords passed in from the vertex shader.
// in vec2 v_texCoord;

// // we need to declare an output for the fragment shader
// out vec4 outColor;

// void main() {
//   outColor = vec4(v_texCoord.x, v_texCoord.y, 0.0, 1.0);// texture(u_image, v_texCoord);
// }
// `;



// CONSTANTS
const screen_width = window.innerWidth;
const screen_height = window.innerHeight;
// const screen_quad_positions = [
//      1.0,  1.0,
//     -1.0,  1.0,
//      1.0, -1.0,
//     -1.0, -1.0,
//   ];
  const screen_quad_positions = [
     1.0,  -1.0,
    -1.0,  -1.0,
     1.0,  1.0,
    -1.0,  1.0,
  ];
// const screen_quad_positions = [
//    screen_width, screen_height,
//   -screen_width, screen_height,
//    screen_width, -screen_height,
//   -screen_width, -screen_height,
// ];
// console.log('screen_width: ' + screen_width);
// console.log('screen_height: ' + screen_height);
// const screen_quad_positions = [
//    screen_width, 0,
//    0, 0,
//    screen_width, screen_height,
//    0, screen_height,
// ];
const vertex_count = 4;

// constants for visual
const fov_in_degrees = 45;
const fov_in_radians = fov_in_degrees * Math.PI / 180;   // in radians
const aspect_ratio = gl_context.canvas.clientWidth / gl_context.canvas.clientHeight;
const near_clip = 0.1;
const far_clip = 100.0;

function main() {
  // Vertex shader program
  const vsSource = `#version 300 es
        precision highp float;
        precision highp int;

    in vec4 aVertexPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    out vec4 screen_loc;
    void main() {
      gl_Position = /*uProjectionMatrix * uModelViewMatrix **/ aVertexPosition;
      screen_loc = gl_Position;
    }
  `;

  // Fragment shader program
  const fsSource = `#version 300 es
        precision highp float;
        precision highp int;
        uniform sampler2D diffuse;
        uniform vec2 u_imageSize;


  in vec4 screen_loc;

  out vec4 outColor;
    void main() {
     outColor = screen_loc;
    }
  `;

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = initShaderProgram(gl_context, vsSource, fsSource);

  // Collect all the info needed to use the shader program.
  // Look up which attribute our shader program is using
  // for aVertexPosition and look up uniform locations.
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl_context.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl_context.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl_context.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
    },
  };

  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = initBuffers(gl_context);

  // Draw the scene
  drawScene(gl_context, programInfo, buffers);
}

main();

// making screenspace render square for the shaders
function initBuffers(gl_context) {
  const positionBuffer = gl_context.createBuffer();
  gl_context.bindBuffer(gl_context.ARRAY_BUFFER, positionBuffer);
  gl_context.bufferData(gl_context.ARRAY_BUFFER, new Float32Array(screen_quad_positions), gl_context.STATIC_DRAW);

  return {
    position: positionBuffer,
  };
}

function drawScene(gl_context, programInfo, buffers) {
  // clear all values before redrawing
  gl_context.clearColor(0.2, 0.0, 0.2, 1.0);  
  gl_context.clearDepth(1.0);                 
  gl_context.clear(gl_context.COLOR_BUFFER_BIT | gl_context.DEPTH_BUFFER_BIT);

  // enable attributes as needed
  gl_context.enable(gl_context.DEPTH_TEST);           
  gl_context.depthFunc(gl_context.LEQUAL);            

  // projection matrix
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, fov_in_radians, aspect_ratio, near_clip, far_clip);

  // view matrix - identity for now
  const modelViewMatrix = mat4.create();

  // positions vao
  gl_context.bindBuffer(gl_context.ARRAY_BUFFER, buffers.position);
  gl_context.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl_context.FLOAT, false, 0, 0);
  gl_context.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  // useMe()
  gl_context.useProgram(programInfo.program);

  // uniforms
  gl_context.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl_context.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);

  // draw
  gl_context.drawArrays(gl_context.TRIANGLE_STRIP, 0, vertex_count);
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl_context, vsSource, fsSource) {
  const vertexShader = loadShader(gl_context, gl_context.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl_context, gl_context.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl_context.createProgram();
  gl_context.attachShader(shaderProgram, vertexShader);
  gl_context.attachShader(shaderProgram, fragmentShader);
  gl_context.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl_context.getProgramParameter(shaderProgram, gl_context.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl_context.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl_context, type, source) {
  const shader = gl_context.createShader(type);

  gl_context.shaderSource(shader, source);
  gl_context.compileShader(shader);

  // See if it compiled successfully
  if (!gl_context.getShaderParameter(shader, gl_context.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl_context.getShaderInfoLog(shader));
    gl_context.deleteShader(shader);
    return null;
  }

  return shader;
}
