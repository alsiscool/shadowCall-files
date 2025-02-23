// Initialize state
let peer;
let localStream;
let peers = {};
let startTime;
let timerInterval;
let connectedPeers = new Set();
let cameraTimer;
let unreadMessages = 0;
let audioContext;
let audioAnalyser;
let audioLevelInterval;

// DOM elements
const videoGrid = document.getElementById('videoGrid');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const callDuration = document.getElementById('callDuration');
const toggleAudioBtn = document.getElementById('toggleAudio');
const toggleVideoBtn = document.getElementById('toggleVideo');
const statusSelect = document.getElementById('statusSelect');
const customStatus = document.getElementById('customStatus');
const leaveCallBtn = document.getElementById('leaveCall');
const testAudioBtn = document.getElementById('testAudio');
const audioTest = document.getElementById('audioTest');
const audioLevel = document.getElementById('audioLevel');
const closeAudioTest = document.getElementById('closeAudioTest');
const setCameraTimer = document.getElementById('setCameraTimer');
const timerModal = document.getElementById('timerModal');
const timerHours = document.getElementById('timerHours');
const timerMinutes = document.getElementById('timerMinutes');
const cameraTimerBtn = document.getElementById('startTimer');
const cancelTimer = document.getElementById('cancelTimer');
const timerPresets = document.querySelector('.timer-presets');
const toggleChat = document.getElementById('toggleChat');
const chatPanel = document.getElementById('chatPanel');
const closeChat = document.getElementById('closeChat');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessage = document.getElementById('sendMessage');
const unreadBadge = document.querySelector('.unread-badge');

// Initialize state from settings
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const isHost = urlParams.get('host') === 'true';
const userSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');

// Validate settings
if (!userSettings.name || !userSettings.avatar) {
    console.error('Missing user settings, redirecting to setup...');
    window.location.href = 'prejoin.html?room=' + roomCode + (isHost ? '&host=true' : '');
}

roomCodeDisplay.textContent = roomCode;

// Initialize audio context after user interaction
let audioContextInitialized = false;

function initializeAudioContext() {
    if (audioContextInitialized) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.resume().then(() => {
            console.log('AudioContext initialized and resumed');
            audioContextInitialized = true;
        }).catch(err => {
            console.error('Failed to resume AudioContext:', err);
        });
    } catch (err) {
        console.error('Failed to initialize AudioContext:', err);
    }
}

// Add click listener to initialize audio
document.addEventListener('click', initializeAudioContext, { once: true });

