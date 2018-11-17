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
  const vs = loadShader(gl_context, gl_context.VERTEX_SHADER, vsSource);
  const fs = loadShader(gl_context, gl_context.FRAGMENT_SHADER, fsSource);
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

function loadShader(gl_context, type, src) {
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
