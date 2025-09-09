import { loadShader } from '@/utils/three/shaderLoader';
import { SHADER_PATHS } from '@/constants/shaders';

export interface ShaderSet {
  vertex: string;
  fragment: string;
}

export async function loadShaderSet(paths: { vertex: string; fragment: string }): Promise<ShaderSet> {
  const [vertex, fragment] = await Promise.all([
    loadShader(paths.vertex),
    loadShader(paths.fragment)
  ]);
  
  return { vertex, fragment };
}

export async function loadParticleShaders(): Promise<ShaderSet> {
  return loadShaderSet(SHADER_PATHS.particles);
}

export async function loadSimulationShaders(): Promise<ShaderSet> {
  return loadShaderSet(SHADER_PATHS.simulation);
}