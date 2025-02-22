const startCallButton = document.getElementById("startCall");
const muteButton = document.getElementById("muteToggle");
const leaveCallButton = document.getElementById("leaveCall");
const videoElement = document.getElementById("videoElement");

let localStream;

// WebRTC setup
let peerConnection;
const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }] // Free STUN server for peer connection
};

// Function to create a peer connection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);
    peerConnection.ontrack = (event) => {
        videoElement.srcObject = event.streams[0];
    };
}

// Start call
startCallButton.addEventListener("click", async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // Create peer connection
        createPeerConnection();
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        alert("Sleepover started! Share this page with your friends.");
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Please allow microphone access.");
    }
});

// Mute/Unmute
muteButton.addEventListener("click", () => {
    if (localStream) {
        localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
        muteButton.textContent = localStream.getAudioTracks()[0].enabled ? "Mute" : "Unmute";
    }
});

// Leave call
leaveCallButton.addEventListener("click", () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    alert("You left the sleepover.");
});
