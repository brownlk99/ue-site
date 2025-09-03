uniform sampler2D uTouch;
uniform float uTime;

attribute float aIndex;

varying float vAlpha;
varying vec2 vUv;

// Noise function for organic movement
float noise(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vUv = uv;
  
  // Sample the touch texture at this particle's UV position
  vec4 touchData = texture2D(uTouch, uv);
  float intensity = touchData.r;
  
  // Base position
  vec3 displaced = position;
  
  // Displacement amount based on touch intensity
  float displacement = intensity * 20.0;
  
  // Add variety with index-based offsets
  float uniqueOffset = aIndex * 0.618033988749895; // Golden ratio
  
  // Vertical lift - particles rise like steam
  displaced.z += displacement * (1.0 + sin(uTime * 2.0 + uniqueOffset) * 0.3);
  
  // Swirl motion
  float swirlAngle = uTime * 0.5 + uniqueOffset * 6.28318;
  float swirlRadius = intensity * 5.0;
  displaced.x += cos(swirlAngle) * swirlRadius;
  displaced.y += sin(swirlAngle) * swirlRadius;
  
  // Add turbulence for organic feel
  float turbX = sin(uTime * 3.0 + uniqueOffset * 10.0) * 0.5;
  float turbY = cos(uTime * 2.5 + uniqueOffset * 8.0) * 0.5;
  displaced.x += turbX * intensity * 2.0;
  displaced.y += turbY * intensity * 1.5;
  
  // Upward drift for steam effect
  displaced.y += intensity * (sin(uTime + uniqueOffset) * 2.0 + 1.0);
  
  // Add some horizontal drift
  displaced.x += sin(uTime * 0.7 + uniqueOffset * 5.0) * intensity * 1.5;
  
  // Calculate alpha based on intensity
  vAlpha = intensity;
  
  // Pulsing effect
  vAlpha *= 0.5 + 0.5 * sin(uTime * 4.0 + uniqueOffset * 5.0);
  
  // Fade in and out smoothly
  vAlpha *= smoothstep(0.0, 0.1, intensity);
  vAlpha *= smoothstep(1.0, 0.5, intensity);
  
  // Transform to view space
  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  
  // Calculate point size
  float baseSize = mix(1.0, 15.0, intensity);
  
  // Add pulsing to size
  baseSize *= (1.0 + sin(uTime * 6.0 + uniqueOffset * 3.0) * 0.3);
  
  // Perspective scaling
  float perspectiveScale = 300.0 / -mvPosition.z;
  
  // Random size variation
  float sizeVariation = 0.7 + noise(uniqueOffset) * 0.6;
  
  gl_PointSize = baseSize * perspectiveScale * sizeVariation;
  gl_Position = projectionMatrix * mvPosition;
}