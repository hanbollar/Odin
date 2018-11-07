export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_view_matrix;
  uniform vec2 u_screen_dimensions;
  uniform float u_near_clip;
  uniform float u_far_clip;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    int u_slices_x = ${params.slices_x};
    int u_slices_y = ${params.slices_y};
    int u_slices_z = ${params.slices_z};

    vec4 camera_pos4 = u_view_matrix * vec4(v_position, 1.0);
    vec3 camera_pos3 = vec3(camera_pos4);

    // locate fragment's cluster
    int loc_x = int(gl_FragCoord.x * float(u_slices_x) / u_screen_dimensions.x);
    int loc_y = int(gl_FragCoord.y * float(u_slices_y) / u_screen_dimensions.y);
    int loc_z = int((-camera_pos4.z - u_near_clip) * float(u_slices_z) / (u_far_clip - u_near_clip));

    // get rest of cluster information - left as floats for math ease
    int index_of_cluster =  loc_x
                          + loc_y * u_slices_x
                          + loc_z * u_slices_x * u_slices_y;
    int num_clusters = u_slices_x * u_slices_y * u_slices_z;

    // offset by 1 for both bc indexing in [0, length - 1]
    vec2 tex_uv = vec2( float(index_of_cluster + 1) / float(num_clusters + 1),
                        0);

    int light_count = int(texture2D(u_clusterbuffer, tex_uv)[0]);
    float texture_height = floor(float(${params.numLights_perCluster} + 1) * 0.25) + 1.0;

    // begin color calculation based on cluster information
    vec3 fragColor = vec3(0.0);
    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i >= light_count) {
        break;
      }

      float next = float(i + 1);

      // texel: 'pixel' in the texture
      // find texel's information
      // having indexing issue in method so rewriting impl here
      float texel_idx = floor(next * 0.25);
      tex_uv[1] = (texel_idx + 1.0) / (texture_height + 1.0);
      vec4 texel = texture2D(u_clusterbuffer, tex_uv);
      int texel_component = int(next - 4.0 * texel_idx);
      // note: cant just call array loc on texel_component value bc non const, so doesnt compile
      float light_index = (texel_component == 0) ? texel[0] :
                          (texel_component == 1) ? texel[1] :
                          (texel_component == 2) ? texel[2] :
                                                   texel[3];

      // doing the lighting calculations
      Light light = UnpackLight(int(light_index));
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      // regular shading
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      // blinn-phong
      vec3 half_vec_for_calc = normalize(L + camera_pos3 - v_position);
      float specularTerm = pow(max(dot(normal, half_vec_for_calc), 0.0), 2000.0);
       fragColor += (albedo + vec3(specularTerm)) * lambertTerm * light.color * lightIntensity;
    }


    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
