import { paintMarbleBuffers } from './marble.js';

// Paints marble off the main thread so the intro animation never stutters.
self.onmessage = ({ data }) => {
  const { color, pbr } = paintMarbleBuffers(data, (y, h) => {
    if (y % 24 === 0) self.postMessage({ progress: y / h });
  });
  self.postMessage({ done: true, color, pbr }, [color.buffer, pbr.buffer]);
};
