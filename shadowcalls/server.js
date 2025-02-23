const express = require('express');
const { ExpressPeerServer } = require('peer');
const app = express();

app.use(express.static('.'));

const server = app.listen(9000, () => {
    console.log('Server running on port 9000');
});

const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/',
    proxied: true,
    allow_discovery: true,
    key: 'peerjs',
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    }
});

app.use('/', peerServer);

// Add error handling for PeerJS server
peerServer.on('error', (error) => {
    console.error('PeerJS server error:', error);
});

peerServer.on('connection', (client) => {
    console.log('Client connected:', client.getId());
});

peerServer.on('disconnect', (client) => {
    console.log('Client disconnected:', client.getId());
});
