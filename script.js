// Import Firebase SDK (For older script tag method)
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, set, onValue } from "firebase/database";

// Firebase Configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Join button event listener
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

        // Push user data to Firebase
        const userRef = push(ref(db, "users"));
        set(userRef, {
            name: name,
            profilePic: profilePic
        });
    };
});

// Update the user list in real-time
onValue(ref(db, "users"), (snapshot) => {
    const users = snapshot.val();
    const userList = document.getElementById("userList");
    userList.innerHTML = ""; // Clear the list

    if (users) {
        Object.values(users).forEach(user => {
            const userDiv = document.createElement("div");
            userDiv.innerHTML = `
                <img src="${user.profilePic}" width="50" height="50">
                <p>${user.name}</p>
            `;
            userList.appendChild(userDiv);
        });
    }
});
