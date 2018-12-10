//#gljs varname: 'crowd_fragment_shader_src' 

#version 300 es

precision mediump float;

out vec4 fragColor;


/*
// AGENT RENDER TO TEXTURE DATA DEBUGGER

uniform vec2 resolution;
uniform sampler2D u_image;

void main() 
{
    // Normalized pixel coordinates (from 0 to 1)
    //vec2 uv = vec2(gl_FragCoord.x, gl_FragCoord.y) / resolution.xy;
    // Output to screen
    //fragColor = vec4(uv, 0.0, 1.0);


    vec2 texCoord = vec2(gl_FragCoord.x / resolution.x, gl_FragCoord.y / resolution.y);
    vec4 colour = texture(u_image, texCoord.xy);
    fragColor = colour;
}
*/


// resources: https://github.com/nicoptere/raymarching-for-THREE

#define FLT_MAX 3.402823466e+38

#define NUM_AGENTS 16
#define JOINT_TEX_SCALE 50.0
#define AGENT_BOUNDING_HEIGHT 18.0
#define AGENT_BOUNDING_RAD 7.0

uniform vec2 resolution;
uniform float time;
uniform float fov;
uniform float raymarchMaximumDistance;
uniform float raymarchPrecision;
uniform vec3 camera;
uniform vec3 target;
uniform sampler2D u_image; 
uniform int texDim;
uniform float worldDim;
//uniform vec3 joints[15];
uniform float agentRadius[NUM_AGENTS];


//uses most of the StackGL methods
//https://github.com/stackgl

//https://github.com/hughsk/glsl-square-frame

vec2 squareFrame(vec2 screenSize) 
{
  vec2 position = 2.0 * (gl_FragCoord.xy / screenSize.xy) - 1.0;
  position.x *= screenSize.x / screenSize.y;
  return position;
}

vec2 squareFrame(vec2 screenSize, vec2 coord) 
{
  vec2 position = 2.0 * (coord.xy / screenSize.xy) - 1.0;
  position.x *= screenSize.x / screenSize.y;
  return position;
}

//https://github.com/stackgl/glsl-look-at/blob/gh-pages/index.glsl

mat3 calcLookAtMatrix(vec3 origin, vec3 target, float roll) 
{
  vec3 rr = vec3(sin(roll), cos(roll), 0.0);
  vec3 ww = normalize(target - origin);
  vec3 uu = normalize(cross(ww, rr));
  vec3 vv = normalize(cross(uu, ww));
  return mat3(uu, vv, ww);
}

//https://github.com/stackgl/glsl-camera-ray

vec3 getRay(mat3 camMat, vec2 screenPos, float lensLength) 
{
  return normalize(camMat * vec3(screenPos, lensLength));
}

vec3 getRay(vec3 origin, vec3 target, vec2 screenPos, float lensLength) 
{
  mat3 camMat = calcLookAtMatrix(origin, target, 0.0);
  return getRay(camMat, screenPos, lensLength);
}

/////////////////////////////////////////////////////////////////////////

mat3 rotationMatrix3(vec3 axis, float angle)
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;

    return mat3(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c          );
}

/////////////////////////////////////////////////////////////////////////

//primitives

vec2 sphere( vec3 p, float radius, vec3 pos , vec4 quat)
{
    mat3 transform = rotationMatrix3( quat.xyz, quat.w );
    float d = length( ( p * transform ) - pos ) - radius;
    return vec2(d, 0.0);
}

vec2 sphere( vec3 p, float radius, vec3 pos )
{
    float d = length( p -pos ) - radius;
    return vec2(d, 0.0);
}

vec2 roundBox(vec3 p, vec3 size, float corner, vec3 pos, vec4 quat )
{
    mat3 transform = rotationMatrix3( quat.xyz, quat.w );
    return vec2( length( max( abs( (p - pos) * transform ) - size, 0.0 ) ) - corner, 1.0);
}

vec2 line( vec3 p, vec3 a, vec3 b, float r )
{
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa, ba) / dot(ba, ba), 0.0, 1.0 );
    return vec2( length(pa - ba*h) - r, 1.0 );
}

// same as line function, just for clarity
vec2 capsule( vec3 p, vec3 a, vec3 b, float r )
{
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return vec2( length( pa - ba*h ) - r, 1.0);
}

//operations

