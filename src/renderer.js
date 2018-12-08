import { camera, cameraControls, gui, gl, canvas, resizeCanvas } from './init';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { initShaderProgram, mat4FromArray } from './utils';
import Walker from './walker.js'

class Renderer 
{
  constructor() 
  {
    this.startTime = Date.now();
    this.walker = new Walker();

    // SET THESE TWO VARIABLES
    this.worldDimension = 1000.0;
    this.numAgents = 16 * Math.pow(4, 0); // must be 16 times a power of 4

    this.texDimension = Math.sqrt(this.numAgents * 16);


    // main shader program
    //
    // crowd_vertex_shader_src, crowd_fragment_shader_src 
    // are from shaders.js built by GRUNT, look at Gruntfile.js
    // https://gruntjs.com/getting-started
    // https://www.npmjs.com/package/grunt-glsl
    //
    // WHENEVER YOU UPDATE A SHADER, RUN grunt IN COMMAND LINE
    //
    // HOW TO INSTALL GRUNT:
    // npm install grunt-glsl
    // sudo npm install -g grunt-cli
    // npm install
    // grunt
    this.tex_shader_program = initShaderProgram(gl, tex_vertex_shader_src, tex_fragment_shader_src);
    this.crowd_shader_program = initShaderProgram(gl, crowd_vertex_shader_src, crowd_fragment_shader_src);

    this.tex_uniforms =
    {
        v_position: gl.getAttribLocation(this.tex_shader_program, 'v_position'),
        agentPositions: gl.getUniformLocation(this.tex_shader_program, 'agentPositions'),
        agentForwards: gl.getUniformLocation(this.tex_shader_program, 'agentForwards'),
        agentTimeOffsets: gl.getUniformLocation(this.tex_shader_program, 'agentTimeOffsets'),
        time: gl.getUniformLocation(this.tex_shader_program, 'time'),
        texDim: gl.getUniformLocation(this.tex_shader_program, 'texDim'),
        worldDim: gl.getUniformLocation(this.tex_shader_program, 'worldDim'),
    };

    this.crowd_uniforms = 
    {
        v_position: gl.getAttribLocation(this.crowd_shader_program, 'v_position'),
        u_MVP: gl.getUniformLocation(this.crowd_shader_program, 'u_viewProj'),

        resolution: gl.getUniformLocation(this.crowd_shader_program, 'resolution'),
        camera: gl.getUniformLocation(this.crowd_shader_program, 'camera'),
        target: gl.getUniformLocation(this.crowd_shader_program, 'target'),
        time: gl.getUniformLocation(this.crowd_shader_program, 'time'),
        fov: gl.getUniformLocation(this.crowd_shader_program, 'fov'),
        raymarchMaximumDistance: gl.getUniformLocation(this.crowd_shader_program, 'raymarchMaximumDistance'),
        raymarchPrecision: gl.getUniformLocation(this.crowd_shader_program, 'raymarchPrecision'),
        
        //anchors: gl.getUniformLocation(this.crowd_shader_program, 'anchors'),

        u_image: gl.getUniformLocation(this.crowd_shader_program, 'u_image'),
        texDim: gl.getUniformLocation(this.crowd_shader_program, 'texDim'),
        worldDim: gl.getUniformLocation(this.crowd_shader_program, 'worldDim'),
    };

    // variables to be used in program
    this.quad_vertex_buffer_data = new Float32Array([ 
        -1.0, -1.0, 0.0, 1.0,
         1.0, -1.0, 0.0, 1.0,
        -1.0,  1.0, 0.0, 1.0,
        -1.0,  1.0, 0.0, 1.0,
         1.0, -1.0, 0.0, 1.0,
         1.0,  1.0, 0.0, 1.0]);
    this.viewMatrix = mat4.create();
    this.projectionMatrix = mat4.create();
    this.VP = mat4.create();
    this.canvas_dimensions = vec2.create();
  }


  update() 
  {
    this.time += 1;
    //console.log('time:'+ this.time);

    // updating values
    mat4FromArray(this.viewMatrix, camera.modelViewMatrix.elements);
    mat4FromArray(this.projectionMatrix, camera.projectionMatrix.elements);
    mat4.multiply(this.VP, this.projectionMatrix, this.viewMatrix);

    this.canvas_dimensions[0] = canvas.clientWidth;
    this.canvas_dimensions[1] = canvas.clientHeight;

    // draw
    this.drawScene();
  }

  drawScene() 
  {
    
    // FOR RENDERING TO TEXTURE

    gl.viewport(0, 0, this.texDimension, this.texDimension);

    // insert frame buffer code here
    // for more info on gl framebuffer texture functions:
    // http://math.hws.edu/graphicsbook/c7/s4.html

    var agent_tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, agent_tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.texDimension, this.texDimension, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, agent_tex, 0);

