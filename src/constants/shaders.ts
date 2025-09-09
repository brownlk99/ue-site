export const SHADER_PATHS = {
  particles: {
    vertex: '/shaders/testVert.glsl',
    fragment: '/shaders/testFrag.glsl'
  },
  simulation: {
    vertex: '/shaders/passthroughVert.glsl',
    fragment: '/shaders/passthroughFrag.glsl'
  }
} as const;