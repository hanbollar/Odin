import { gl, canvas, abort } from './init';

function downloadURI(uri, name) {
  var link = document.createElement('a');
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export function saveCanvas() {
  downloadURI(canvas.toDataURL('image/png'), 'webgl-canvas-' + Date.now() + '.png');
}

export function initShaderProgram(gl_context, vsSource, fsSource) {
  const vs = loadShader(gl_context, vsSource, gl_context.VERTEX_SHADER);
  const fs = loadShader(gl_context, fsSource, gl_context.FRAGMENT_SHADER);
  const program = gl_context.createProgram();

  gl_context.attachShader(program, vs);
  gl_context.attachShader(program, fs);
  gl_context.linkProgram(program);

  if (!gl_context.getProgramParameter(program, gl_context.LINK_STATUS)) {
    console.log('Shader program cannot initializing: ' + gl_context.getProgramInfoLog(program));
    return null;
  }
  return program;
}

export function loadShader(gl_context, src, type) {
  const shader = gl_context.createShader(type);
  gl_context.shaderSource(shader, src);
  gl_context.compileShader(shader);

  if (!gl_context.getShaderParameter(shader, gl_context.COMPILE_STATUS)) {
    console.log('Cannot compile shaders:' + gl_context.getShaderInfoLog(shader));
    gl_context.deleteShader(shader);
    return null;
  }
  return shader;
}

export function canvasToImage(input_canvas) {
  if (!input_canvas) {
    console.log('canvasToImage: input_canvas is undefined');
  }

  var new_image = document.createElement("img"); 
  new_image.src = input_canvas.toDataURL();

  return new_image;
}

export function mat4FromArray(output_mat4, array) {
  if (!output_mat4) {
    console.log('mat4FromArray: output_mat4 undefined');
  } else if (!array) {
    console.log('mat4FromArray: array undefined');
  }

  for (var i = 0; i < 16; ++i) {
    output_mat4[i] = array[i];
  }
}