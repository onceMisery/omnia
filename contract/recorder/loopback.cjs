// Test transport adaptation only: leave frozen HTTP routes/handlers unchanged.
// Node's original server uses listen(port), which otherwise binds all interfaces.
const net = require('node:net');
const originalListen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (typeof args[0] === 'number' || (typeof args[0] === 'string' && /^\d+$/.test(args[0]))) {
    const port = Number(args.shift());
    if (typeof args[0] === 'string') args.shift();
    return originalListen.call(this, port, '127.0.0.1', ...args);
  }
  if (args[0] && typeof args[0] === 'object' && Object.hasOwn(args[0], 'port')) {
    args[0] = { ...args[0], host: '127.0.0.1' };
  }
  return originalListen.apply(this, args);
};
