uniform sampler2D uPointTexture;
uniform sampler2D uTouch;
uniform float uTime;

varying float vAlpha;
varying vec2 vUv;

void main() {
  // Sample particle texture for shape
  vec2 coord = gl_PointCoord;
  vec4 tex = texture2D(uPointTexture, coord);
  
  // Sample touch texture for additional color influence
  vec4 touchColor = texture2D(uTouch, vUv);
  float touchIntensity = touchColor.r;
  
  // Base particle color - cool blue-white mist
  vec3 coolColor = vec3(0.6, 0.8, 1.0);
  
  // Warmer color for active areas
  vec3 warmColor = vec3(1.0, 0.95, 0.85);
  
  // Mix colors based on touch intensity
  vec3 particleColor = mix(coolColor, warmColor, touchIntensity * 0.4);
  
  // Add shimmer effect
  float shimmer = sin(uTime * 10.0 + vUv.x * 50.0 + vUv.y * 50.0) * 0.1 + 0.9;
  particleColor *= shimmer;
  
  // Add color variation based on position
  particleColor += vec3(
      sin(vUv.x * 10.0 + uTime) * 0.05,
      cos(vUv.y * 10.0 + uTime * 1.1) * 0.05,
      sin((vUv.x + vUv.y) * 5.0 + uTime * 0.9) * 0.05
  );
  
  // Calculate alpha
  float alpha = tex.a * vAlpha;
  
  // Soft circular falloff for particles
  float dist = length(coord - 0.5);
  float edgeSoftness = smoothstep(0.5, 0.2, dist);
  alpha *= edgeSoftness;
  
  // Additional fade based on touch intensity
  alpha *= 0.2 + touchIntensity * 0.8;
  
  // Add subtle glow for bright particles
  if (touchIntensity > 0.5) {
      float glowIntensity = (touchIntensity - 0.5) * 2.0;
      particleColor += vec3(0.2, 0.3, 0.5) * glowIntensity;
      alpha *= 1.0 + glowIntensity * 0.5;
  }
  
  // Clamp alpha to valid range
  alpha = clamp(alpha, 0.0, 1.0);
  
  gl_FragColor = vec4(particleColor, alpha);
}