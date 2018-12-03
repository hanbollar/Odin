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

export function canvasToImage(input_canvas) {
  if (!input_canvas) {
    console.log('canvasToImage: input_canvas is undefined');
  }

  var new_image = document.createElement("img"); 
  new_image.src = input_canvas.toDataURL();

  return new_image;
}

function loadImage(imageSource, context)
{
    var imageObj = new Image();
    imageObj.onload = function()
    {
        context.drawImage(imageObj, 0, 0);
        var imageData = context.getImageData(0,0,10,10);
        readImage(imageData);
    };
    imageObj.src = imageSource;
    return imageObj;
}

export function draw2dImage(input_canvas, context2d, strDataURI) {
    "use strict";
    var img = new window.Image();
    img.addEventListener("load", function () {
        context2d.drawImage(img, 0, 0);
    });
    img.setAttribute("src", strDataURI);
    return img;
}

export function resizeCanvas(input_canvas) {
    // Lookup the size the browser is displaying the canvas.
  var displayWidth  = input_canvas.clientWidth;
  var displayHeight = input_canvas.clientHeight;
 
  // Check if the canvas is not the same size.
  if (input_canvas.width  != displayWidth ||
      input_canvas.height != displayHeight) {
 
    // Make the canvas the same size
    input_canvas.width  = displayWidth;
    input_canvas.height = displayHeight;
  }
  return input_canvas;
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