// Initialize call timer
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    callDuration.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Initialize WebRTC with saved settings
async function initializeCall() {
    try {
        // Try to get media stream but don't block on failure
        try {
            const constraints = {
                video: {
                    deviceId: userSettings.videoDevice ? { exact: userSettings.videoDevice } : undefined,
                    width: userSettings.videoQuality === 'high' ? 1280 : userSettings.videoQuality === 'medium' ? 720 : 480,
                    height: userSettings.videoQuality === 'high' ? 720 : userSettings.videoQuality === 'medium' ? 480 : 360,
                },
                audio: {
                    deviceId: userSettings.audioDevice ? { exact: userSettings.audioDevice } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            };

            localStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaErr) {
            console.log('Media devices not available:', mediaErr);
            // Create empty MediaStream as fallback
            localStream = new MediaStream();
        }
        
        // Setup audio analysis after AudioContext is ready
        if (audioContextInitialized && audioContext) {
            try {
                const audioSource = audioContext.createMediaStreamSource(localStream);
                audioAnalyser = audioContext.createAnalyser();
                audioAnalyser.fftSize = 256;
                audioSource.connect(audioAnalyser);
                audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
                console.log('Audio analysis setup complete');
            } catch (err) {
                console.error('Failed to setup audio analysis:', err);
            }
        } else {
            console.log('Waiting for AudioContext initialization...');
            // Retry audio setup when context is ready
            document.addEventListener('click', () => {
                if (audioContextInitialized && audioContext && localStream) {
                    try {
                        const audioSource = audioContext.createMediaStreamSource(localStream);
                        audioAnalyser = audioContext.createAnalyser();
                        audioAnalyser.fftSize = 256;
                        audioSource.connect(audioAnalyser);
                        audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
                        console.log('Audio analysis setup complete (retry)');
                    } catch (err) {
                        console.error('Failed to setup audio analysis on retry:', err);
                    }
                }
            }, { once: true });
        }

        // Create local video element with user info
        addVideoStream(localStream, 'You', userSettings.name, userSettings.avatar);

        // Initialize PeerJS with local server
        const peerId = roomCode + (isHost ? '-host' : '-' + Math.random().toString(36).substring(7));
        peer = new Peer(peerId, {
            host: window.location.hostname,
            port: 9000,
            path: '/',
            secure: window.location.protocol === 'https:',
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            },
            debug: 3
        });

        // Add connection quality monitoring
        let connectionQualityInterval;
        peer.on('open', () => {
            console.log('Connected to PeerJS server');
            connectionQualityInterval = setInterval(async () => {
                if (peer.disconnected) {
                    console.log('Connection lost, attempting to reconnect...');
                    await reconnectPeer();
                }
            }, 5000);

            if (!isHost) {
                connectToHost();
            }
            startTimer();
        });

        function connectToHost() {
            const conn = peer.connect(roomCode + '-host', {
                metadata: {
                    name: userSettings.name,
                    avatar: userSettings.avatar
                },
                reliable: true,
                serialization: 'json'
            });
            setupDataConnection(conn);
        }

        peer.on('error', async (error) => {
            console.error('PeerJS error:', error);
            await handlePeerError(error);
        });

        // Handle browser visibility changes
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && peer.disconnected) {
                console.log('Page visible, checking connection...');
                await reconnectPeer();
            }
        });

        // Handle online/offline events
        window.addEventListener('online', async () => {
            console.log('Network online, checking connection...');
            await reconnectPeer();
        });

        window.addEventListener('offline', () => {
            console.log('Network offline');
            clearInterval(connectionQualityInterval);
        });

        // Handle incoming connections with duplicate prevention
        peer.on('connection', (conn) => {
            if (connectedPeers.has(conn.peer)) {
                console.log('Duplicate connection attempt, ignoring:', conn.peer);
                return;
            }
            setupDataConnection(conn);
        });

        // Handle incoming calls with metadata
        peer.on('call', (call) => {
            call.answer(localStream);
            setupCallHandlers(call);
        });

        // Apply initial audio/video state
        localStream.getAudioTracks().forEach(track => {
            track.enabled = userSettings.audioEnabled !== false;
        });
        localStream.getVideoTracks().forEach(track => {
            track.enabled = userSettings.videoEnabled !== false;
        });
        updateControlButtons();

    } catch (err) {
        console.error('Failed to initialize call:', err);
        handleMediaError(err);
    }
}

// Handle various peer errors with retry mechanism
function handlePeerError(error) {
    console.error('PeerJS error:', error);
    
    const maxRetries = 3;
    let retryCount = 0;
    let retryDelay = 1000; // Start with 1 second

    async function retryConnection() {
        if (retryCount >= maxRetries) {
            alert('Failed to reconnect after multiple attempts. Please try rejoining the call.');
            return;
        }

        try {
            await reconnectPeer();
            console.log('Reconnection successful');
        } catch (err) {
            console.error('Reconnection attempt failed:', err);
            retryCount++;
            retryDelay *= 2; // Exponential backoff
            setTimeout(retryConnection, retryDelay);
        }
    }

    switch (error.type) {
        case 'disconnected':
            retryConnection();
            break;
        case 'network':
            alert('Network connection unstable. Attempting to reconnect...');
            retryConnection();
            break;
        case 'browser-incompatible':
            alert('Your browser might not support all features. Please use Chrome, Firefox, or Safari.');
            break;
        case 'invalid-id':
            alert('Invalid room code. Please check and try again.');
            break;
        case 'unavailable-id':
            alert('This room is no longer available.');
            break;
        case 'peer-unavailable':
            alert('The person you\'re trying to connect to is offline.');
            break;
        default:
            alert('Connection error. Attempting to recover...');
            retryConnection();
    }
}

