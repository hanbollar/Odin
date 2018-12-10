//#gljs varname: 'crowd_vertex_shader_src' 

#version 300 es

in vec4 v_position;

void main() 
{
  gl_Position = v_position;
}     