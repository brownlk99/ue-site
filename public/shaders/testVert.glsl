precision mediump float;
attribute vec2 reference;
uniform sampler2D texturePosition;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

varying float vLife;

void main() {
  // Read position from texture
  vec4 posData = texture2D(texturePosition, reference);
  vec3 pos = posData.xyz;
  vLife = posData.w;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

  //Size-based on life (fade-in/out)
  float fadeIn = smoothstep(0.0, 0.1, vLife);
  float fadeOut = smoothstep(0.0, 0.2, vLife);
  gl_PointSize = 20.0;
}