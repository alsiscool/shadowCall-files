const startCallButton = document.getElementById("startCall");
const muteButton = document.getElementById("muteToggle");
const leaveCallButton = document.getElementById("leaveCall");
const videoElement = document.getElementById("videoElement");

let localStream;

// Start call
startCallButton.addEventListener("click", async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        videoElement.srcObject = localStream;
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
