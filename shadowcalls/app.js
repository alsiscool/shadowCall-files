// WebRTC configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// DOM elements
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const joinDialog = document.getElementById('joinDialog');
const roomCodeInput = document.getElementById('roomCode');
const joinWithCodeBtn = document.getElementById('joinWithCode');
const cancelJoinBtn = document.getElementById('cancelJoin');

// Event listeners for landing page
createRoomBtn.addEventListener('click', createNewRoom);
joinRoomBtn.addEventListener('click', () => joinDialog.classList.remove('hidden'));
cancelJoinBtn.addEventListener('click', () => joinDialog.classList.add('hidden'));
joinWithCodeBtn.addEventListener('click', joinExistingRoom);

// Generate a random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create a new room
function createNewRoom() {
    const roomCode = generateRoomCode();
    localStorage.setItem('roomCode', roomCode);
    window.location.href = `prejoin.html?room=${roomCode}&host=true`;
}

// Join an existing room
function joinExistingRoom() {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (roomCode) {
        localStorage.setItem('roomCode', roomCode);
        window.location.href = `prejoin.html?room=${roomCode}`;
    } else {
        alert('Please enter a valid room code');
    }
}