    /*
    var rbo = GL.createRenderbuffer()
    GL.bindRenderbuffer(GL.RENDERBUFFER, rbo)
    GL.renderbufferStorage(GL.RENDERBUFFER, GL.DEPTH_COMPONENT16, width, height)
    */

    //gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, agent_tex, 0);
    //GL.framebufferRenderbuffer(GL.FRAMEBUFFER, GL.DEPTH_ATTACHMENT, GL.RENDERBUFFER, rbo)

    gl.useProgram(this.tex_shader_program);
    
    gl.clear( gl.DEPTH_BUFFER_BIT )

    // vbo
    var tex_vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tex_vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.quad_vertex_buffer_data, gl.STATIC_DRAW);
    
    // vao
    gl.enableVertexAttribArray(this.tex_uniforms.v_position);
    gl.vertexAttribPointer(this.tex_uniforms.v_position, 4, gl.FLOAT, false, 0, 0);

    // uniforms

    var agentPos = [];
    for (var i = 0; i < this.numAgents; i++)
    {
        try { throw i }
        catch (pos)
        {
            agentPos.push(0.0 + 20*pos);
            agentPos.push(0.0);
            agentPos.push(0.0);
        }
    }
    gl.uniform3fv(this.tex_uniforms.agentPositions, agentPos);

    var agentFwd = [];
    for (var j = 0; j < this.numAgents; j++)
    {
        try { throw j }
        catch (fwd)
        {
            agentFwd.push(0.0);
            agentFwd.push(0.0);
            agentFwd.push(1.0);
        }
    }
    gl.uniform3fv(this.tex_uniforms.agentForwards, agentFwd);

    var agentOff = [];
    for (var k = 0; k < this.numAgents; k++)
    {
        try { throw k }
        catch (off)
        {
            //agentOff.push(off * 22.5);
            agentOff.push(0.0);
        }
    }
    gl.uniform1fv(this.tex_uniforms.agentTimeOffsets, agentOff);

    gl.uniform1f(this.tex_uniforms.time, (Date.now() - this.startTime) * .001);
    gl.uniform1i(this.tex_uniforms.texDim, this.texDimension);
    gl.uniform1f(this.tex_uniforms.worldDim, this.worldDimension);
    

    // FINALLY, draw, 6 vertices because double sided
    gl.drawArrays(gl.TRIANGLES, 0, 6);







    // FOR CROWD SIMULATION MAIN SCENE

    // fixes resizing window
    gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);

    // Now draw the main scene, which is 3D, using the texture.
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Draw to default framebuffer.


    // clear all values before redrawing
    gl.clearColor(0.2, 0.0, 0.2, 1.0);  
    gl.clearDepth(1.0);                 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  

    // useMe()
    gl.useProgram(this.crowd_shader_program);

    // vbo
    var quad_vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.quad_vertex_buffer_data, gl.STATIC_DRAW);
    
    // vao
    gl.enableVertexAttribArray(this.crowd_uniforms.v_position);
    gl.vertexAttribPointer(this.crowd_uniforms.v_position, 4, gl.FLOAT, false, 0, 0);
    
    // uniforms
    gl.uniformMatrix4fv(this.crowd_uniforms.u_viewProj, false, this.VP);

    // for sdf walking
    gl.uniform2f(this.crowd_uniforms.resolution, canvas.clientWidth, canvas.clientHeight);
    gl.uniform1f(this.crowd_uniforms.time, (Date.now() - this.startTime) * .001);
    gl.uniform1f(this.crowd_uniforms.fov, camera.fov * Math.PI / 180);
    gl.uniform1f(this.crowd_uniforms.raymarchMaximumDistance, 500);
    gl.uniform1f(this.crowd_uniforms.raymarchPrecision, 0.001);
    gl.uniform3f(this.crowd_uniforms.camera, camera.position.x, camera.position.y, camera.position.z);
    gl.uniform3f(this.crowd_uniforms.target, 0, 0, 0);

    // NOTE gl.uniform3fv takes in ARRAY OF FLOATS, NOT ARRAY OF VEC3S
    // [vec3(1, 2, 3), vec3(4, 5, 6)] must be converted to [1, 2, 3, 4, 5, 6]
    //gl.uniform3fv(this.crowd_uniforms.anchors, this.walker.update());

    gl.uniform1i(this.crowd_uniforms.texDim, this.texDimension);
    gl.uniform1f(this.crowd_uniforms.worldDim, this.worldDimension);
    

    // passing agent data texture to crowd shader
    gl.uniform1i(this.crowd_uniforms.u_image, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, agent_tex);


    // draw, 6 vertices because double sided
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // after draw
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);        
  }
}

export default Renderer;