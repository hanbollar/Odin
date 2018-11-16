export default function(params) {
  return `
  #version 100

  uniform sampler2D u_viewProjectionMatrix;
  varying vec3 a_position;
  varying vec3 a_normal;
  varying vec2 a_uv;
  
  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);
    vec3 fragColor = vec3(0.0);
    for (int i = 0; i < ${params.numLights}; ++i) {
      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }
    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}