precision mediump float;

uniform sampler2D texturePosition;
uniform vec2 resolution;
uniform float time;
uniform vec2 mouse;

// Simple pseudo-random based on UV
float random(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// Simple 2D noise using sine waves (not true Perlin)
float noise(vec2 p) {
  return sin(p.x * 0.1) * sin(p.y * 0.1);
}

// Sample noise at offset positions to compute gradient
vec2 curl2D(vec2 p, float time) {
  float epsilon = 0.01;
  
  // Sample noise at slight offsets
  float n1 = noise(p + vec2(epsilon, 0.0) + time);
  float n2 = noise(p - vec2(epsilon, 0.0) + time);
  float n3 = noise(p + vec2(0.0, epsilon) + time);
  float n4 = noise(p - vec2(0.0, epsilon) + time);
  
  // Compute partial derivatives
  float dx = (n1 - n2) / (2.0 * epsilon);
  float dy = (n3 - n4) / (2.0 * epsilon);
  
  // Return curl (perpendicular to gradient)
  return vec2(-dy, dx);  // Rotate gradient 90 degrees
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
      0.0
    );

     // Random initial life (0.5 to 1.0)
    life = 0.5 + random(uv + time) * 0.5;
  } else {
    // Only move living particles
  
    vec2 curl = curl2D(pos.xy * 0.5, time * 0.2);
    pos.xy += curl * 0.005;
    
    // Wrap around screen
    if(pos.y > 2.0) pos.y = -2.0;

    // Mouse attraction
    // vec3 mousePos = vec3(mouse * 4.0, 0.0);  // Scale mouse to world space
    // vec3 toMouse = mousePos - pos;
    // float dist = length(toMouse);
    // float pullStrength = 1.0 - smoothstep(0.5, 3.0, dist);  // Falls off from 0.5 to 3 units
    // pos += toMouse * 0.002 * pullStrength;  // Gentle pull that weakens with distance
  }
  
  gl_FragColor = vec4(pos, life);
}