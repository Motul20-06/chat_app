const createBtn =
    document.getElementById(
        "createRoom"
    );

const joinBtn =
    document.getElementById(
        "joinRoom"
    );


// ===============================
// Create Room
// ===============================

createBtn.onclick = () => {

    const username =
        document.getElementById(
            "username"
        ).value.trim();

    if (!username) {

        alert(
            "Enter a username"
        );

        return;
    }

    // Save username
    sessionStorage.setItem(
        "username",
        username
    );

    // Generate room code
    const roomId =
        Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();

    sessionStorage.setItem(
        "roomId",
        roomId
    );

    sessionStorage.setItem(
        "isHost",
        "true"
    );

    // Go to chat page
    window.location.href =
        "chat.html";

};


// ===============================
// Join Room
// ===============================

joinBtn.onclick = () => {

    const username =
        document.getElementById(
            "username"
        ).value.trim();

    const roomCode =
        document.getElementById(
            "roomCode"
        ).value.trim()
        .toUpperCase();

    if (!username) {

        alert(
            "Enter a username"
        );

        return;
    }

    if (!roomCode) {

        alert(
            "Enter a room code"
        );

        return;
    }

    sessionStorage.setItem(
        "username",
        username
    );

    sessionStorage.setItem(
        "roomId",
        roomCode
    );

    sessionStorage.setItem(
        "isHost",
        "false"
    );

    // Go to chat page
    window.location.href =
        "chat.html";

};