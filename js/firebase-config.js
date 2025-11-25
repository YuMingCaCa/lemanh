// Import các hàm từ CDN (phiên bản ổn định 10.12.2)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Cấu hình Firebase của bạn
const firebaseConfig = {
    apiKey: "AIzaSyAmCLDGOcUGB8e99H1vl6dCK9aS4w9s4jg",
    authDomain: "vantainamhieu-9cd11.firebaseapp.com",
    projectId: "vantainamhieu-9cd11",
    storageBucket: "vantainamhieu-9cd11.firebasestorage.app",
    messagingSenderId: "500173440704",
    appId: "1:500173440704:web:2655064b47f3be475e4f25"
};

// Khởi tạo và Export để dùng ở file khác
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ID bộ sưu tập chung
const APP_ID = "manager"; 

export { db, auth, collection, APP_ID, signInAnonymously };