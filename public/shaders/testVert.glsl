precision mediump float;
attribute vec2 reference;
uniform sampler2D texturePosition;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float time;
uniform vec2 mouse;

void main() {
  // Read position from texture
  vec4 posData = texture2D(texturePosition, reference);
  vec3 pos = posData.xyz;

  // Attract to mouse
  vec3 mousePos = vec3(mouse, 0.0);
  vec3 toMouse = mousePos - pos;
  pos += toMouse * 0.2;
  
  // Add animation
  pos.x += sin(time + reference.y * 5.0) * 0.1;
  pos.y += cos(time + reference.x * 5.0) * 0.1;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = 20.0;
}