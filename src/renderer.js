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

    const vs = 
    `   #version 300 es
        in vec4 v_position;
        //uniform mat4 u_viewProj;
        //out vec2 uv_color;
        void main() 
        {
          gl_Position = v_position;
          //uv_color = vec2(v_position[0], v_position[1]);
        }     
    `;



    const fs = 
    `   #version 300 es
        precision mediump float;

        //in vec2 uv_color;
 
        out vec4 fragColor;

        /*
        void main() 
        {
            fragColor = vec4(uv_color[0], uv_color[1], 0.0, 1.0);
        }
        */


        /*
        uniform vec2 resolution;

        void main() 
        {
            // Normalized pixel coordinates (from 0 to 1)
            //vec2 uv = vec2(gl_FragCoord.x, gl_FragCoord.y) / resolution.xy;

            // Output to screen
            //gl_FragColor = vec4(uv, 0.0, 1.0);
        }
        */

        // resources: https://github.com/nicoptere/raymarching-for-THREE

        uniform vec2 resolution;
        uniform float time;
        uniform float fov;
        uniform float raymarchMaximumDistance;
        uniform float raymarchPrecision;
        uniform vec3 camera;
        uniform vec3 target;

        //uniform samplerCube cubemap;
        uniform vec3 anchors[15];


        //uses most of the StackGL methods
        //https://github.com/stackgl

        //https://github.com/hughsk/glsl-square-frame

        vec2 squareFrame(vec2 screenSize) {
          vec2 position = 2.0 * (gl_FragCoord.xy / screenSize.xy) - 1.0;
          position.x *= screenSize.x / screenSize.y;
          return position;
        }
        vec2 squareFrame(vec2 screenSize, vec2 coord) {
          vec2 position = 2.0 * (coord.xy / screenSize.xy) - 1.0;
          position.x *= screenSize.x / screenSize.y;
          return position;
        }

        //https://github.com/stackgl/glsl-look-at/blob/gh-pages/index.glsl

        mat3 calcLookAtMatrix(vec3 origin, vec3 target, float roll) {
          vec3 rr = vec3(sin(roll), cos(roll), 0.0);
          vec3 ww = normalize(target - origin);
          vec3 uu = normalize(cross(ww, rr));
          vec3 vv = normalize(cross(uu, ww));
          return mat3(uu, vv, ww);
        }

        //https://github.com/stackgl/glsl-camera-ray

        vec3 getRay(mat3 camMat, vec2 screenPos, float lensLength) {
          return normalize(camMat * vec3(screenPos, lensLength));
        }
        vec3 getRay(vec3 origin, vec3 target, vec2 screenPos, float lensLength) {
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
            float d = length( ( p * transform )-pos ) - radius;
            return vec2(d,0.);
        }

        vec2 sphere( vec3 p, float radius, vec3 pos )
        {
            float d = length( p -pos ) - radius;
            return vec2(d,0.);
        }

        vec2 roundBox(vec3 p, vec3 size, float corner, vec3 pos, vec4 quat )
        {
            mat3 transform = rotationMatrix3( quat.xyz, quat.w );
            return vec2( length( max( abs( ( p-pos ) * transform )-size, 0.0 ) )-corner,1.);
        }

        vec2 line( vec3 p, vec3 a, vec3 b, float r )
        {
            vec3 pa = p - a, ba = b - a;
            float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
            return vec2( length( pa - ba*h ) - r, 1. );
        }

        vec2 sdCappedCone( in vec3 p, in float h, in float r1, in float r2 )
        {
            vec2 q = vec2( length(p.xz), p.y );
            
            vec2 k1 = vec2(r2,h);
            vec2 k2 = vec2(r2-r1,2.0*h);
            vec2 ca = vec2(q.x-min(q.x,(q.y < 0.0)?r1:r2), abs(q.y)-h);
            vec2 cb = q - k1 + k2*clamp( dot(k1-q,k2)/dot(k2, k2), 0.0, 1.0 );
            float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
            return vec2( s*sqrt( min(dot(ca, ca),dot(cb,cb)) ), 1.0);
        }

        //operations

        vec2 unionAB(vec2 a, vec2 b){return vec2(min(a.x, b.x),1.);}
        vec2 intersectionAB(vec2 a, vec2 b){return vec2(max(a.x, b.x),1.);}
        vec2 blendAB( vec2 a, vec2 b, float t ){ return vec2(mix(a.x, b.x, t ),1.);}
        vec2 subtract(vec2 a, vec2 b){ return vec2(max(-a.x, b.x),1.); }
        //http://iquilezles.org/www/articles/smin/smin.htm
        vec2 smin( vec2 a, vec2 b, float k ) { float h = clamp( 0.5+0.5*(b.x-a.x)/k, 0.0, 1.0 ); return vec2( mix( b.x, a.x, h ) - k*h*(1.0-h), 1. ); }
        float smin( float a, float b, float k ) { float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 ); return mix( b, a, h ) - k*h*(1.0-h); }

        //http://www.pouet.net/topic.php?post=367360
        const vec3 pa = vec3(1., 57., 21.);
        const vec4 pb = vec4(0., 57., 21., 78.);
        
        float perlin(vec3 p) 
        {
            vec3 i = floor(p);
            vec4 a = dot( i, pa ) + pb;
            vec3 f = cos((p-i)*acos(-1.))*(-.5)+.5;
            a = mix(sin(cos(a)*a),sin(cos(1.+a)*(1.+a)), f.x);
            a.xy = mix(a.xz, a.yw, f.y);
            return mix(a.x, a.y, f.z);
        }

        float zigzag( float x, float m )
        {
            return abs( mod( x, (2.*m) ) -m);
        }

        /////////////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////////////

        const int raymarchSteps = 50;
        const float PI = 3.14159;

        //no height
        vec2 plane( vec3 p , vec3 n) { return vec2( dot(p, n), 1. ); }
        //with height
        vec2 plane( vec3 p , vec4 n) { return vec2( dot(p, n.xyz) + n.w, 1. ); }

        vec2 field( vec3 position )
        {
            //position
            vec3 zero = vec3(0.);

            //rotation
            vec4 quat = vec4( 1.0, 0.0, 0.0, 0.5 );

            float rad = 500.;
            vec3 dir = vec3(.0,.0, time * 4.);
            //vec2 ground = sphere( position + perlin( ( position + dir ) * .1 ), rad, vec3( 0.,-rad + 2.,0. ) );
            //ground = unionAB( ground, plane( position - vec3( 0.,100.,0. ), vec3( 0.,-1.,0. ) ) );

            float o = zigzag( position.x, .25 ) + zigzag( position.x, .21 );

            float radius = .5;
            float blendFactor = 0.4;
            dir = vec3( 0., -time * 3., 0. );

            float s = fract( sin( sin( floor( position.x / 0.01 ) * 2. ) / 0.01 ) * 10. ) * 0.;

            // head
            //vec2 skeleton = line( position, anchors[0] + vec3(0.,1.,0.), anchors[1], .5 );
            vec2 skeleton = sphere( position, radius * 2.2, (anchors[0] + anchors[1]) / 2.0 + vec3(0.,1.,0.));

            //blend distance (color blend)
            float dis0 = skeleton.x;

            //left arm
            skeleton = smin( skeleton, line( position, anchors[1], anchors[2], radius ), blendFactor ); //shoulder L
            skeleton = smin( skeleton, line( position, anchors[2], anchors[3], radius ), blendFactor );
            skeleton = smin( skeleton, line( position, anchors[3], anchors[4], radius ), blendFactor );

            //right arm
            skeleton = smin( skeleton, line( position, anchors[1], anchors[5], radius ), blendFactor ); //shoulder R
            skeleton = smin( skeleton, line( position, anchors[5], anchors[6], radius ), blendFactor );
            skeleton = smin( skeleton, line( position, anchors[6], anchors[7], radius ), blendFactor );

            //spine
            skeleton = smin( skeleton, line( position, anchors[1], anchors[8], radius * 2.5 ), blendFactor );

            //belly
            skeleton = smin( skeleton, sphere( position, radius * 3.5, anchors[8] ), blendFactor );

            //left leg
            skeleton = smin( skeleton, line( position, anchors[9], anchors[10], radius ), blendFactor );
            skeleton = smin( skeleton, line( position, anchors[10], anchors[11], radius ), blendFactor );

            //right leg
            skeleton = smin( skeleton, line( position, anchors[12], anchors[13], radius ), blendFactor );
            skeleton = smin( skeleton, line( position, anchors[13], anchors[14], radius ), blendFactor * 1.5 );

            vec2 _out = skeleton;
            _out.y = smoothstep( 0., dis0, _out.x );
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
                dist  += latest;
                type = result.y;
            }

            vec2 res    = vec2(-1.0, -1.0 );
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

        vec3 calcNormal(vec3 pos) {
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
            //gl_FragColor = vec4(mix( col, vec3(1.), screenPos.y), 1. );
            fragColor = vec4(0.3, 0.3, 0.34, 1. );
            
            if ( collision.x > -0.5)
            {

                vec3 pos = camera + rayDirection * collision.x;

                vec3 nor = calcNormal( pos,.1 );
                //vec3 tex = textureCube( cubemap, nor ).rgb;

                //col = mix( col, tex, collision.y );

                col = col * rimlight( pos, nor ) + nor * .2;

                fragColor = vec4( col, 1. );
            }

        }
    `;





    // shader program
    this.shader_program = initShaderProgram(gl, vs, fs);

    this.locations = {
        v_position: gl.getAttribLocation(this.shader_program, 'v_position'),
        u_MVP: gl.getUniformLocation(this.shader_program, 'u_viewProj'),

        resolution: gl.getUniformLocation(this.shader_program, 'resolution'),
        camera: gl.getUniformLocation(this.shader_program, 'camera'),
        target: gl.getUniformLocation(this.shader_program, 'target'),
        time: gl.getUniformLocation(this.shader_program, 'time'),
        randomSeed: gl.getUniformLocation(this.shader_program, 'randomSeed'),
        fov: gl.getUniformLocation(this.shader_program, 'fov'),
        raymarchMaximumDistance: gl.getUniformLocation(this.shader_program, 'raymarchMaximumDistance'),
        raymarchPrecision: gl.getUniformLocation(this.shader_program, 'raymarchPrecision'),
        
        anchors: gl.getUniformLocation(this.shader_program, 'anchors')
    };

    // variables to be used in program
    this.quad_vertex_buffer_data = new Float32Array([ 
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0]);
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
    // clear all values before redrawing
    gl.clearColor(0.2, 0.0, 0.2, 1.0);  
    gl.clearDepth(1.0);                 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  

    // useMe()
    gl.useProgram(this.shader_program);

    // vbo
    var quad_vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.quad_vertex_buffer_data, gl.STATIC_DRAW);
    
    // vao
    gl.enableVertexAttribArray(this.locations.v_position);
    gl.vertexAttribPointer(this.locations.v_position, 2, gl.FLOAT, false, 0, 0);
    
    // uniforms
    gl.uniformMatrix4fv(this.locations.u_viewProj, false, this.VP);

    // for sdf walking
    gl.uniform2f(this.locations.resolution, this.canvas_dimensions[0], this.canvas_dimensions[1]);
    gl.uniform1f(this.locations.time, (Date.now() - this.startTime) * .001);
    gl.uniform1f(this.locations.randomSeed, Math.random());
    gl.uniform1f(this.locations.fov, camera.fov * Math.PI / 180);
    gl.uniform1f(this.locations.raymarchMaximumDistance, 500);
    gl.uniform1f(this.locations.raymarchPrecision, 0.001);
    gl.uniform3f(this.locations.camera, camera.position.x, camera.position.y, camera.position.z);
    gl.uniform3f(this.locations.target, 0, 0, 0);
    // NOTE gl.uniform3fv takes in ARRAY OF FLOATS, NOT ARRAY OF VEC3S
    // [vec3(1, 2, 3), vec3(4, 5, 6)] must be converted to [1, 2, 3, 4, 5, 6]
    gl.uniform3fv(this.locations.anchors, this.walker.update());

    // draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // after draw
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);        
  }

}

export default Renderer;