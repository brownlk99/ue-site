'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// Shader loader utility
async function loadShader(path: string): Promise<string> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Failed to load shader: ${path}`)
  return response.text()
}

export default function WispEffect() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let cleanup = () => {}

    const init = async () => {
      try {
        // Load shaders
        const vertexShader = await loadShader('/shaders/wisp/particleVertex.glsl')
        const fragmentShader = await loadShader('/shaders/wisp/particleFragment.glsl')

        // Scene setup
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(
          60, 
          window.innerWidth / window.innerHeight, 
          0.1, 
          1000
        )
        camera.position.z = 100

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ 
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance'
        })
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        containerRef.current!.appendChild(renderer.domElement)

        // Create invisible plane for raycasting
        const interactionPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(100, 100),
          new THREE.MeshBasicMaterial({ visible: false })
        )
        scene.add(interactionPlane)

        // Setup raycaster
        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2()
        const uv = new THREE.Vector2(0.5, 0.5)
        const prevUv = new THREE.Vector2(0.5, 0.5)

        // Create touch texture (offscreen canvas)
        const canvasSize = 512
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = canvasSize
        const ctx = canvas.getContext('2d', { alpha: false })!
        
        // Initialize canvas to black
        ctx.fillStyle = 'black'
        ctx.fillRect(0, 0, canvasSize, canvasSize)

        const touchTexture = new THREE.CanvasTexture(canvas)
        touchTexture.minFilter = THREE.LinearFilter
        touchTexture.magFilter = THREE.LinearFilter

        // Trail history for smooth lines
        const trail: THREE.Vector2[] = []
        const maxTrailLength = 20

        // Create particle system
        const GRID = 32
        const particleCount = GRID * GRID // 32x32 = 1024 particles
        const geometry = new THREE.BufferGeometry()
        
        // Create grid of particles
        const positions = new Float32Array(particleCount * 3)
        const uvs = new Float32Array(particleCount * 2)
        const indices = new Float32Array(particleCount)
        
        let idx = 0
        for (let i = 0; i < GRID; i++) {
          for (let j = 0; j < GRID; j++) {
            // Spread particles across the view
            const x = (i / GRID - 0.5) * 80
            const y = (j / GRID - 0.5) * 80
            
            positions[idx * 3] = x
            positions[idx * 3 + 1] = y
            positions[idx * 3 + 2] = 0
            
            // UV coordinates for texture sampling
            uvs[idx * 2] = i / GRID
            uvs[idx * 2 + 1] = j / GRID
            
            // Unique index for each particle
            indices[idx] = idx
            
            idx++
          }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
        geometry.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1))

        // Create particle texture
        const particleTexture = createParticleTexture()

        // Create particle material
        const uniforms = {
          uTime: { value: 0 },
          uTouch: { value: touchTexture },
          uPointTexture: { value: particleTexture }
        }

        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending
        })

        const points = new THREE.Points(geometry, material)
        points.frustumCulled = false
        scene.add(points)

        // Mouse/touch movement handler
        const handlePointerMove = (clientX: number, clientY: number) => {
          mouse.x = (clientX / window.innerWidth) * 2 - 1
          mouse.y = -(clientY / window.innerHeight) * 2 + 1

          raycaster.setFromCamera(mouse, camera)
          const intersects = raycaster.intersectObject(interactionPlane)
          
          if (intersects.length > 0) {
            prevUv.copy(uv)
            uv.copy(intersects[0].uv!)
            
            // Add to trail
            trail.push(new THREE.Vector2(uv.x, uv.y))
            if (trail.length > maxTrailLength) {
              trail.shift()
            }
          }
        }

        // Event listeners
        const handleMouseMove = (e: MouseEvent) => {
          handlePointerMove(e.clientX, e.clientY)
        }

        const handleTouchMove = (e: TouchEvent) => {
          if (e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
          }
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('touchmove', handleTouchMove, { passive: true })

        // Update touch texture function
        function updateTouchTexture(delta: number) {
          // Fade existing trails
          ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = 'rgba(0, 0, 0, 0.02)' // Slow fade for longer trails
          ctx.fillRect(0, 0, canvasSize, canvasSize)

          // Draw smooth trail
          if (trail.length > 1) {
            ctx.globalCompositeOperation = 'lighter' // Additive blending
            
            // Draw trail line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
            ctx.lineWidth = 20
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            
            ctx.beginPath()
            ctx.moveTo(trail[0].x * canvasSize, (1 - trail[0].y) * canvasSize)
            
            // Draw smooth curve through points
            for (let i = 1; i < trail.length; i++) {
              const prev = trail[i - 1]
              const curr = trail[i]
              
              const cpx = (prev.x + curr.x) / 2 * canvasSize
              const cpy = (1 - (prev.y + curr.y) / 2) * canvasSize
              
              ctx.quadraticCurveTo(
                prev.x * canvasSize,
                (1 - prev.y) * canvasSize,
                cpx,
                cpy
              )
            }
            
            const last = trail[trail.length - 1]
            ctx.lineTo(last.x * canvasSize, (1 - last.y) * canvasSize)
            ctx.stroke()
            
            // Add bright spot at current position
            const gradient = ctx.createRadialGradient(
              uv.x * canvasSize, (1 - uv.y) * canvasSize, 0,
              uv.x * canvasSize, (1 - uv.y) * canvasSize, 40
            )
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
            gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)')
            gradient.addColorStop(0.6, 'rgba(200, 220, 255, 0.4)')
            gradient.addColorStop(1, 'rgba(150, 180, 255, 0)')
            
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(uv.x * canvasSize, (1 - uv.y) * canvasSize, 40, 0, Math.PI * 2)
            ctx.fill()
          }

          touchTexture.needsUpdate = true
        }

        // Animation loop
        const clock = new THREE.Clock()
        
        const animate = () => {
          const delta = clock.getDelta()
          const elapsed = clock.getElapsedTime()
          
          // Update uniforms
          uniforms.uTime.value = elapsed
          
          // Update touch texture
          updateTouchTexture(delta)
          
          // Render
          renderer.render(scene, camera)
          requestAnimationFrame(animate)
        }

        animate()

        // Handle window resize
        const handleResize = () => {
          camera.aspect = window.innerWidth / window.innerHeight
          camera.updateProjectionMatrix()
          renderer.setSize(window.innerWidth, window.innerHeight)
        }
        window.addEventListener('resize', handleResize)

        // Cleanup function
        cleanup = () => {
          window.removeEventListener('resize', handleResize)
          window.removeEventListener('mousemove', handleMouseMove)
          window.removeEventListener('touchmove', handleTouchMove)
          renderer.dispose()
          geometry.dispose()
          material.dispose()
          touchTexture.dispose()
          particleTexture.dispose()
          if (containerRef.current?.contains(renderer.domElement)) {
            containerRef.current.removeChild(renderer.domElement)
          }
        }

        setLoaded(true)
        
      } catch (err) {
        console.error('Failed to initialize wisp effect:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    init()

    return () => {
      cleanup()
    }
  }, [])

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 w-full h-full" 
      style={{ background: 'radial-gradient(circle at center, #0a0a15 0%, #000000 100%)' }}
    >
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-blue-200">
          <div className="text-center">
            <div className="text-lg mb-2">Loading wisp system...</div>
            <div className="text-sm opacity-70">Move your mouse to create magical trails</div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400">
          <div className="text-center">
            <div className="text-lg mb-2">Error loading wisp effect</div>
            <div className="text-sm opacity-75">{error}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to create particle texture
function createParticleTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  
  // Create soft particle gradient
  const gradient = ctx.createRadialGradient(
    size/2, size/2, 0, 
    size/2, size/2, size/2
  )
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)')
  gradient.addColorStop(0.4, 'rgba(200,220,255,0.5)')
  gradient.addColorStop(0.7, 'rgba(150,180,255,0.2)')
  gradient.addColorStop(1, 'rgba(100,150,255,0)')
  
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  
  return texture
}