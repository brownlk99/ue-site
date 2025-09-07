precision mediump float;

uniform vec2 mouse;  // Mouse position (-1 to 1)

void main() {
  // Color based on mouse position
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  // Discard pixels outside a circle
  if(dist > 0.5) {
    discard;
  }
  
  vec3 color = vec3(
    mouse.x * 0.5 + 0.5,
    mouse.y * 0.5 + 0.5,
    1.0
  );
  
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);  // Pure red, ignore mouse for now
}