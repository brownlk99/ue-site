const cache = new Map<string, Promise<string>>();

export async function loadShader(url: string): Promise<string> {
  if (cache.has(url)) {
    return cache.get(url)!;
  }
  
  // Create promise with error handling
  const promise = fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load shader ${url}: ${response.status}`);
      }
      return response.text();
    });
  
  cache.set(url, promise);
  return promise;
}