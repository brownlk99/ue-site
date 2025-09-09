import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function useMouseTracking(): THREE.Vector2 {
  const mouse = useRef(new THREE.Vector2()).current;

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      // Convert to -1 to 1 range
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    window.addEventListener('mousemove', onMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [mouse]);

  return mouse;
}