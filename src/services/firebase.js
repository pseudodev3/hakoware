import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, collection, getDocs, addDoc, 
  updateDoc, deleteDoc, doc, Timestamp, serverTimestamp 
} from "firebase/firestore";

// --- YOUR KEYS ---
const firebaseConfig = {
    apiKey: "AIzaSyAtxWdL4TVqgPmQJFd_UcPcDMm7_QbGBWw", 
    authDomain: "hakoware-92809.firebaseapp.com",
    projectId: "hakoware-92809",
    storageBucket: "hakoware-92809.firebasestorage.app",
    messagingSenderId: "161827009254",
    appId: "1:161827009254:web:84302cd63650563a50c127"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const fetchContracts = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "friends"));
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Helper: Convert Timestamp back to ISO string for React to read easily
      // This handles 'lastInteraction' (V1) and 'lastSpoke' (V2)
      let dateStr = new Date().toISOString();
      if (data.lastInteraction) {
          dateStr = data.lastInteraction.toDate().toISOString();
      } else if (data.lastSpoke) {
          dateStr = data.lastSpoke;
      }

      return {
        id: doc.id,
        ...data,
        lastSpoke: dateStr // Normalized for React
      };
    });
  } catch (e) {
    console.error("Fetch Error:", e);
    return [];
  }
};

// --- THE V1 COMPATIBLE CREATE FUNCTION ---
export const createContract = async (name, dateStr, limit, email, lastBankruptcyEmail) => {
    try {
        const finalLimit = parseInt(limit) || 0;
        
        // Date Logic: Convert String -> Date Object -> Firestore Timestamp
        // This ensures V1 logic (which uses .toDate()) doesn't crash
        const interactionDate = dateStr ? new Date(dateStr) : new Date();
        const firestoreTimestamp = Timestamp.fromDate(interactionDate);

        console.log(`📝 SAVING (V1 Format) -> Name: ${name}, Limit: ${finalLimit}`);

        await addDoc(collection(db, "friends"), {
            name: name,
            baseDebt: 0,
            
            // --- THE CRITICAL FIXES ---
            bankruptcyLimit: finalLimit,   // Name matches V1
            lastInteraction: firestoreTimestamp, // Type matches V1
            
            email: email || "",
            bankruptcyNotified: false,     // V1 Field
            createdAt: Timestamp.now(),    // V1 Field
            
            // New Feature Field
            lastBankruptcyEmail: lastBankruptcyEmail || null 
        });
    } catch (e) {
        console.error("Error adding contract: ", e);
    }
};

export const updateContract = async (id, currentTotalDebt, resetTimer = false) => {
    const ref = doc(db, "friends", id);
    const updates = { baseDebt: currentTotalDebt };
    
    if (resetTimer) {
        // Update both fields to keep V1 and V2 happy
        updates.lastInteraction = Timestamp.now();
        updates.lastSpoke = new Date().toISOString();
        updates.bankruptcyNotified = false;
    }
    
    await updateDoc(ref, updates);
};

export const markBankruptcyNotified = async (id) => {
    try {
        const contractRef = doc(db, "friends", id);
        await updateDoc(contractRef, {
            lastBankruptcyEmail: new Date().toISOString(),
            bankruptcyNotified: true // Keep V1 happy
        });
    } catch (e) {
        console.error("Error updating notification status: ", e);
    }
};

export const deleteContract = async (id) => {
    await deleteDoc(doc(db, "friends", id));
};

export { auth, db, serverTimestamp };
