export function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function calculateVisibleDimensions(
  fovDegrees: number, 
  distance: number, 
  aspect: number
) {
  const fov = toRadians(fovDegrees);
  const visibleHeight = 2 * Math.tan(fov / 2) * distance;
  const visibleWidth = visibleHeight * aspect;
  return { visibleWidth, visibleHeight };
}