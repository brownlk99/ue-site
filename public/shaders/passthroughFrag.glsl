precision mediump float;

uniform sampler2D texturePosition;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;
uniform float speed;
uniform float dieSpeed; 
uniform float radius;
uniform float curlSize;
uniform float attraction;
uniform vec2 mouseScale;
uniform vec2 mouseVelocity;
uniform float windStrength;
uniform float windRadius;
uniform float interactionMode; // 0 = attraction, 1 = wind

// Simple pseudo-random based on UV
float random(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// ============ SIMPLEX NOISE HELPERS ============
// without using the % operator (faster on GPU)
// prime number that prevents patterns
vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

float mod289(float x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

// Pseudo-random permutation - scrambles numbers deterministically
// Same input always gives same output (important for noise)
vec4 permute(vec4 x) {
  return mod289(((x*34.0)+1.0)*x);
}

float permute(float x) {
  return mod289(((x*34.0)+1.0)*x);
}

// Fast approximation of 1/sqrt(x) using Taylor series
// Faster than the real sqrt function
vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float taylorInvSqrt(float r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

// Generates a random 4D gradient vector
// Used to create the "direction" of the noise at each grid point
vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p, s;
  
  p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;
  
  return p;
}

// a magic number for 4D simplex grid math
// (sqrt(5) - 1) / 4 used to skew the coordinate space
#define F4 0.309016994374947451


// ============ 4D SIMPLEX NOISE (returns derivatives + value) ============
vec4 simplexNoise4D(vec4 v) {
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 
                      0.414589803375032, -0.447213595499958);
  
  vec4 i = floor(v + dot(v, vec4(F4)));
  vec4 x0 = v - i + dot(i, C.xxxx);
  
  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  
  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0-1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0-2.0, 0.0, 1.0);
  
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  
  i = mod289(i);
  float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute(permute(permute(permute(
           i.w + vec4(i1.w, i2.w, i3.w, 1.0))
         + i.z + vec4(i1.z, i2.z, i3.z, 1.0))
         + i.y + vec4(i1.y, i2.y, i3.y, 1.0))
         + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
  
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0);
  
  vec4 p0 = grad4(j0, ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));
  
  vec3 values0 = vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2));
  vec2 values1 = vec2(dot(p3, x3), dot(p4, x4));
  
  vec3 m0 = max(0.5 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.5 - vec2(dot(x3,x3), dot(x4,x4)), 0.0);
  
  vec3 temp0 = -6.0 * m0 * m0 * values0;
  vec2 temp1 = -6.0 * m1 * m1 * values1;
  
  vec3 mmm0 = m0 * m0 * m0;
  vec2 mmm1 = m1 * m1 * m1;
  
  // Calculate derivatives
  float dx = temp0[0] * x0.x + temp0[1] * x1.x + temp0[2] * x2.x + temp1[0] * x3.x + temp1[1] * x4.x + mmm0[0] * p0.x + mmm0[1] * p1.x + mmm0[2] * p2.x + mmm1[0] * p3.x + mmm1[1] * p4.x;
  float dy = temp0[0] * x0.y + temp0[1] * x1.y + temp0[2] * x2.y + temp1[0] * x3.y + temp1[1] * x4.y + mmm0[0] * p0.y + mmm0[1] * p1.y + mmm0[2] * p2.y + mmm1[0] * p3.y + mmm1[1] * p4.y;
  float dz = temp0[0] * x0.z + temp0[1] * x1.z + temp0[2] * x2.z + temp1[0] * x3.z + temp1[1] * x4.z + mmm0[0] * p0.z + mmm0[1] * p1.z + mmm0[2] * p2.z + mmm1[0] * p3.z + mmm1[1] * p4.z;
  
  float value = dot(mmm0, values0) + dot(mmm1, values1);
  
  return vec4(dx, dy, dz, value) * 49.0;
}

// ============ CURL NOISE ============
vec3 curl(vec3 p, float noiseTime, float persistence) {
  vec4 xNoisePotentialDerivatives = vec4(0.0);
  vec4 yNoisePotentialDerivatives = vec4(0.0);
  vec4 zNoisePotentialDerivatives = vec4(0.0);
  
  for (int i = 0; i < 3; ++i) {
    float twoPowI = pow(2.0, float(i));
    float scale = 0.5 * twoPowI * pow(persistence, float(i));
    
    xNoisePotentialDerivatives += simplexNoise4D(vec4(p * twoPowI, noiseTime)) * scale;
    yNoisePotentialDerivatives += simplexNoise4D(vec4((p + vec3(123.4, 129845.6, -1239.1)) * twoPowI, noiseTime)) * scale;
    zNoisePotentialDerivatives += simplexNoise4D(vec4((p + vec3(-9519.0, 9051.0, -123.0)) * twoPowI, noiseTime)) * scale;
  }
    
  // Using just the w component since we don't have derivatives yet
  return vec3(
    zNoisePotentialDerivatives.y - yNoisePotentialDerivatives.z,
    xNoisePotentialDerivatives.z - zNoisePotentialDerivatives.x,
    yNoisePotentialDerivatives.x - xNoisePotentialDerivatives.y
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec4 posData = texture2D(texturePosition, uv);
  
  vec3 position = posData.xyz;
  float life = posData.w - dieSpeed;
  
  vec3 followPosition = vec3(mouse * mouseScale, 0.0);
  
  if(life < 0.0) {
    float angle = random(uv) * 6.28318;
    float radiusRandom = random(uv + 0.5);
    // Square root creates more density toward center
    float finalRadius = sqrt(radiusRandom) * radius * 2.0;

    position = followPosition + vec3(
      cos(angle) * finalRadius,
      sin(angle) * finalRadius,
      (random(uv + 1.0) - 0.5) * 0.5
    );
    life = 0.5 + fract(posData.w * 21.4131 + time);
  } else {
    vec3 delta = followPosition - position;
    float distToMouse = length(delta);
    
    position += delta * (0.005 + life * 0.01) * attraction * (1.0 - smoothstep(50.0, 350.0, distToMouse)) * speed;
    position += curl(position * curlSize, time * 0.1, 0.1 + (1.0 - life) * 0.1) * speed * 0.1;
  }
  gl_FragColor = vec4(position, life);
}