import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadShader } from '@/utils/three/shaderLoader';

export default function MouseTrail() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Basic Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // separate scene for GPU computation
    const simScene = new THREE.Scene();
    const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create a fullscreen quad
    const simGeometry = new THREE.PlaneGeometry(2, 2);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    const mouse = new THREE.Vector2();

    function onMouseMove(event: MouseEvent) {
      // Convert to -1 to 1 range
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // Load shaders and create material
    async function setupShaders() {
      const vertexShader = await loadShader('/shaders/testVert.glsl');
      const fragmentShader = await loadShader('/shaders/testFrag.glsl');
      const simVertexShader = await loadShader('/shaders/passthroughVert.glsl');
      const simFragmentShader = await loadShader('/shaders/passthroughFrag.glsl');

      // Create a data texture with random positions
      const textureSize = 8;  // 16x16 texture = 256 particles
      const positionData = new Float32Array(textureSize * textureSize * 4);  // RGBA

      for(let i = 0; i < textureSize * textureSize; i++) {
        const i4 = i * 4;
        positionData[i4 + 0] = (Math.random() - 0.5) * 2;  // x position
        positionData[i4 + 1] = (Math.random() - 0.5) * 2;  // y position
        positionData[i4 + 2] = 0;                          // z position
        positionData[i4 + 3] = 1;                          // w (life, unused for now)
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

      const simMaterial = new THREE.RawShaderMaterial({
        vertexShader: simVertexShader,
        fragmentShader: simFragmentShader,
        uniforms: {
          texturePosition: { value: null },  // Will swap each frame
          resolution: { value: new THREE.Vector2(textureSize, textureSize) },
          time: { value: 0 },
          mouse: { value: new THREE.Vector2(0, 0) }
        }
      });

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

      window.addEventListener('mousemove', onMouseMove)

      let currentRenderTarget = renderTarget1
      let nextRenderTarget = renderTarget2

      function animate() {
        requestAnimationFrame(animate);
        
        // Update simulation uniforms
        simMaterial.uniforms.texturePosition.value = currentRenderTarget.texture;
        simMaterial.uniforms.time.value += 0.05;
        simMaterial.uniforms.mouse.value.copy(mouse);

        // Render to next target
        renderer.setRenderTarget(nextRenderTarget);
        renderer.render(simScene, simCamera);
        renderer.setRenderTarget(null);

        const pixels = new Float32Array(textureSize * textureSize * 4);
        
        // Update particle material to use new positions
        material.uniforms.texturePosition.value = nextRenderTarget.texture;
        
        // Swap render targets for next frame
        [currentRenderTarget, nextRenderTarget] = [nextRenderTarget, currentRenderTarget];
        
        // Regular updates
        material.uniforms.time.value += 0.05;
        material.uniforms.mouse.value.copy(mouse);
        
        // Render particles
        renderer.render(scene, camera);
      }
      
      animate();  // Start the loop
    }

    setupShaders();

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} />;

}