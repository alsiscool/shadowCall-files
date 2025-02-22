// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBoNXJWKGfiEt_pw133fn-QG3OqIB3nses",
    authDomain: "shadowcall-wadadooco.firebaseapp.com",
    databaseURL: "https://shadowcall-wadadooco-default-rtdb.firebaseio.com",
    projectId: "shadowcall-wadadooco",
    storageBucket: "shadowcall-wadadooco.firebasestorage.app",
    messagingSenderId: "27660453993",
    appId: "1:27660453993:web:711f8271d5e0dfa807baf8",
    measurementId: "G-WGE0Z69E1Q"
};

// Use global Firebase object (no imports needed)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let userID = null; // This prevents duplicate accounts

// Join Sleepover button click event
document.getElementById("joinButton").addEventListener("click", function () {
    if (userID) {
        alert("You are already in the sleepover!");
        return; // Prevent duplicate entries
    }

    const name = document.getElementById("username").value;
    const fileInput = document.getElementById("profilePicInput").files[0];

    if (!name || !fileInput) {
        alert("Enter a name and select a profile picture!");
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(fileInput);
    reader.onloadend = function () {
        const profilePic = reader.result;

        // Save user to Firebase
        const userRef = db.ref("users").push();
        userRef.set({
            name: name,
            profilePic: profilePic
        }).then(() => {
            console.log("✅ User saved successfully!");
            userID = userRef.key; // Store the user ID

            // Hide the input section and show controls
            document.getElementById("userInput").style.display = "none";
            document.getElementById("userControls").style.display = "block";
        }).catch((error) => {
            console.error("❌ Error saving user:", error);
        });

        // Alert when a user joins
        alert(name + " sneaked into the sleepover! 🤫");
    };
});

// Leave Sleepover button
document.getElementById("leaveButton").addEventListener("click", function () {
    if (userID) {
        db.ref("users/" + userID).remove().then(() => {
            console.log("✅ User removed!");
            alert("You left the sleepover!");

            // Reset UI
            document.getElementById("userInput").style.display = "block";
            document.getElementById("userControls").style.display = "none";
            userID = null;
        }).catch((error) => {
            console.error("❌ Error removing user:", error);
        });
    }
});

// Toggle dropdown controls
document.getElementById("toggleControls").addEventListener("click", function () {
    const dropdown = document.getElementById("controlsDropdown");
    dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
});

// Show users in real-time
db.ref("users").on("value", (snapshot) => {
    const users = snapshot.val();
    const userList = document.getElementById("userList");
    userList.innerHTML = ""; // Clear the list

    if (users) {
        Object.entries(users).forEach(([key, user]) => {
            const userDiv = document.createElement("div");
            userDiv.innerHTML = `
                <img src="${user.profilePic}" width="100" height="100" style="border-radius: 50%;">
                <p id="message-${key}">${user.name} sneaked into the sleepover! 🤫</p>
            `;
            userList.appendChild(userDiv);

            // Make the "sneaked in" message disappear after 3 seconds
            setTimeout(() => {
                const messageElement = document.getElementById(`message-${key}`);
                if (messageElement) {
                    messageElement.textContent = user.name; // Keep the name
                }
            }, 3000);
        });
    }
});
