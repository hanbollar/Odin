export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;
  
  // Redoing the impl from ForwardPlus to get texel index
  uniform mat4 u_view_matrix;
  uniform mat4 u_view_matrix_inverse;
  uniform vec2 u_screen_dimensions;
  uniform float u_near_clip;
  uniform float u_far_clip;
  
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
    // extract data from g buffers and do lighting
    // vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    // vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    // vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    // while not optimized:

    vec3 pos = gb1.xyz;
    vec3 albedo = gb0.xyz;

    // recreating the full compressed norm from the two given values x, y
    vec3 nor = vec3(gb0.w,
                    gb1.w,
                    sqrt(1.0 - gb0.w * gb0.w - gb1.w * gb1.w));

    // texturing using g_buffer
    int u_slices_x = ${params.slices_x};
    int u_slices_y = ${params.slices_y};
    int u_slices_z = ${params.slices_z};

    vec4 camera_pos4 = u_view_matrix * vec4(pos, 1.0);
    vec3 camera_pos3 = vec3(camera_pos4);
    vec3 regular_pos3 = vec3(u_view_matrix_inverse * vec4(0, 0, 0, 1));

    // locate fragment's cluster
    float loc_x = gl_FragCoord.x * float(u_slices_x) / u_screen_dimensions.x;
    float loc_y = gl_FragCoord.y * float(u_slices_y) / u_screen_dimensions.y;
    float loc_z = (-camera_pos4.z - u_near_clip) * float(u_slices_z) / (u_far_clip - u_near_clip);

    // get rest of cluster information - left as floats for math ease
    float index_of_cluster =  loc_x + loc_x * float(u_slices_y) + loc_x * float(u_slices_y * u_slices_y);
    float num_clusters = float(u_slices_x * u_slices_y * u_slices_z);

    // offset by 1 for both bc indexing in [0, length - 1]
    // below method has indexing issue - clamping somewhere by cast in it?
    int light_count = int(ExtractFloat( u_clusterbuffer,
                                        int(num_clusters),
                                        ${params.numLights_perCluster},
                                        int(index_of_cluster),
                                        0));
    // instead:
    // vec2 tex_uv = vec2( (index_of_cluster + 1.0) / (num_clusters + 1.0),
    //                     0);
    // int light_count = int(texture2D(u_clusterbuffer, tex_uv)[0]);

    float texture_height = floor(float(${params.numLights_perCluster} + 1) * 0.25) + 1.0;

    vec3 fragColor = vec3(0.0);
    for (int i = 0; i < ${params.numLights_perCluster}; ++i) {
      if (i >= light_count) {
        break;
      }

      float next = float(i + 1);

      // below method has indexing issue - clamping somewhere by cast in it?
      float light_index = ExtractFloat(u_clusterbuffer, int(num_clusters), int(texture_height), int(index_of_cluster), (i + 1));
      // instead:
      // // texel: 'pixel' in the texture
      // // find texel's information
      // // having indexing issue in method so rewriting impl here
      // float texel_idx = floor(next * 0.25);
      // tex_uv[1] = (texel_idx + 1.0) / (texture_height + 1.0);
      // vec4 texel = texture2D(u_clusterbuffer, tex_uv);
      // int texel_component = int(next - 4.0 * texel_idx);
      // // note: cant just call array loc on texel_component value bc non const, so doesnt compile
      // float light_index = (texel_component == 0) ? texel[0] :
      //                     (texel_component == 1) ? texel[1] :
      //                     (texel_component == 2) ? texel[2] :
      //                                              texel[3];

      // doing the lighting calculations
      Light light = UnpackLight(int(light_index));
      float lightDistance = distance(light.position, pos);
      vec3 L = (light.position - pos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, nor), 0.0);

      // regular shading
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      // blinn-phong
      // vec3 half_vec_for_calc = vec3(normalize(vec4(L + regular_pos3 - pos, 1.0)));
      // float specularTerm = pow(max(dot(nor, half_vec_for_calc), 0.0), 200.0);
      // fragColor += (albedo + vec3(specularTerm)) * lambertTerm * light.color * lightIntensity;
    }

    int coloring_id = 10;
    if (coloring_id == 0) {
      // original, just screenspace
      gl_FragColor = vec4(v_uv, 0.0, 1.0);
      return;
    } else if (coloring_id == 1) {
      // color by depth
      float val = (-camera_pos4.z - u_near_clip);
      gl_FragColor = vec4(val, val, val, 1.0);
      return;
    } else if (coloring_id == 2) {
      // color by normal
      gl_FragColor = vec4(abs(nor.x), abs(nor.y), abs(nor.z), 1.0);
      //gl_FragColor = nor_temp;
      return;
    } else if (coloring_id == 3) {
      gl_FragColor = vec4(albedo, 1.0);
      return;
    } else {
      gl_FragColor = vec4(normalize(fragColor), 1.0);
    }
    
  }
  `;
}