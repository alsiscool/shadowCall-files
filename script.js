// Firebase Setup
const firebaseConfig = {
    apiKey: "YOUR-FIREBASE-API-KEY",
    authDomain: "YOUR-FIREBASE-PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR-FIREBASE-PROJECT.firebaseio.com",
    projectId: "YOUR-FIREBASE-PROJECT",
    storageBucket: "YOUR-FIREBASE-PROJECT.appspot.com",
    messagingSenderId: "YOUR-FIREBASE-MESSAGING-ID",
    appId: "YOUR-FIREBASE-APP-ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Join button
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

        // Send to Firebase
        const userRef = db.ref("users").push();
        userRef.set({
            name: name,
            profilePic: profilePic
        });
    };
});

// Update the user list in real time
db.ref("users").on("value", (snapshot) => {
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
