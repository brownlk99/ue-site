import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SCENE_CONFIG } from '@/constants/scene';
import { PARTICLE_CONFIG } from '@/constants/particles';
import { calculateVisibleDimensions } from '@/utils/three/mathUtils';
import { loadParticleShaders, loadSimulationShaders } from '@/three/shaders';
import { useMouseTracking } from '@/hooks/useMouseTracking';

export default function MouseTrail() {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouse = useMouseTracking();

  useEffect(() => {
    if (!mountRef.current) return;

    // Basic Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      SCENE_CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      SCENE_CONFIG.camera.near,
      SCENE_CONFIG.camera.far
    );
    camera.position.z = SCENE_CONFIG.camera.distance;

    // separate scene for GPU computation
    const simScene = new THREE.Scene();
    const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create a fullscreen quad
    const simGeometry = new THREE.PlaneGeometry(2, 2);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);


    let simMaterial: THREE.RawShaderMaterial | null = null;

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);

      // Only update mouse scale if simMaterial exists
      if (simMaterial) {
        const { visibleWidth, visibleHeight } = calculateVisibleDimensions(
          SCENE_CONFIG.camera.fov,
          SCENE_CONFIG.camera.distance,
          window.innerWidth / window.innerHeight,
        );

        simMaterial.uniforms.mouseScale.value.set(visibleWidth / 2, visibleHeight / 2);
      }
    }

    // Add event listeners in outer scope
    window.addEventListener('resize', onWindowResize);

    // Load shaders and create material
    async function setupShaders() {
      const [particleShaders, simulationShaders] = await Promise.all([
        loadParticleShaders(),
        loadSimulationShaders()
      ]);
      
      const { vertex: vertexShader, fragment: fragmentShader } = particleShaders;
      const { vertex: simVertexShader, fragment: simFragmentShader } = simulationShaders;

      // Create a data texture with random positions
      const textureSize = PARTICLE_CONFIG.defaultTextureSize;  // 64x64 texture = 4096 particles
      const positionData = new Float32Array(textureSize * textureSize * 4);  // RGBA

      for(let i = 0; i < textureSize * textureSize; i++) {
        const i4 = i * 4;
        const r = (0.5 + Math.random() * 0.5) * 2;
        const phi = (Math.random() - 0.5) * Math.PI;
        const theta = Math.random() * Math.PI * 2;
        
        positionData[i4 + 0] = r * Math.cos(theta) * Math.cos(phi);
        positionData[i4 + 1] = r * Math.sin(phi);
        positionData[i4 + 2] = r * Math.sin(theta) * Math.cos(phi);
        positionData[i4 + 3] = Math.random();
      }

      console.log('Sample positions:', {
        particle0: [positionData[0], positionData[1], positionData[2]],
        particle1: [positionData[4], positionData[5], positionData[6]],
      });

      const positionTexture = new THREE.DataTexture(
        positionData,
        textureSize,
        textureSize,
        THREE.RGBAFormat,
        THREE.FloatType
      );
      positionTexture.needsUpdate = true;
      
      const material = new THREE.RawShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          time: { value: 0},
          mouse: { value: new THREE.Vector2(0, 0) },
          texturePosition: { value: positionTexture }
        },
        transparent: true, // Allow alpha transparency
        blending: THREE.AdditiveBlending, // Add colors together
        depthWrite: false // Don't write to depth buffer
      });

      simMaterial = new THREE.RawShaderMaterial({
        vertexShader: simVertexShader,
        fragmentShader: simFragmentShader,
        uniforms: {
          texturePosition: { value: null },
          resolution: { value: new THREE.Vector2(textureSize, textureSize) },
          time: { value: 0 },
          mouse: { value: new THREE.Vector2(0, 0) },
          mouseScale: { value: new THREE.Vector2(4, 4) },
          speed: { value: PARTICLE_CONFIG.simulation.speed },
          dieSpeed: { value: PARTICLE_CONFIG.simulation.dieSpeed },
          radius: { value: PARTICLE_CONFIG.simulation.radius },
          curlSize: { value: PARTICLE_CONFIG.simulation.curlSize },
          attraction: { value: PARTICLE_CONFIG.simulation.attraction },
        }
      });

      const { visibleWidth, visibleHeight } = calculateVisibleDimensions(
        SCENE_CONFIG.camera.fov,
        SCENE_CONFIG.camera.distance,
        window.innerWidth / window.innerHeight
      );

      simMaterial.uniforms.mouseScale = { 
        value: new THREE.Vector2(visibleWidth / 2, visibleHeight / 2) 
      };

      // Create render targets for ping-pong
      const renderTargetOptions = {
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        depthWrite: false,
        depthBuffer: false
      };

      const renderTarget1 = new THREE.WebGLRenderTarget(
        textureSize,
        textureSize,
        renderTargetOptions
      );

      const renderTarget2 = new THREE.WebGLRenderTarget(
        textureSize,
        textureSize,
        renderTargetOptions
      );

      const simMesh = new THREE.Mesh(simGeometry, simMaterial);
      simScene.add(simMesh);

      // Copy initial positions to first render target
      simMaterial.uniforms.texturePosition.value = positionTexture;
      renderer.setRenderTarget(renderTarget1);
      renderer.render(simScene, simCamera);
      renderer.setRenderTarget(null);  // Back to screen

      // use a texture to store positional data
      const particleCount = textureSize * textureSize;
      const geometry = new THREE.BufferGeometry();
      const references = new Float32Array(particleCount * 2); // for uv coords

      for(let i = 0; i < particleCount; i++) {
        const x = (i % textureSize) / textureSize;
        const y = Math.floor(i/textureSize) / textureSize;

        references[i * 2] = x;
        references[i * 2 + 1] = y;
      }

      geometry.setAttribute('reference', new THREE.BufferAttribute(references, 2));
      // positions dummy attribute
      const positions = new Float32Array(particleCount * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      console.log('Particle count:', particleCount);
      console.log('Geometry attributes:', geometry.attributes);
      console.log('First few references:', references.slice(0, 10));

      let currentRenderTarget = renderTarget1
      let nextRenderTarget = renderTarget2
      let lastTime = 0;
    
      function animate(currentTime = 0) {
        requestAnimationFrame(animate);

         if (!simMaterial) return;

        // Calculate delta time
        const dt = Math.min(currentTime - lastTime, 50); // Cap at 50ms to prevent huge jumps
        lastTime = currentTime;
        const deltaRatio = dt / 16.6667; // Normalize to 60fps
        
        // Update simulation uniforms
        simMaterial.uniforms.texturePosition.value = currentRenderTarget.texture;
        simMaterial.uniforms.time.value += 0.05 * deltaRatio;
        simMaterial.uniforms.mouse.value.copy(mouse);

        // Render to next target
        renderer.setRenderTarget(nextRenderTarget);
        renderer.render(simScene, simCamera);
        renderer.setRenderTarget(null);
        
        // Update particle material to use new positions
        material.uniforms.texturePosition.value = nextRenderTarget.texture;
        
        // Swap render targets for next frame
        [currentRenderTarget, nextRenderTarget] = [nextRenderTarget, currentRenderTarget];
        
        // Regular updates
        material.uniforms.time.value += 0.05 * deltaRatio;
        material.uniforms.mouse.value.copy(mouse);
        
        // Render particles
        renderer.render(scene, camera);
      }
      
      animate(0);
    }

    setupShaders();

    // Cleanup
    return () => {
       window.removeEventListener('resize', onWindowResize);
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} />;

}