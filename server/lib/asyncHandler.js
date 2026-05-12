// Wraps async route handlers so thrown errors reach Express's error middleware
// instead of crashing the process.
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
