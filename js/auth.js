import { auth, db, APP_ID } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Đăng ký tài khoản mới
export async function registerUser(email, password, name, role, phone) {
    // 1. Tạo user trong Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Lưu thông tin phụ (Role, Tên) vào Firestore
    await setDoc(doc(db, "apps", APP_ID, "users", user.uid), {
        email: email,
        name: name,
        role: role,
        phone: phone,
        createdAt: new Date().toISOString()
    });
    return user;
}

// Đăng nhập
export async function loginUser(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
}

// Đăng xuất
export async function logoutUser() {
    await signOut(auth);
    // Không redirect nữa, main.js sẽ lắng nghe sự kiện auth changed để đổi giao diện
}

// Lấy thông tin role
export async function getUserProfile(uid) {
    const docRef = doc(db, "apps", APP_ID, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}