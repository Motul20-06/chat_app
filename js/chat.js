import { db } from "./firebase.js";

import {
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp,
    deleteDoc
}
from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";


// ===============================
// Session Data
// ===============================

let currentUserDocId = null;

const username =
    sessionStorage.getItem(
        "username"
    );

const roomId =
    sessionStorage.getItem(
        "roomId"
    );

const isHost =
    sessionStorage.getItem(
        "isHost"
    ) === "true";

if (
    !username ||
    !roomId
) {

    window.location.href =
        "index.html";

}


// ===============================
// UI Elements
// ===============================

const roomCodeDisplay =
    document.getElementById(
        "roomCodeDisplay"
    );

const usersList =
    document.getElementById(
        "usersList"
    );

const messages =
    document.getElementById(
        "messages"
    );

const sendBtn =
    document.getElementById(
        "sendBtn"
    );

const messageBox =
    document.getElementById(
        "messageBox"
    );

const leaveRoomBtn =
    document.getElementById(
        "leaveRoom"
    );

const roomInfo =
    document.getElementById(
        "roomInfo"
    );


// ===============================
// Display Info
// ===============================

roomCodeDisplay.textContent =
    roomId;

roomInfo.innerHTML =
`
<b>Room:</b> ${roomId}
<br>
<b>You:</b> ${username}
${isHost ? " (Host)" : ""}
`;


// ===============================
// Firestore References
// ===============================

const roomRef =
    doc(
        db,
        "rooms",
        roomId
    );

const usersRef =
    collection(
        db,
        "rooms",
        roomId,
        "users"
    );

const messagesRef =
    collection(
        db,
        "rooms",
        roomId,
        "messages"
    );


// ===============================
// Init Room
// ===============================

async function initRoom() {

    if (isHost) {

        await setDoc(
            roomRef,
            {
                host: username,
                createdAt:
                    Date.now(),
                lastActivity:
                    Date.now()
            }
        );

    }
    else {

        const roomSnap =
            await getDoc(
                roomRef
            );

        if (
            !roomSnap.exists()
        ) {

            alert(
                "Room not found"
            );

            window.location.href =
                "index.html";

            return;

        }

    }

    

    const userDoc = await addDoc(
        usersRef,
        {
            username: username,
            joinedAt: serverTimestamp()
        }
    );

    currentUserDocId = userDoc.id;

}

initRoom();


// ===============================
// Users Listener
// ===============================

onSnapshot(
    usersRef,
    (snapshot) => {

        usersList.innerHTML =
            "";

        snapshot.forEach(
            (docSnap) => {

                const user =
                    docSnap.data();

                addUser(
                    user.username
                );

            }
        );

    }
);


// ===============================
// Messages Listener
// ===============================

onSnapshot(
    messagesRef,
    (snapshot) => {

        messages.innerHTML =
            "";

        snapshot.forEach(
            (docSnap) => {

                const msg =
                    docSnap.data();

                addMessage(
                    msg.username,
                    msg.text
                );

            }
        );

        messages.scrollTop =
            messages.scrollHeight;

    }
);


// ===============================
// Send Message
// ===============================

sendBtn.onclick =
async () => {

    const text =
        messageBox.value.trim();

    if (!text) {

        return;

    }

    await addDoc(
        messagesRef,
        {
            username:
                username,

            text:
                text,

            createdAt:
                serverTimestamp()
        }
    );

    await setDoc(
        roomRef,
        {
            lastActivity:
                Date.now()
        },
        {
            merge: true
        }
    );

    messageBox.value =
        "";

};


// ===============================
// Enter Key
// ===============================

messageBox.addEventListener(
    "keypress",
    (event) => {

        if (
            event.key ===
            "Enter"
        ) {

            sendBtn.click();

        }

    }
);


// ===============================
// Leave Room
// ===============================

leaveRoomBtn.onclick =
async () => {

    if (!confirm("Leave room?")) {
        return;
    }

    if (currentUserDocId) {

        await deleteDoc(
            doc(
                db,
                "rooms",
                roomId,
                "users",
                currentUserDocId
            )
        );

    }

    const usersSnapshot =
        await getDocs(usersRef);

    if (
        usersSnapshot.empty
    ) {

        await deleteDoc(roomRef);

    }

    sessionStorage.clear();

    window.location.href =
        "index.html";

};


// ===============================
// UI Helpers
// ===============================

function addUser(name) {

    const div =
        document.createElement(
            "div"
        );

    div.className =
        "user-item";

    div.textContent =
        name;

    usersList.appendChild(
        div
    );

}


function addMessage(
    sender,
    text
) {

    const div =
        document.createElement(
            "div"
        );

    div.className =
        "message";

    div.innerHTML =
    `
        <div class="message-name">
            ${sender}
        </div>

        <div>
            ${text}
        </div>
    `;

    messages.appendChild(
        div
    );

}

window.addEventListener(
    "beforeunload",
    async () => {

        if (!currentUserDocId) {
            return;
        }

        try {

            await deleteDoc(
                doc(
                    db,
                    "rooms",
                    roomId,
                    "users",
                    currentUserDocId
                )
            );

        }
        catch (err) {
            console.error(err);
        }

    }
);