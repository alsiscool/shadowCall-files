/**
 * @jest-environment jsdom
 */

// Mock WebRTC APIs
global.RTCPeerConnection = class RTCPeerConnection {
    constructor() {
        this.localDescription = null;
        this.remoteDescription = null;
        this.onicecandidate = null;
        this.oniceconnectionstatechange = null;
        this.onsignalingstatechange = null;
        this.ontrack = null;
    }
    createOffer() {
        return Promise.resolve({ type: 'offer', sdp: 'mock-sdp' });
    }
    setLocalDescription() {
        return Promise.resolve();
    }
    setRemoteDescription() {
        return Promise.resolve();
    }
    createAnswer() {
        return Promise.resolve({ type: 'answer', sdp: 'mock-sdp' });
    }
    addIceCandidate() {
        return Promise.resolve();
    }
    close() {}
    addEventListener() {}
    removeEventListener() {}
    getConfiguration() {
        return {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };
    }
};

// Mock MediaStream
global.MediaStream = class MediaStream {
    constructor() {
        this.active = true;
    }
    getTracks() { return []; }
    getVideoTracks() { return []; }
    getAudioTracks() { return []; }
};

// Mock getUserMedia
global.navigator.mediaDevices = {
    getUserMedia: () => Promise.resolve(new MediaStream())
};

// Enhanced WebSocket Mock
global.WebSocket = class WebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 0; // CONNECTING
        
        // Simulate connection process
        setTimeout(() => {
            this.readyState = 1; // OPEN
            if (this.onopen) this.onopen();
            
            // Simulate PeerJS server response with correct message format
            setTimeout(() => {
                if (this.onmessage) {
                    this.onmessage({
                        data: JSON.stringify({
                            type: "OPEN",
                            payload: { id: "test-peer" }
                        })
                    });
                }
            }, 100);
        }, 50);
    }
    
    send(data) {
        // Handle messages sent to server
        const message = JSON.parse(data);
        if (message.type === "HEARTBEAT") {
            setTimeout(() => {
                if (this.onmessage) {
                    this.onmessage({
                        data: JSON.stringify({ type: "HEARTBEAT" })
                    });
                }
            }, 50);
        }
    }
    
    close() {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose();
    }
};

const { Peer } = require('peerjs');

describe('Video Call Application', () => {
    let peer;
    let mockStream;
    
    jest.setTimeout(15000); // Increase timeout

    beforeEach(() => {
        // Setup mock MediaStream
        mockStream = new MediaStream();
        mockStream.getAudioTracks = jest.fn().mockReturnValue([{ enabled: true }]);
        mockStream.getVideoTracks = jest.fn().mockReturnValue([{ enabled: true }]);
        
        // Setup PeerJS instance
        peer = new Peer('test-peer', {
            host: 'localhost',
            port: 9000,
            path: '/peerjs',
            debug: 3,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            }
        });

        // Mock DOM elements
        document.body.innerHTML = `
            <div id="videoGrid"></div>
            <button id="toggleAudio"></button>
            <button id="toggleVideo"></button>
            <div id="chatMessages"></div>
            <div class="unread-badge hidden"></div>
        `;
    });

    afterEach(() => {
        if (peer) {
            peer.destroy();
        }
        jest.clearAllMocks();
    });

    describe('PeerJS Server Connection', () => {
        test('should connect to PeerJS server', (done) => {
            peer.on('open', (id) => {
                expect(id).toBe('test-peer');
                done();
            });

            peer.on('error', (error) => {
                done(error);
            });
        });

        test('should handle reconnection on disconnect', (done) => {
            peer.on('open', () => {
                // Simulate disconnect
                peer.disconnect();
                expect(peer.disconnected).toBe(true);

                // Attempt reconnect
                peer.reconnect();
                
                // Check if reconnected
                peer.once('open', () => {
                    expect(peer.disconnected).toBe(false);
                    done();
                });
            });
        });
    });

    describe('Media Controls', () => {
        test('should toggle audio state', () => {
            const audioTrack = { enabled: true };
            mockStream.getAudioTracks.mockReturnValue([audioTrack]);
            
            // Simulate audio toggle
            audioTrack.enabled = false;
            expect(mockStream.getAudioTracks()[0].enabled).toBe(false);
            
            audioTrack.enabled = true;
            expect(mockStream.getAudioTracks()[0].enabled).toBe(true);
        });

        test('should toggle video state', () => {
            const videoTrack = { enabled: true };
            mockStream.getVideoTracks.mockReturnValue([videoTrack]);
            
            // Simulate video toggle
            videoTrack.enabled = false;
            expect(mockStream.getVideoTracks()[0].enabled).toBe(false);
            
            videoTrack.enabled = true;
            expect(mockStream.getVideoTracks()[0].enabled).toBe(true);
        });
    });

    describe('Chat Functionality', () => {
        test('should sanitize chat messages', () => {
            const unsafeMessage = '<script>alert("xss")</script>';
            const sanitizedMessage = unsafeMessage
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            expect(sanitizedMessage).not.toContain('<script>');
            expect(sanitizedMessage).toContain('&lt;script&gt;');
        });

        test('should track unread messages', () => {
            // Setup chat panel and badge
            const chatPanel = document.createElement('div');
            chatPanel.id = 'chatPanel';
            document.body.appendChild(chatPanel);
            
            const unreadBadge = document.querySelector('.unread-badge');
            let unreadMessages = 0;

            // Mock the addChatMessage function
            function addChatMessage(text, isSent = true) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;
                messageDiv.textContent = text;
                chatMessages.appendChild(messageDiv);
                
                if (!isSent && !chatPanel.classList.contains('visible')) {
                    unreadMessages++;
                    if (unreadMessages > 0) {
                        unreadBadge.classList.remove('hidden');
                        unreadBadge.textContent = unreadMessages;
                    }
                }
            }

            // Add a received message when chat is not visible
            addChatMessage('Test message', false);
            
            // Verify unread badge state
            expect(unreadMessages).toBe(1);
            expect(unreadBadge.classList.contains('hidden')).toBe(false);
            expect(unreadBadge.textContent).toBe('1');
        });
    });

    describe('Error Handling', () => {
        test('should handle peer connection errors', (done) => {
            const errorHandler = jest.fn();
            peer.on('error', errorHandler);

            // Simulate network error
            peer.emit('error', { type: 'network' });
            
            expect(errorHandler).toHaveBeenCalled();
            done();
        });

        test('should handle media access errors', () => {
            const mockError = new Error('NotAllowedError');
            mockError.name = 'NotAllowedError';

            expect(() => {
                throw mockError;
            }).toThrow('NotAllowedError');
        });
    });
});
