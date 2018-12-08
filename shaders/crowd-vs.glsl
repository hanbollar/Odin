//#gljs varname: 'crowd_vertex_shader_src' 

#version 300 es

in vec4 v_position;
//uniform mat4 u_viewProj;
//out vec2 uv_color;

void main() 
{
  gl_Position = v_position;
  //uv_color = vec2(v_position[0], v_position[1]);
}     