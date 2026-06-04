import { db } from "./firebase.js";

import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    query,        
    orderBy       
}
from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";


// ===============================
// SESSION DATA
// ===============================

// IMPORTANT:
// sessionStorage is your only "state manager" between pages.
// If any of these are null → user refreshed or entered manually → redirect.
let currentUserDocId = null;

const username = sessionStorage.getItem("username");
const roomId = sessionStorage.getItem("roomId");

// IMPORTANT:
// isHost is used ONLY to decide who creates the room document.
// Without this, multiple users might try to create same room.
const isHost = sessionStorage.getItem("isHost") === "true";

if (!username || !roomId) {
    window.location.href = "index.html";
}


// ===============================
// UI ELEMENTS
// ===============================

// These are cached once for performance (avoid repeated DOM lookups)
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const usersList = document.getElementById("usersList");
const messages = document.getElementById("messages");
const sendBtn = document.getElementById("sendBtn");
const messageBox = document.getElementById("messageBox");
const leaveRoomBtn = document.getElementById("leaveRoom");
const roomInfo = document.getElementById("roomInfo");


// ===============================
// DISPLAY INFO
// ===============================

// Shows room metadata in UI for debugging + UX clarity
roomCodeDisplay.textContent = roomId;

roomInfo.innerHTML = `
<b>Room:</b> ${roomId}
<br>
<b>You:</b> ${username}
${isHost ? " (Host)" : ""}
`;


// ===============================
// FIRESTORE REFERENCES
// ===============================

// IMPORTANT:
// These are reusable references used throughout the app.
// Keeps code clean and prevents repeated path building.
const roomRef = doc(db, "rooms", roomId);
const usersRef = collection(db, "rooms", roomId, "users");
const messagesRef = collection(db, "rooms", roomId, "messages");

const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc") // oldest → newest
);

// ===============================
// INIT ROOM
// ===============================

async function initRoom() {

    // HOST ONLY:
    // Host is responsible for creating the room document
    if (isHost) {

        await setDoc(roomRef, {
            host: username,
            createdAt: Date.now(),

            // IMPORTANT:
            // used later for cleanup (future feature)
            lastActivity: Date.now()
        });

    } else {

        // JOINERS:
        // verify room exists before entering chat
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            alert("Room not found");
            window.location.href = "index.html";
            return;
        }
    }

    // IMPORTANT:
    // Every user gets their own document in /users collection
    // This is how we track "online users"
    const userDoc = await addDoc(usersRef, {
        username,
        joinedAt: serverTimestamp()
    });

    currentUserDocId = userDoc.id;
}

initRoom();


// ===============================
// USERS REAL-TIME LISTENER
// ===============================

// IMPORTANT:
// onSnapshot = real-time sync (Firestore pushes updates automatically)
onSnapshot(usersRef, (snapshot) => {

    usersList.innerHTML = "";

    snapshot.forEach((docSnap) => {
        const user = docSnap.data();
        addUser(user.username);
    });

    // No need for manual cleanup here
    // Firestore handles sync automatically
});


// ===============================
// MESSAGES REAL-TIME LISTENER
// ===============================

onSnapshot(messagesQuery, (snapshot) => {

    messages.innerHTML = "";

    snapshot.forEach((docSnap) => {
        const msg = docSnap.data();
        addMessage(msg.username, msg.text);
    });

    // IMPORTANT:
    // Auto-scroll ensures newest message is always visible
    messages.scrollTop = messages.scrollHeight;
});


// ===============================
// SEND MESSAGE
// ===============================

sendBtn.onclick = async () => {

    const text = messageBox.value.trim();
    if (!text) return;

    await addDoc(messagesRef, {
        username,
        text,
        createdAt: Date.now()
    });

    // IMPORTANT:
    // updates room activity (useful later for inactivity cleanup)
    await setDoc(roomRef, {
        lastActivity: Date.now()
    }, { merge: true });

    messageBox.value = "";
};


// ===============================
// ENTER KEY SUPPORT
// ===============================

// Improves UX (users expect Enter to send message)
messageBox.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        sendBtn.click();
    }
});


// ===============================
// LEAVE ROOM (CRITICAL LOGIC)
// ===============================

leaveRoomBtn.onclick = async () => {

    if (!confirm("Leave room?")) return;

    try {

        // STEP 1:
        // Remove THIS user from Firestore users collection
        // This is what makes user "disappear" for everyone else
        if (currentUserDocId) {
            await deleteDoc(
                doc(db, "rooms", roomId, "users", currentUserDocId)
            );
        }

        // STEP 2:
        // Small delay to allow Firestore to sync deletion
        // (Firestore is eventually consistent)
        await new Promise(r => setTimeout(r, 300));

        // STEP 3:
        // Check if ANY users are still inside the room
        const snapshot = await getDocs(usersRef);

        // IMPORTANT:
        // If empty → room is no longer needed → delete it
        if (snapshot.empty) {
            await deleteDoc(roomRef);
            console.log("Room deleted (last user left)");
        }

    } catch (err) {
        console.error("Leave error:", err);
    }

    // Cleanup local session
    sessionStorage.clear();

    // Redirect back to home
    window.location.href = "index.html";
};


// ===============================
// UI HELPERS
// ===============================

function addUser(name) {

    const div = document.createElement("div");
    div.className = "user-item";
    div.textContent = name;

    usersList.appendChild(div);
}

function addMessage(sender, text) {

    const div = document.createElement("div");
    div.className = "message";

    div.innerHTML = `
        <div class="message-name">${sender}</div>
        <div>${text}</div>
    `;

    messages.appendChild(div);
}