// Handle media errors
function handleMediaError(error) {
    console.error('Media error:', error);
    let message = 'Failed to access camera/microphone. ';
    if (error.name === 'NotAllowedError') {
        message += 'Please grant permission to use your camera and microphone.';
    } else if (error.name === 'NotFoundError') {
        message += 'No camera or microphone found.';
    } else {
        message += 'Please check your device settings.';
    }
    alert(message);
    window.location.href = 'prejoin.html?room=' + roomCode + (isHost ? '&host=true' : '');
}

// Setup data connection handlers
function setupDataConnection(conn) {
    conn.on('open', () => {
        console.log('Data connection established with:', conn.peer);
        connectedPeers.add(conn.peer);
        
        if (isHost) {
            connectToPeer(conn.peer, conn.metadata);
        }
    });

    conn.on('data', (data) => {
        try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            switch (parsedData.type) {
                case 'status':
                    updatePeerStatus(conn.peer, parsedData.status);
                    break;
                case 'chat':
                    addChatMessage(parsedData.message, false);
                    break;
                case 'videoState':
                    updatePeerVideoState(conn.peer, parsedData.enabled);
                    break;
                case 'audioState':
                    updatePeerAudioState(conn.peer, parsedData.enabled);
                    break;
            }
        } catch (err) {
            console.error('Error handling peer data:', err);
        }
    });

    conn.on('close', () => {
        console.log('Data connection closed:', conn.peer);
        connectedPeers.delete(conn.peer);
        removePeerVideo(conn.peer);
    });
}

// Setup call handlers
function setupCallHandlers(call) {
    call.on('stream', (userVideoStream) => {
        const peerMetadata = call.metadata || {};
        addVideoStream(
            userVideoStream,
            call.peer,
            peerMetadata.name || 'Anonymous',
            peerMetadata.avatar || '😊'
        );
    });

    call.on('close', () => {
        console.log('Call closed:', call.peer);
        removePeerVideo(call.peer);
    });

    call.on('error', (error) => {
        console.error('Call error:', error);
        removePeerVideo(call.peer);
    });

    peers[call.peer] = call;
}

// Connect to a peer with metadata
function connectToPeer(userId, metadata = {}) {
    const call = peer.call(userId, localStream, {
        metadata: {
            name: userSettings.name,
            avatar: userSettings.avatar
        }
    });
    setupCallHandlers(call);
}

// Add a video stream to the grid
function addVideoStream(stream, userId, userName = 'Anonymous', avatar = '😊') {
    // Remove existing video container if it exists
    const existingContainer = document.getElementById(`video-${userId}`);
    if (existingContainer) {
        existingContainer.remove();
    }

    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.id = `video-${userId}`;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    if (userId === 'You') video.muted = true;

    // Add camera-off elements
    const cameraOffAvatar = document.createElement('div');
    cameraOffAvatar.className = 'camera-off-avatar';
    const avatarEmoji = document.createElement('span');
    avatarEmoji.className = 'avatar-emoji';
    avatarEmoji.textContent = avatar;
    cameraOffAvatar.appendChild(avatarEmoji);

    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    const avatarSpan = document.createElement('span');
    avatarSpan.className = 'user-avatar';
    avatarSpan.textContent = avatar;
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'user-name';
    nameSpan.textContent = userName;

    const statusDiv = document.createElement('div');
    statusDiv.className = 'user-status';
    statusDiv.textContent = 'Active';

    userInfo.appendChild(avatarSpan);
    userInfo.appendChild(nameSpan);
    userInfo.appendChild(statusDiv);

    videoContainer.appendChild(video);
    videoContainer.appendChild(cameraOffAvatar);
    videoContainer.appendChild(userInfo);
    videoGrid.appendChild(videoContainer);

    // Update video container class based on video track state
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
        updateVideoDisplay(videoContainer, videoTrack.enabled);
        videoTrack.onended = () => updateVideoDisplay(videoContainer, false);
        videoTrack.onunmute = () => updateVideoDisplay(videoContainer, true);
        videoTrack.onmute = () => updateVideoDisplay(videoContainer, false);
    }
}

// Update video display based on camera state
function updateVideoDisplay(container, isEnabled) {
    if (isEnabled) {
        container.classList.remove('camera-off');
    } else {
        container.classList.add('camera-off');
    }

    // Update status indicators
    const statusIndicator = container.querySelector('.status-indicator') || document.createElement('div');
    statusIndicator.className = 'status-indicator';
    
    if (!isEnabled) {
        statusIndicator.textContent = '🎥❌';
        if (!container.contains(statusIndicator)) {
            container.appendChild(statusIndicator);
        }
    } else {
        statusIndicator.remove();
    }
}

