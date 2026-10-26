import { findSolution } from './solver.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ ...findSolution(data.hand, data.target, data.whole, data.excluded), round: data.round }); }
  catch (error) { self.postMessage({ error: error.message, round: data.round }); }
};
