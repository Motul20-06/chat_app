import { db,storage  } from "./firebase.js";

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
    orderBy,    
}
from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

import {
    ref,
    uploadBytes,
    getDownloadURL
}
from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";


// ===============================
// SESSION DATA
// ===============================

// IMPORTANT:
// sessionStorage is your only "state manager" between pages.
// If any of these are null → user refreshed or entered manually → redirect.
// let currentUserDocId = null;

const username = sessionStorage.getItem("username");
const roomId = sessionStorage.getItem("roomId");
const fileBtn = document.getElementById("fileBtn");
const fileInput = document.getElementById("fileInput");

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
// Prevent heartbeat from recreating user after leaving
let leavingRoom = false;

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
let userId = localStorage.getItem("userId");

if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("userId", userId);
}

const roomRef = doc(db, "rooms", roomId);
const usersRef = collection(db, "rooms", roomId, "users");
const currentUserRef = doc(db, "rooms", roomId, "users", userId);
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

        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {

            await setDoc(roomRef, {
                host: username,
                createdAt: Date.now(),
                lastActivity: Date.now()
            });

        }
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
    // const userDoc = await addDoc(usersRef, {
    //     username,
    //     joinedAt: serverTimestamp()
    // });
    // await setDoc(
    //     currentUserRef,
    //     {
    //         username,
    //         joinedAt: serverTimestamp(),
    //         lastSeen: Date.now()
    //     },
    //     { merge: true }
    // );
    // currentUserDocId = userDoc.id;

    const existingUser = await getDoc(currentUserRef);

    if (!existingUser.exists()) {

        await setDoc(currentUserRef,{
            username,
            joinedAt: serverTimestamp(),
            lastSeen: Date.now()
        });

    } else {

        await setDoc(
            currentUserRef,
            {
                username,
                lastSeen: Date.now()
            },
            { merge:true }
        );
    }

    // currentUserDocId = userId;

   
}

initRoom();


// ===============================
// USERS REAL-TIME LISTENER
// ===============================

// IMPORTANT:
// onSnapshot = real-time sync (Firestore pushes updates automatically)
onSnapshot(usersRef, (snapshot) => {

    // usersList.innerHTML = "";

    // snapshot.forEach((docSnap) => {
    //     const user = docSnap.data();
    //     addUser(user.username);
    // });
    usersList.innerHTML = "";

    const now = Date.now();

    snapshot.forEach((docSnap) => {

        const user = docSnap.data();

        if (
            user.lastSeen &&
            now - user.lastSeen > 60000
        ) {
            return;
        }

        addUser(user.username);
    });

    // No need for manual cleanup here
    // Firestore handles sync automatically
});

async function cleanupInactiveUsers() {

    const now = Date.now();

    const snapshot = await getDocs(usersRef);

    for (const userDoc of snapshot.docs) {

        const user = userDoc.data();

        if (
            user.lastSeen &&
            now - user.lastSeen > 60000
        ) {
            await deleteDoc(userDoc.ref);
        }
    }
}

if (isHost) {
    setInterval(cleanupInactiveUsers, 60000);
}

// ===============================
// MESSAGES REAL-TIME LISTENER
// ===============================

onSnapshot(messagesQuery, (snapshot) => {

    messages.innerHTML = "";

    snapshot.forEach((docSnap) => {

        const msg = docSnap.data();

        if (msg.type === "file") {

            addFileMessage(
                msg.username,
                msg.fileName,
                msg.fileUrl,
                msg.fileType
            );

        } else {

            addMessage(
                msg.username,
                msg.text
            );
        }
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


fileBtn.onclick = () => {
    fileInput.click();
};

fileInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];

    if (!file) return;

    // 5 MB limit
    if (file.size > 5 * 1024 * 1024) {
        alert("Maximum file size is 5 MB");
        return;
    }

    try {

        const fileRef = ref(
            storage,
            `rooms/${roomId}/${Date.now()}_${file.name}`
        );

        await uploadBytes(
            fileRef,
            file
        );

        const fileUrl =
            await getDownloadURL(fileRef);

        await addDoc(messagesRef, {
            type: "file",
            username,
            fileName: file.name,
            fileType: file.type,
            fileUrl,
            createdAt: Date.now()
        });

    } catch (err) {

        console.error("Upload error:", err);

        alert(
            err.message ||
            "Upload failed"
        );
    }

    fileInput.value = "";
});


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

        leavingRoom = true;

        // Remove this user from the room
        await deleteDoc(currentUserRef);

        // Remove inactive users before checking room size
        await cleanupInactiveUsers();

        const snapshot = await getDocs(usersRef);

        if (snapshot.size === 0) {

            const messagesSnapshot =
                await getDocs(messagesRef);

            for (const msg of messagesSnapshot.docs) {
                await deleteDoc(msg.ref);
            }

            await deleteDoc(roomRef);

            console.log(
                "Room + messages deleted"
            );
        }

    } catch (err) {
        console.error(err);
    }

    sessionStorage.clear();

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


function addFileMessage(
    sender,
    fileName,
    fileUrl,
    fileType
) {

    const div = document.createElement("div");

    div.className = "message";

    if (
        fileType &&
        fileType.startsWith("image/")
    ) {

        div.innerHTML = `
            <div class="message-name">
                ${sender}
            </div>

            <img
                src="${fileUrl}"
                alt="${fileName}"
                style="
                    max-width:250px;
                    border-radius:8px;
                    margin-top:5px;
                "
            >
        `;

    } else {

        div.innerHTML = `
            <div class="message-name">
                ${sender}
            </div>

            <a
                href="${fileUrl}"
                target="_blank"
            >
                📎 ${fileName}
            </a>
        `;
    }

    messages.appendChild(div);
}

// setInterval(async () => {

//     if (!currentUserDocId) return;

//     await setDoc(
//         doc(
//             db,
//             "rooms",
//             roomId,
//             "users",
//             currentUserDocId
//         ),
//         {
//             username,
//             lastSeen: Date.now()
//         },
//         { merge:true }
//     );

// }, 20000);
setInterval(async () => {

    if (leavingRoom) return;

    try {

        await setDoc(
            currentUserRef,
            {
                username,
                lastSeen: Date.now()
            },
            { merge: true }
        );

    } catch (err) {

        console.error("Heartbeat error:", err);

    }

}, 20000);