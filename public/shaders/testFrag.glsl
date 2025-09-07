precision mediump float;

varying float vLife;

void main() {
  // Color based on mouse position
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  // Discard pixels outside a circle
  if(dist > 0.5) {
    discard;
  }
  
   // Fade based on life
  float alpha = smoothstep(0.0, 0.1, vLife) * smoothstep(0.0, 0.2, vLife);
  alpha *= 1.0 - (dist * 2.0);  // Edge fade
  
  vec3 color = vec3(1.0, 0.8, 0.6);  // Warm color
  
  gl_FragColor = vec4(color * alpha, alpha);
}