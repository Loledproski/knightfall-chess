const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const clients = new Set();
const waitingPlayers = [];
const rooms = new Map();
const TIME_CONTROLS = new Set(['bullet', 'blitz', 'rapid', 'classical']);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};

const server = http.createServer((request, response) => {
  const safePath = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const filename = path.join(__dirname, safePath);

  if (!filename.startsWith(__dirname)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filename, (error, file) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filename)] || 'application/octet-stream' });
    response.end(file);
  });
});

server.on('upgrade', (request, socket) => {
  if (request.url !== '/ws') {
    socket.destroy();
    return;
  }

  const key = request.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    '',
  ].join('\r\n'));

  const client = { socket, roomId: null, color: null, buffer: Buffer.alloc(0) };
  clients.add(client);
  socket.on('data', (chunk) => readFrames(client, chunk));
  socket.on('close', () => leave(client));
  socket.on('error', () => leave(client));
});

function readFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  while (client.buffer.length >= 2) {
    const first = client.buffer[0];
    const second = client.buffer[1];
    const length = second & 127;
    const masked = Boolean(second & 128);
    if ((first & 15) === 8) return client.socket.end();
    if (length > 125 || !masked || client.buffer.length < 6 + length) return;

    const mask = client.buffer.subarray(2, 6);
    const payload = client.buffer.subarray(6, 6 + length);
    const decoded = Buffer.alloc(length);
    for (let index = 0; index < length; index += 1) decoded[index] = payload[index] ^ mask[index % 4];
    client.buffer = client.buffer.subarray(6 + length);

    try {
      handleMessage(client, JSON.parse(decoded.toString('utf8')));
    } catch {
      send(client, { type: 'error', message: 'That message could not be understood.' });
    }
  }
}

function handleMessage(client, message) {
  if (message.type === 'joinQueue') joinQueue(client, message);
  if (message.type === 'move' && client.roomId) relayMove(client, message);
  if (message.type === 'resign' && client.roomId) relayToOpponent(client, { type: 'opponentResigned' });
}

function joinQueue(client, message) {
  if (client.roomId) return;
  client.timeControl = TIME_CONTROLS.has(message.timeControl) ? message.timeControl : 'blitz';
  const opponentIndex = waitingPlayers.findIndex((player) => !player.socket.destroyed && player.timeControl === client.timeControl);
  const opponent = opponentIndex >= 0 ? waitingPlayers.splice(opponentIndex, 1)[0] : null;
  if (!opponent || opponent.socket.destroyed) {
    waitingPlayers.push(client);
    send(client, { type: 'queued', timeControl: client.timeControl });
    return;
  }

  const roomId = crypto.randomUUID();
  client.roomId = roomId;
  opponent.roomId = roomId;
  const whitePlayer = Math.random() < 0.5 ? client : opponent;
  const blackPlayer = whitePlayer === client ? opponent : client;
  whitePlayer.color = 'white';
  blackPlayer.color = 'black';
  rooms.set(roomId, [opponent, client]);
  send(whitePlayer, { type: 'matchFound', color: 'white', timeControl: client.timeControl });
  send(blackPlayer, { type: 'matchFound', color: 'black', timeControl: client.timeControl });
}

function relayMove(client, message) {
  if (!message.move || typeof message.move.from !== 'string' || typeof message.move.to !== 'string') return;
  const clocks = message.clocks;
  const safeClocks = clocks && Number.isFinite(clocks.white) && Number.isFinite(clocks.black)
    ? { white: Math.max(0, Math.floor(clocks.white)), black: Math.max(0, Math.floor(clocks.black)) }
    : undefined;
  relayToOpponent(client, { type: 'opponentMove', move: message.move, clocks: safeClocks });
}

function relayToOpponent(client, message) {
  const room = rooms.get(client.roomId) || [];
  room.filter((player) => player !== client).forEach((player) => send(player, message));
}

function leave(client) {
  if (!clients.delete(client)) return;
  const queueIndex = waitingPlayers.indexOf(client);
  if (queueIndex >= 0) waitingPlayers.splice(queueIndex, 1);
  if (client.roomId) {
    relayToOpponent(client, { type: 'opponentLeft' });
    rooms.delete(client.roomId);
  }
}

function send(client, payload) {
  if (client.socket.destroyed) return;
  const data = Buffer.from(JSON.stringify(payload));
  const header = Buffer.from([129, data.length]);
  client.socket.write(Buffer.concat([header, data]));
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Knightfall Chess is running at http://localhost:${PORT}`);
});
