// Global state
let selectedAvatar = '😊';
let stream;
let audioEnabled = true;
let videoEnabled = true;
let audioContext;
let audioAnalyser;
let audioDataArray;

// Initialize when page loads
window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');

    // Debug click handler
    document.addEventListener('click', (e) => {
        console.log('Document clicked:', {
            x: e.clientX,
            y: e.clientY,
            target: e.target.tagName,
            id: e.target.id,
            className: e.target.className
        });
    }, true);

    // DOM Elements
    const avatarGrid = document.getElementById('avatarGrid');
    const avatarPreview = document.getElementById('avatarPreview');
    const userName = document.getElementById('userName');
    const audioInput = document.getElementById('audioInput');
    const videoInput = document.getElementById('videoInput');
    const audioLevel = document.getElementById('audioLevel');
    const videoQuality = document.getElementById('videoQuality');
    const previewVideo = document.getElementById('previewVideo');
    const togglePreviewAudio = document.getElementById('togglePreviewAudio');
    const togglePreviewVideo = document.getElementById('togglePreviewVideo');
    const backButton = document.getElementById('backButton');
    const joinButton = document.getElementById('joinButton');
    const mediaPrompt = document.getElementById('mediaPrompt');
    const retryMedia = document.getElementById('retryMedia');

    console.log('Elements found:', {
        avatarGrid: !!avatarGrid,
        userName: !!userName,
        joinButton: !!joinButton,
        backButton: !!backButton
    });

    // Device validation function
    async function validateDeviceId(deviceId, kind) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.deviceId === deviceId && device.kind === kind);
    }

    // Initialize media devices
    async function initializeDevices(combinedStream = null) {
        try {
            // Get available devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Populate audio input devices
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            audioDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Microphone ${audioInput.length + 1}`;
                audioInput.appendChild(option);
            });

            // Populate video input devices
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            videoDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${videoInput.length + 1}`;
                videoInput.appendChild(option);
            });

            // Initialize preview with combined stream if provided
            await startPreview(combinedStream);
        } catch (err) {
            console.error('Error accessing media devices:', err);
            alert('Failed to access camera/microphone. Please ensure permissions are granted.');
        }
    }

    // Start video preview
    async function startPreview(combinedStream = null) {
        try {
            // Stop existing tracks before starting new ones
            if (stream) {
                stream.getTracks().forEach(track => {
                    track.stop();
                    stream.removeTrack(track);
                });
            }

            // Create new stream
            const newStream = new MediaStream();
            
            // Use combined stream if provided
            if (combinedStream) {
                combinedStream.getTracks().forEach(track => newStream.addTrack(track));
                stream = newStream;
                console.log('Using combined stream:', stream.getTracks().map(t => t.kind + ': ' + t.label));
            } else {
                // Handle audio
                try {
                    if (audioInput.value && !(await validateDeviceId(audioInput.value, 'audioinput'))) {
                        throw new Error('Selected audio device not available');
                    }
                    const audioStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            deviceId: audioInput.value ? { exact: audioInput.value } : undefined,
                            echoCancellation: true,
                            noiseSuppression: true,
                        }
                    });
                    audioStream.getAudioTracks().forEach(track => newStream.addTrack(track));
                    console.log('Audio stream acquired:', audioStream.getAudioTracks()[0].label);
                } catch (audioErr) {
                    console.error('Failed to get audio:', audioErr);
                }

                // Handle video
                try {
                    if (videoInput.value && !(await validateDeviceId(videoInput.value, 'videoinput'))) {
                        throw new Error('Selected video device not available');
                    }
                    const videoStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            deviceId: videoInput.value ? { exact: videoInput.value } : undefined,
                            width: videoQuality.value === 'high' ? 1280 : videoQuality.value === 'medium' ? 720 : 480,
                            height: videoQuality.value === 'high' ? 720 : videoQuality.value === 'medium' ? 480 : 360,
                        }
                    });
                    videoStream.getVideoTracks().forEach(track => newStream.addTrack(track));
                    console.log('Video stream acquired:', videoStream.getVideoTracks()[0].label);
                } catch (videoErr) {
                    console.error('Failed to get video:', videoErr);
                }
            }

            stream = newStream;
            previewVideo.srcObject = stream;

            // Hide preview if no tracks available
            if (stream.getTracks().length === 0) {
                previewVideo.style.display = 'none';
            } else {
                previewVideo.style.display = 'block';
            }

            // Update button states
            if (stream.getAudioTracks().length > 0) {
                stream.getAudioTracks().forEach(track => {
                    track.enabled = audioEnabled;
                });
            }
            if (stream.getVideoTracks().length > 0) {
                stream.getVideoTracks().forEach(track => {
                    track.enabled = videoEnabled;
                });
            }

            updateControlButtons();
            console.log('Preview started with tracks:', stream.getTracks().map(t => t.kind + ': ' + t.label));
        } catch (err) {
            console.error('Error starting preview:', err);
            alert('Failed to start camera preview. Please check your settings and ensure permissions are granted.');
            showMediaPrompt();
        }
    }

    // Update control button states
    function updateControlButtons() {
        togglePreviewAudio.classList.toggle('muted', !audioEnabled);
        togglePreviewVideo.classList.toggle('video-off', !videoEnabled);
    }

    // Show media permissions modal
    function showMediaPrompt() {
        console.log('Showing media prompt');
        mediaPrompt.classList.remove('hidden');
    }

    // Hide media permissions modal
    function hideMediaPrompt() {
        console.log('Hiding media prompt');
        mediaPrompt.classList.add('hidden');
    }

    // Initialize devices with retry
    async function initializeWithRetry() {
        try {
            console.log('Initializing devices with retry');

            // Setup skip media button handler
            const skipMedia = document.getElementById('skipMedia');
            skipMedia.onclick = () => {
                hideMediaPrompt();
                // Continue without media devices
                initializeDevices(new MediaStream());
            };

            // Try to get media access but don't block on failure
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
                console.log('Audio access granted');
                
                const videoStream = await navigator.mediaDevices.getUserMedia({ 
                    video: true 
                });
                console.log('Video access granted');

                // Combine streams
                const tracks = [...audioStream.getTracks(), ...videoStream.getTracks()];
                const combinedStream = new MediaStream(tracks);
                
                hideMediaPrompt();
                await initializeDevices(combinedStream);
            } catch (mediaErr) {
                console.log('Media access not available:', mediaErr);
                showMediaPrompt();
            }
        } catch (err) {
            console.log('Media initialization error:', err);
            showMediaPrompt();
        }
    }

    // Handle form submissions and join button click
    const handleSubmit = (e) => {
        e.preventDefault();
        const name = userName.value.trim();
        if (name) {
            handleJoin(e);
        }
    };

    document.querySelector('.name-input').addEventListener('submit', handleSubmit);
    document.querySelector('.action-buttons').addEventListener('submit', handleSubmit);
    joinButton.addEventListener('click', handleSubmit);

    // Event Listeners
    avatarGrid.addEventListener('click', (e) => {
        const button = e.target.closest('.avatar-btn');
        if (button) {
            console.log('Avatar selected:', button.dataset.avatar);
            const emoji = button.dataset.avatar;
            selectedAvatar = emoji;
            avatarPreview.textContent = emoji;
            
            // Update selection styling
            avatarGrid.querySelectorAll('.avatar-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            button.classList.add('selected');
        }
    });

    // Device change handlers with validation
    audioInput.addEventListener('change', async () => {
        try {
            if (audioInput.value && !(await validateDeviceId(audioInput.value, 'audioinput'))) {
                throw new Error('Selected audio device not available');
            }
            await startPreview();
        } catch (err) {
            console.error('Audio device change failed:', err);
            alert('Failed to switch audio device. Please try another option.');
        }
    });

    videoInput.addEventListener('change', async () => {
        try {
            if (videoInput.value && !(await validateDeviceId(videoInput.value, 'videoinput'))) {
                throw new Error('Selected video device not available');
            }
            await startPreview();
        } catch (err) {
            console.error('Video device change failed:', err);
            alert('Failed to switch video device. Please try another option.');
        }
    });

    videoQuality.addEventListener('change', startPreview);

    audioLevel.addEventListener('input', (e) => {
        if (stream && stream.getAudioTracks && stream.getAudioTracks().length > 0) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                try {
                    audioTrack.applyConstraints({
                        volume: e.target.value / 100
                    });
                } catch (err) {
                    console.warn('Volume control not supported:', err);
                }
            }
        }
    });

    togglePreviewAudio.addEventListener('click', () => {
        console.log('Toggle audio clicked');
        audioEnabled = !audioEnabled;
        if (stream && stream.getAudioTracks) {
            stream.getAudioTracks().forEach(track => {
                track.enabled = audioEnabled;
            });
        }
        updateControlButtons();
    });

    togglePreviewVideo.addEventListener('click', () => {
        console.log('Toggle video clicked');
        videoEnabled = !videoEnabled;
        if (stream && stream.getVideoTracks) {
            stream.getVideoTracks().forEach(track => {
                track.enabled = videoEnabled;
            });
        }
        updateControlButtons();
    });

    backButton.addEventListener('click', () => {
        console.log('Back button clicked');
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        window.location.href = 'index.html';
    });

    const handleJoin = async (e) => {
        if (e) e.preventDefault();
        console.log('Join button clicked');
        const name = userName.value.trim();
        if (!name) {
            alert('Please enter your name');
            return;
        }

        // Save settings with default values for media
        const settings = {
            name,
            avatar: selectedAvatar,
            audioDevice: audioInput.value || '',
            videoDevice: videoInput.value || '',
            audioLevel: audioLevel.value || '50',
            videoQuality: videoQuality.value || 'medium',
            audioEnabled: false,  // Default to disabled if no devices
            videoEnabled: false   // Default to disabled if no devices
        };

        try {
            // Try to get media access but don't block on failure
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: true 
                });
                
                // If successful, update settings with media state
                settings.audioEnabled = true;
                settings.videoEnabled = true;

                // Stop the preview stream
                if (mediaStream) {
                    mediaStream.getTracks().forEach(track => track.stop());
                }
            } catch (mediaErr) {
                console.log('Media access not available:', mediaErr);
                // Continue without media devices
            }

            // Save settings regardless of media access
            localStorage.setItem('userSettings', JSON.stringify(settings));

            // Stop any existing preview stream
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            // Get room code from URL or create new room
            const urlParams = new URLSearchParams(window.location.search);
            const roomCode = urlParams.get('room');
            const isHost = urlParams.get('host') === 'true';

            console.log('Joining room:', { roomCode, isHost });
            // Redirect to room
            window.location.href = `room.html?room=${roomCode}&host=${isHost}`;
        } catch (err) {
            console.error('Failed to join:', err);
            alert('Error joining the call. Please try again.');
        }
    };

    // Expose handleJoin function to window
    console.log('Setting up join handler');
    window.handleJoin = (e) => {
        console.log('Join function called');
        handleJoin(e);
    };

    retryMedia.addEventListener('click', initializeWithRetry);

    // Load saved settings if they exist
    const savedSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
    if (savedSettings.name) {
        userName.value = savedSettings.name;
    }
    if (savedSettings.avatar) {
        selectedAvatar = savedSettings.avatar;
        avatarPreview.textContent = savedSettings.avatar;
        const button = avatarGrid.querySelector(`[data-avatar="${savedSettings.avatar}"]`);
        if (button) {
            button.classList.add('selected');
        }
    }

    // Initialize devices
    await initializeWithRetry();
});
