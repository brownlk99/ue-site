precision mediump float;

uniform sampler2D texturePosition;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;

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
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
  
  // First corner
  vec4 i = floor(v + dot(v, vec4(F4)));
  vec4 x0 = v - i + dot(i, C.xxxx);
  
  // Other corners
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
  
  // Permutations
  i = mod289(i);
  float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute(permute(permute(permute(i.w + vec4(i1.w, i2.w, i3.w, 1.0)) + i.z + vec4(i1.z, i2.z, i3.z, 1.0)) + i.y + vec4(i1.y, i2.y, i3.y, 1.0)) + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
  
  // Gradients
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0);
  vec4 p0 = grad4(j0, ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  
  // Normalize gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));
  
  // Mix contributions from 5 corners
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  
  // Return derivatives (xyz) and value (w)
  float value = 49.0 * (dot(m0*m0, vec3(dot(p0,x0), dot(p1,x1), dot(p2,x2))) + dot(m1*m1, vec2(dot(p3,x3), dot(p4,x4))));
  
  return vec4(0.0, 0.0, 0.0, value);  // Simplified - just return value for now
}

// ============ 3D CURL NOISE ============
vec3 curl3D(vec3 p, float t) {
  float e = 0.1;  // Epsilon for gradient sampling
  
  // Get noise values at 6 neighboring points
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  
  float x1 = simplexNoise4D(vec4(p + dx, t)).x;
  float x2 = simplexNoise4D(vec4(p - dx, t)).x;
  float y1 = simplexNoise4D(vec4(p + dy, t)).x;
  float y2 = simplexNoise4D(vec4(p - dy, t)).x;
  float z1 = simplexNoise4D(vec4(p + dz, t)).x;
  float z2 = simplexNoise4D(vec4(p - dz, t)).x;
  
  // Compute curl as cross product of gradient
  float x = (y1 - y2) - (z1 - z2);
  float y = (z1 - z2) - (x1 - x2);
  float z = (x1 - x2) - (y1 - y2);
  
  return vec3(x, y, z) / (2.0 * e);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec4 posData = texture2D(texturePosition, uv);
  
  vec3 pos = posData.xyz;
  float life = posData.w;

  life -= 0.001;

  // If dead, respawn
  if(life <= 0.0) {
    // Respawn near mouse with random offset
    vec3 mouseWorld = vec3(mouse * 4.0, 0.0);
    
    // Random spawn offset in a small radius
    float angle = random(uv) * 6.28318;     // Random angle 0 to 2π radians
    float radius = random(uv + 0.5) * 0.5;  // Random distance 0 to 0.5 units

    pos = mouseWorld + vec3(
      cos(angle) * radius,  // X offset
      sin(angle) * radius,  // Y offset
      (random(uv + 1.0) - 0.5) * 0.5  // Z variation for 3D
    );

     // Random initial life (0.5 to 1.0)
    life = 0.5 + random(uv + time) * 0.5;
  } else {
    // Only move living particles
  
    vec2 curl = curl3D(pos * 0.5, time * 0.5);
    pos += curl * 0.005;

    // Mouse attraction
    vec3 mousePos = vec3(mouse * 4.0, 0.0);  // Scale mouse to world space
    vec3 toMouse = mousePos - pos;
    float dist = length(toMouse);
    float pullStrength = (1.0 - smoothstep(0.5, 3.0, dist)) * life;
    pos += toMouse * 0.002 * pullStrength;  // Gentle pull that weakens with distance
  }
  
  gl_FragColor = vec4(pos, life);
}