vec2 unionAB(vec2 a, vec2 b) 
{ 
    return vec2( min(a.x, b.x), 1.0); 
}

vec2 intersectionAB(vec2 a, vec2 b) 
{ 
    return vec2( max(a.x, b.x), 1.0); 
}

vec2 blendAB( vec2 a, vec2 b, float t ) 
{ 
    return vec2( mix(a.x, b.x, t ), 1.0); 
}

vec2 subtract(vec2 a, vec2 b) 
{ 
    return vec2( max(-a.x, b.x), 1.0); 
}

//http://iquilezles.org/www/articles/smin/smin.htm

vec2 smin( vec2 a, vec2 b, float k ) 
{ 
    float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0); 
    return vec2(mix( b.x, a.x, h ) - k * h * (1.0 - h), 1.0); 
}

float smin( float a, float b, float k ) 
{ 
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); 
    return mix(b, a, h) - k * h * (1.0 - h); 
}

//http://www.pouet.net/topic.php?post=367360
const vec3 pa = vec3(1.0, 57.0, 21.0);
const vec4 pb = vec4(0.0, 57.0, 21.0, 78.0);

/////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////

const int raymarchSteps = 50;
const float PI = 3.14159;

vec2 field( vec3 position )
{
    vec2 skeleton = vec2(FLT_MAX, 1.0);

    for (int agentY = 0; agentY < texDim; agentY++)
    {
        for (int agentX = 0; agentX < texDim / 16; agentX = agentX + 16)
        {
            vec2 uvStartPos = vec2(float(agentX) + 0.5, float(agentY) + 0.5);
            vec3 agentPos = (texture(u_image, (uvStartPos / float(texDim) )).xyz - vec3(0.5)) * worldDim;

            // CAPSULE BOUNDING BOX OPTIMIZATION
            // skeleton = smin(skeleton, capsule( position, agentPos, agentPos + vec3(0.0, AGENT_BOUNDING_HEIGHT, 0.0), AGENT_BOUNDING_RAD), 0.0);
            if (capsule( position, agentPos, agentPos + vec3(0.0, AGENT_BOUNDING_HEIGHT, 0.0), AGENT_BOUNDING_RAD).x < AGENT_BOUNDING_RAD)
            {
              vec3 joint0  = texture(u_image, (uvStartPos + vec2( 1.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint1  = texture(u_image, (uvStartPos + vec2( 2.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint2  = texture(u_image, (uvStartPos + vec2( 3.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint3  = texture(u_image, (uvStartPos + vec2( 4.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint4  = texture(u_image, (uvStartPos + vec2( 5.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint5  = texture(u_image, (uvStartPos + vec2( 6.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint6  = texture(u_image, (uvStartPos + vec2( 7.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint7  = texture(u_image, (uvStartPos + vec2( 8.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint8  = texture(u_image, (uvStartPos + vec2( 9.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint9  = texture(u_image, (uvStartPos + vec2(10.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint10 = texture(u_image, (uvStartPos + vec2(11.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint11 = texture(u_image, (uvStartPos + vec2(12.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint12 = texture(u_image, (uvStartPos + vec2(13.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint13 = texture(u_image, (uvStartPos + vec2(14.0, 0.0)) / float(texDim) ).xyz;
              vec3 joint14 = texture(u_image, (uvStartPos + vec2(15.0, 0.0)) / float(texDim) ).xyz;

              vec3 joints[15] = vec3[]( (joint0  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint1  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint2  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint3  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint4  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint5  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint6  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint7  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint8  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint9  - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint10 - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint11 - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint12 - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint13 - vec3(0.5)) * JOINT_TEX_SCALE + agentPos,
                                         (joint14 - vec3(0.5)) * JOINT_TEX_SCALE + agentPos );

              // float radius = 0.5; 
              // 0.3 to 0.7 is a good range
              float radius = agentRadius[int(agentX / 16) + int(texDim / 16) * agentY];
              float blendFactor = 0.4;

              // head
              skeleton = smin(skeleton, sphere( position, radius*2.3, 0.5 *(joints[0] + joints[1]) + vec3(0.0, 1.0, 0.0) ), blendFactor);

              //left arm
              skeleton = smin(skeleton, line(position, joints[1], joints[2], radius), blendFactor); //shoulder L
              skeleton = smin(skeleton, line(position, joints[2], joints[3], radius), blendFactor);
              skeleton = smin(skeleton, line(position, joints[3], joints[4], radius), blendFactor);

              //right arm
              skeleton = smin(skeleton, line(position, joints[1], joints[5], radius), blendFactor); //shoulder R
              skeleton = smin(skeleton, line(position, joints[5], joints[6], radius), blendFactor);
              skeleton = smin(skeleton, line(position, joints[6], joints[7], radius), blendFactor);

              //spine
              skeleton = smin(skeleton, line(position, joints[1], joints[8], radius * 2.5), blendFactor);

              //belly
              skeleton = smin(skeleton, sphere(position, radius * 3.5, joints[8]), blendFactor);

              //left leg
              skeleton = smin(skeleton, line(position, (0.3*joints[8] + 0.7*joints[9]), joints[10], radius), blendFactor); // shift a bit toward belly
              skeleton = smin(skeleton, line(position, joints[10], joints[11], radius), blendFactor);

              //right leg
              skeleton = smin( skeleton, line( position, (0.3*joints[8] + 0.7*joints[12]), joints[13], radius ), blendFactor); // shift a bit toward belly
              skeleton = smin( skeleton, line( position, joints[13], joints[14], radius ), blendFactor);
            }
            else
            {
              // treat agent as a simple capsule if too far away
              skeleton = smin(skeleton, capsule( position, agentPos, agentPos + vec3(0.0, AGENT_BOUNDING_HEIGHT, 0.0), AGENT_BOUNDING_RAD), 0.0);
            }
            
        }
    }

    vec2 _out = skeleton;
    _out.y = smoothstep( 0.0, 0.0, _out.x );
    return _out;
}

/////////////////////////////////////////////////////////////////////////

// the methods below this need the field function

/////////////////////////////////////////////////////////////////////////

//the actual raymarching from:
//https://github.com/stackgl/glsl-raytrace/blob/master/index.glsl

vec2 raymarching( vec3 rayOrigin, vec3 rayDir, float maxd, float precis ) {

    float latest = precis * 2.0;
    float dist   = 0.0;
    float type   = -1.0;
    for (int i = 0; i < raymarchSteps; i++) {

        if (latest < precis || dist > maxd) break;

        vec2 result = field( rayOrigin + rayDir * dist );
        latest = result.x;
        dist += latest;
        type = result.y;
    }

    vec2 res = vec2(-1.0, -1.0 );
    if (dist < maxd) { res = vec2( dist, type ); }
    return res;

}

//https://github.com/stackgl/glsl-sdf-normal

vec3 calcNormal(vec3 pos, float eps) 
{
  const vec3 v1 = vec3( 1.0,-1.0,-1.0);
  const vec3 v2 = vec3(-1.0,-1.0, 1.0);
  const vec3 v3 = vec3(-1.0, 1.0,-1.0);
  const vec3 v4 = vec3( 1.0, 1.0, 1.0);

  return normalize( v1 * field( pos + v1*eps ).x +
                    v2 * field( pos + v2*eps ).x +
                    v3 * field( pos + v3*eps ).x +
                    v4 * field( pos + v4*eps ).x );
}

vec3 calcNormal(vec3 pos) 
{
  return calcNormal(pos, 0.002);
}

vec3 rimlight( vec3 pos, vec3 nor )
{
    vec3 v = normalize(-pos);
    float vdn = 1.0 - max(dot(v, nor), 0.0);
    return vec3(smoothstep(0., 1.0, vdn));
}

void main() 
{
    vec2 screenPos = squareFrame( resolution );
    vec3 rayDirection = getRay( camera, target, screenPos, fov );
    vec2 collision = raymarching( camera, rayDirection, raymarchMaximumDistance, raymarchPrecision );
    vec3 col = vec3( 0.85 );

    // background color
    //gl_FragColor = vec4(mix( col, vec3(1.), screenPos.y), 1.0 );
    fragColor = vec4(0.30, 0.30, 0.34, 1.0 );
    
    if ( collision.x > -0.5)
    {

        vec3 pos = camera + rayDirection * collision.x;

        vec3 nor = calcNormal( pos, 0.1 );
        //vec3 tex = textureCube( cubemap, nor ).rgb;

        //col = mix( col, tex, collision.y );

        col = col * rimlight( pos + vec3(0.0, worldDim, 0.0), nor ) + nor * 0.2;

        fragColor = vec4( col, 1.0 );
    }

}

