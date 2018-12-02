//#gljs varname: 'tex_fragment_shader_src' 

precision highp float;
uniform sampler2D u_image0; 
uniform sampler2D u_image1;
uniform sampler2D u_comfortMap; 
uniform bool u_useComfortMap;
uniform vec2 windowSize;
uniform float numAgents;

varying vec2 fs_uv;

const int R = 1337;
const int RES = 10;

int toID(vec4 col) {
  return int(col.r*float(RES)+0.5) + int(col.g*float(RES)+0.5)*RES + int(col.b*float(RES)+0.5)*RES*RES;
}

void main(void) {
  vec4 col = texture2D(u_image0, fs_uv);
  int id = toID(col);
  vec4 data = texture2D(u_image1, vec2(float(id)/(numAgents-0.5), 0.0));
  vec3 pos = vec3(data.xy, 0);
  vec3 gol = vec3(data.zw, 0);
  vec3 golVec = gol - pos;

  vec3 marker = 2.0*vec3(fs_uv, 0) - vec3(1,1,0);
  vec3 markerVec = vec3(fs_uv, 0) - pos;
  float weight = 1.0 + dot(normalize(markerVec), normalize(golVec));

  weight *= (
    (1.0 - float(u_useComfortMap)) + 
    float(u_useComfortMap)*texture2D(u_comfortMap, fs_uv).x
  );
  bool mask = length(markerVec) < float(R) / windowSize.x;
  weight = float(mask) * weight;

  gl_FragColor = vec4(weight,weight,weight,1);
}