// Firebase configuration for Lottery Pool
// Replace with your actual Firebase config after creating project

const firebaseConfig = {
    apiKey: "AIzaSyBRjZfM9vQLvIk1z0EDq6JdBVowp79iXDs",
    authDomain: "lottery-pool-2026-60b8f.firebaseapp.com",
    projectId: "lottery-pool-2026-60b8f",
    storageBucket: "lottery-pool-2026-60b8f.firebasestorage.app",
    messagingSenderId: "1079694876079",
    appId: "1:1079694876079:web:9001969d1b9fdacf8a635a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Collection name
const POOL_COLLECTION = 'lotteryPool';
const POOL_DOC = 'main';

// Load pool data from Firebase
async function loadPoolDataFromFirebase() {
    try {
        const doc = await db.collection(POOL_COLLECTION).doc(POOL_DOC).get();
        if (doc.exists) {
            return doc.data();
        } else {
            // Initialize with default data if not exists
            const defaultData = getDefaultPoolData();
            await db.collection(POOL_COLLECTION).doc(POOL_DOC).set(defaultData);
            return defaultData;
        }
    } catch (error) {
        console.error('Error loading from Firebase:', error);
        // Fallback to localStorage
        return loadPoolDataFromLocal();
    }
}

// Save pool data to Firebase
async function savePoolDataToFirebase(data) {
    try {
        await db.collection(POOL_COLLECTION).doc(POOL_DOC).set(data);
        console.log('Data saved to Firebase');
        return true;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        return false;
    }
}

// Listen for real-time updates
function listenToPoolData(callback) {
    db.collection(POOL_COLLECTION).doc(POOL_DOC)
        .onSnapshot((doc) => {
            if (doc.exists) {
                callback(doc.data());
            }
        }, (error) => {
            console.error('Error listening to Firebase:', error);
        });
}

// Default pool data
function getDefaultPoolData() {
    return {
        "settings": {
            "jackpotThreshold": 30000000,
            "games": ["lotto-max", "649"],
            "contributionAmount": 5,
            "currency": "CAD",
            "trackWinnings": true,
            "winningsUsage": "tickets"
        },
        "winnings": {
            "totalWon": 10,
            "totalClaimed": 20,
            "availableForTickets": 0,
            "history": []
        },
        "members": [
            {"id": "joe", "name": "Joe", "contact": "", "active": true},
            {"id": "member2", "name": "Jess", "contact": "", "active": true},
            {"id": "member3", "name": "Kenji", "contact": "", "active": true}
        ],
        "draws": [],
        "contributions": [],
        "tickets": []
    };
}

// Export for use in main script
window.firebaseDB = {
    load: loadPoolDataFromFirebase,
    save: savePoolDataToFirebase,
    listen: listenToPoolData
};
