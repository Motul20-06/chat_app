import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDcFfqH2g_reAvnJkYtMPdh9jWjsw8trvM",
    authDomain: "learn-chat-cb8f8.firebaseapp.com",
    projectId: "learn-chat-cb8f8",
    storageBucket: "learn-chat-cb8f8.firebasestorage.app",
    messagingSenderId: "513936894097",
    appId: "1:513936894097:web:aef4763c71f78b7e69b730"
};

const app =
    initializeApp(firebaseConfig);

const db =
    getFirestore(app);

export { db };