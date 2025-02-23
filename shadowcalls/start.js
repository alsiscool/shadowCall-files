const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');

const app = express();

// Serve static files
app.use(express.static(__dirname));

// Create HTTP server
const server = app.listen(9000, () => {
    console.log('Server running on port 9000');
});

// Initialize PeerJS server with basic configuration
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/'  // Changed to root path
});

// Add detailed logging
peerServer.on('connection', (client) => {
    console.log('New connection:', {
        id: client.getId(),
        token: client.getToken(),
        timestamp: new Date().toISOString()
    });
});

peerServer.on('disconnect', (client) => {
    console.log('Client disconnected:', {
        id: client.getId(),
        timestamp: new Date().toISOString()
    });
});

peerServer.on('error', (error) => {
    console.error('PeerJS server error:', {
        message: error.message,
        type: error.type,
        timestamp: new Date().toISOString()
    });
});

// Mount PeerJS server at root
app.use('/', peerServer);

// Log PeerJS events
peerServer.on('connection', (client) => {
    console.log('Client connected:', client.getId());
});

peerServer.on('disconnect', (client) => {
    console.log('Client disconnected:', client.getId());
});