// Update peer video state
function updatePeerVideoState(peerId, isEnabled) {
    const container = document.getElementById(`video-${peerId}`);
    if (container) {
        updateVideoDisplay(container, isEnabled);
    }
}

// Update peer audio state
function updatePeerAudioState(peerId, isEnabled) {
    const container = document.getElementById(`video-${peerId}`);
    if (container) {
        const statusIndicator = container.querySelector('.status-indicator') || document.createElement('div');
        statusIndicator.className = 'status-indicator';
        
        if (!isEnabled) {
            statusIndicator.textContent = '🔇';
            if (!container.contains(statusIndicator)) {
                container.appendChild(statusIndicator);
            }
        } else {
            const videoTrack = peers[peerId]?.peerConnection?.getRemoteStreams()[0]?.getVideoTracks()[0];
            if (!videoTrack?.enabled) {
                statusIndicator.textContent = '🎥❌';
            } else {
                statusIndicator.remove();
            }
        }
    }
}

// Remove peer's video
function removePeerVideo(peerId) {
    const videoContainer = document.getElementById(`video-${peerId}`);
    if (videoContainer) {
        videoContainer.remove();
    }
}

// Update peer's status
function updatePeerStatus(peerId, status) {
    const videoContainer = document.getElementById(`video-${peerId}`);
    if (videoContainer) {
        const statusDiv = videoContainer.querySelector('.user-status');
        if (statusDiv) {
            statusDiv.textContent = status;
        }
    }
}

// Attempt to reconnect peer
function reconnectPeer() {
    if (peer && peer.disconnected) {
        peer.reconnect();
    }
}

// Update control button states
function updateControlButtons() {
    const audioTrack = localStream.getAudioTracks()[0];
    const videoTrack = localStream.getVideoTracks()[0];
    
    toggleAudioBtn.classList.toggle('muted', !audioTrack.enabled);
    toggleVideoBtn.classList.toggle('video-off', !videoTrack.enabled);
    
    const localVideo = document.getElementById('video-You');
    if (localVideo) {
        updateVideoDisplay(localVideo, videoTrack.enabled);
    }
}

// Control handlers
toggleAudioBtn.addEventListener('click', () => {
    const audioTracks = localStream.getAudioTracks();
    const isEnabled = audioTracks[0].enabled;
    audioTracks[0].enabled = !isEnabled;
    updateControlButtons();
    
    // Broadcast audio state change
    Object.values(peers).forEach(peer => {
        if (peer.peerConnection) {
            const audioSender = peer.peerConnection.getSenders()
                .find(sender => sender.track.kind === 'audio');
            if (audioSender) {
                audioSender.track.enabled = !isEnabled;
            }
        }
    });
});

toggleVideoBtn.addEventListener('click', () => {
    const videoTracks = localStream.getVideoTracks();
    const isEnabled = videoTracks[0].enabled;
    videoTracks[0].enabled = !isEnabled;
    updateControlButtons();
    
    // Broadcast video state change
    Object.values(peers).forEach(peer => {
        if (peer.peerConnection) {
            const videoSender = peer.peerConnection.getSenders()
                .find(sender => sender.track.kind === 'video');
            if (videoSender) {
                videoSender.track.enabled = !isEnabled;
            }
        }
    });
});

statusSelect.addEventListener('change', (e) => {
    const status = e.target.value;
    const localVideo = document.getElementById('video-You');
    if (localVideo) {
        const statusDiv = localVideo.querySelector('.user-status');
        statusDiv.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        
        // Broadcast status change to all peers
        Object.values(peers).forEach(peer => {
            if (peer.peerConnection && peer.peerConnection.dataChannel) {
                peer.peerConnection.dataChannel.send(JSON.stringify({
                    type: 'status',
                    status: status
                }));
            }
        });
    }
});

leaveCallBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the call?')) {
        localStream.getTracks().forEach(track => track.stop());
        Object.values(peers).forEach(call => call.close());
        peer.destroy();
        clearInterval(timerInterval);
        window.location.href = 'index.html';
    }
});

