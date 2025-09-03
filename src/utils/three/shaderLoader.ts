export async function loadShaders() {
    try {
      console.log('Starting to load shaders...')
      const [vertexResponse, fragmentResponse] = await Promise.all([
        fetch('/shaders/vapor/vaporVertex.glsl'),
        fetch('/shaders/vapor/vaporFragment.glsl')
      ])
      console.log('Responses received:', vertexResponse.status, fragmentResponse.status)

      if (!vertexResponse.ok || !fragmentResponse.ok) {
        throw new Error('Failed to load shaders')
      }

      const [vertexShader, fragmentShader] = await Promise.all([
        vertexResponse.text(),
        fragmentResponse.text()
      ])

      return { vertexShader, fragmentShader }
    } catch (error) {
      console.error('Error loading shaders:', error)
      throw error
    }
  }