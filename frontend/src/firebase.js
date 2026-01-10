import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
    getFirestore,
    addDoc,
    collection,
    serverTimestamp,
    doc,
    updateDoc,
    increment,
    deleteField,
    onSnapshot,
    query,
    orderBy,
    deleteDoc,
    getDoc,
    runTransaction
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export async function uploadImage(file) {
    if (!file) return null;
    console.log("📤 firebase.uploadImage: Starting upload for", file.name);
    try {
        const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        console.log("📤 firebase.uploadImage: Upload successful. URL obtained.");
        return url;
    } catch (error) {
        console.error("❌ firebase.uploadImage Error:", error);
        throw error;
    }
}

export function getPosts(callback) {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(posts);
    });
}

export async function createPost(userId, username, caption, imageUrl) {
    console.log("📥 firebase.createPost: Starting creation", { userId, username, caption, imageUrl });
    try {
        // 1. Check for rumors using the backend API
        let isRumour = false;
        let rumorReason = "";

        console.log("📡 firebase.createPost: Checking for rumors via backend API...");
        try {
            const response = await fetch('http://localhost:8000/api/moderation/check_rumor/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: caption })
            });

            const data = await response.json();
            if (data.isRumour) {
                isRumour = true;
                rumorReason = data.warning;
                console.log("🚩 firebase.createPost: Post flagged as rumor!", data.warning);
            } else {
                console.log("✅ firebase.createPost: No rumor detected.");
            }
        } catch (apiError) {
            console.error("⚠️ firebase.createPost: Rumor API check failed (skipping):", apiError);
            // Fail open so users can still post even if AI check fails
        }

        // 2. Create the post in Firestore
        console.log("💾 firebase.createPost: Saving to Firestore...");
        const docRef = await addDoc(collection(db, "posts"), {
            user_id: userId,
            username: username,
            caption: caption,
            image: imageUrl,
            createdAt: serverTimestamp(),
            likes_count: 0,
            views: 0,
            reports_count: 0,
            likes: {},
            reports: {},
            is_rumour: isRumour,
            rumor_reason: rumorReason,
            status: "active"
        });
        console.log("✅ firebase.createPost: Firestore document created with ID:", docRef.id);
    } catch (error) {
        console.error("❌ firebase.createPost Error:", error);
        throw error;
    }
}

export async function addView(postId) {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
        views: increment(1)
    });
}

export async function likePost(postId, userId) {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
        [`likes.${userId}`]: true,
        likes_count: increment(1)
    });
}

export async function unlikePost(postId, userId) {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
        [`likes.${userId}`]: deleteField(),
        likes_count: increment(-1)
    });
}

export async function reportPost(postId, userId, reason) {
    const postRef = doc(db, "posts", postId);

    try {
        await runTransaction(db, async (transaction) => {
            const postSnap = await transaction.get(postRef);
            if (!postSnap.exists()) throw "Post does not exist!";

            const postData = postSnap.data();
            const reports = postData.reports || {};
            const previousReport = reports[userId];

            const updatedReports = {
                ...reports,
                [userId]: {
                    reason: reason,
                    reportedAt: new Date() // Can't use serverTimestamp() in transactions easily
                }
            };

            let newReportsCount = postData.reports_count || 0;

            // Increment misinformation count (allowing same user for easier testing per user request)
            if (reason === "misinformation") {
                newReportsCount += 1;
            }

            console.log(`Reporting post ${postId}. Current misinformation count: ${newReportsCount}`);

            const updateData = {
                reports: updatedReports,
                reports_count: newReportsCount
            };

            if (newReportsCount >= 3) {
                updateData.is_rumour = true;
                updateData.rumor_reason = "This post has been flagged by multiple community members as potentially containing false information.";
                console.log("Community threshold reached! Flagging as rumour.");

                // Auto-index this rumor in the database for future detection
                try {
                    fetch('http://localhost:8000/api/moderation/confirm_rumor/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: postData.caption || "" })
                    }).then(res => console.log("Rumor confirmation sent:", res.status));
                } catch (e) {
                    console.error("Failed to send rumor confirmation:", e);
                }
            }

            transaction.update(postRef, updateData);
        });
    } catch (error) {
        console.error("Transaction failed: ", error);
        throw error;
    }
}

export async function flagPost(postId) {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
        status: "flagged"
    });
}

export async function deletePost(postId) {
    if (!postId) {
        console.error("❌ firebase.deletePost: Missing postId");
        throw new Error("Invalid Post ID");
    }

    console.log("🔥 firebase.deletePost: Attempting to delete doc:", postId);
    try {
        const postRef = doc(db, "posts", postId);
        console.log("Ref path:", postRef.path);
        await deleteDoc(postRef);
        console.log("🔥 firebase.deletePost: Document successfully deleted");
    } catch (error) {
        console.error("❌ firebase.deletePost: Error:", error);
        throw error;
    }
}