// Audio test functionality
function startAudioTest() {
    audioTest.classList.remove('hidden');
    audioLevelInterval = setInterval(updateAudioLevel, 100);
}

function stopAudioTest() {
    audioTest.classList.add('hidden');
    clearInterval(audioLevelInterval);
}

function updateAudioLevel() {
    if (!audioAnalyser) return;
    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    audioAnalyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const level = (average / 255) * 100;
    audioLevel.style.width = `${level}%`;
}

// Camera timer functionality
function showTimerModal() {
    timerModal.classList.remove('hidden');
}

function hideTimerModal() {
    timerModal.classList.add('hidden');
    timerHours.value = '';
    timerMinutes.value = '';
}

function startCameraTimer(minutes) {
    if (cameraTimer) clearTimeout(cameraTimer);
    
    const ms = minutes * 60 * 1000;
    cameraTimer = setTimeout(() => {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            videoTracks[0].enabled = false;
            updateControlButtons();
            
            // Set status to sleeping
            statusSelect.value = 'sleeping';
            statusSelect.dispatchEvent(new Event('change'));
        }
    }, ms);
}

// Chat functionality
function toggleChatPanel() {
    chatPanel.classList.toggle('visible');
    if (chatPanel.classList.contains('visible')) {
        messageInput.focus();
        unreadMessages = 0;
        updateUnreadBadge();
    }
}

function updateUnreadBadge() {
    if (unreadMessages > 0) {
        unreadBadge.textContent = unreadMessages;
        unreadBadge.classList.remove('hidden');
    } else {
        unreadBadge.classList.add('hidden');
    }
}

function addChatMessage(text, isSent = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (!isSent && !chatPanel.classList.contains('visible')) {
        unreadMessages++;
        updateUnreadBadge();
    }
}

// Event listeners for new features
testAudioBtn.addEventListener('click', startAudioTest);
closeAudioTest.addEventListener('click', stopAudioTest);

setCameraTimer.addEventListener('click', showTimerModal);
cancelTimer.addEventListener('click', hideTimerModal);

cameraTimerBtn.addEventListener('click', () => {
    const hours = parseInt(timerHours.value) || 0;
    const minutes = parseInt(timerMinutes.value) || 0;
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes > 0) {
        startCameraTimer(totalMinutes);
        hideTimerModal();
    }
});

timerPresets.addEventListener('click', (e) => {
    if (e.target.matches('button')) {
        const minutes = parseInt(e.target.dataset.time);
        startCameraTimer(minutes);
        hideTimerModal();
    }
});

statusSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
        customStatus.classList.remove('hidden');
        customStatus.focus();
    } else {
        customStatus.classList.add('hidden');
        const status = e.target.value;
        broadcastStatus(status);
    }
});

customStatus.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const status = customStatus.value.trim();
        if (status) {
            broadcastStatus(status);
            customStatus.classList.add('hidden');
        }
    }
});

toggleChat.addEventListener('click', toggleChatPanel);
closeChat.addEventListener('click', () => chatPanel.classList.remove('visible'));

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (message) {
            addChatMessage(message);
            broadcastMessage(message);
            messageInput.value = '';
        }
    }
});

sendMessage.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message) {
        addChatMessage(message);
        broadcastMessage(message);
        messageInput.value = '';
    }
});

function broadcastStatus(status) {
    Object.values(peers).forEach(peer => {
        if (peer.peerConnection && peer.peerConnection.dataChannel) {
            peer.peerConnection.dataChannel.send(JSON.stringify({
                type: 'status',
                status: status
            }));
        }
    });
}

function broadcastMessage(message) {
    // Sanitize message to prevent XSS
    const sanitizedMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    Object.values(peers).forEach(peer => {
        if (peer.peerConnection && peer.peerConnection.dataChannel) {
            try {
                peer.peerConnection.dataChannel.send(JSON.stringify({
                    type: 'chat',
                    message: sanitizedMessage,
                    timestamp: Date.now()
                }));
            } catch (err) {
                console.error('Failed to send message to peer:', err);
                // Remove dead connections
                if (err.message.includes('closed') || err.message.includes('failed')) {
                    delete peers[peer.peer];
                }
            }
        }
    });
}

// Initialize everything
initializeCall();
