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

// Fix: Remove imports, use global Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Button click event
document.getElementById("joinButton").addEventListener("click", function () {
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
        }).catch((error) => {
            console.error("❌ Error saving user:", error);
        });

        // Alert when a user joins
        alert(name + " sneaked into the sleepover! 🤫");
    };
});

// Show users in real-time
db.ref("users").on("value", (snapshot) => {
    const users = snapshot.val();
    const userList = document.getElementById("userList");
    userList.innerHTML = ""; // Clear the list

    if (users) {
        Object.values(users).forEach(user => {
            const userDiv = document.createElement("div");
            userDiv.innerHTML = `
                <img src="${user.profilePic}" width="100" height="100" style="border-radius: 50%;">
                <p>${user.name} sneaked into the sleepover! 🤫</p>
            `;
            userList.appendChild(userDiv);
        });
    }
});
