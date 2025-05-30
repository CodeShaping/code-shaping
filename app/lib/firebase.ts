// import { initializeApp } from "firebase/app";
// import { 
//     getFirestore, 
//     addDoc, 
//     collection, 
//     serverTimestamp,
//     getDocs,
//     type DocumentData
//  } from "firebase/firestore";


// const firebaseConfig = {
//     apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//     authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//     projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//     storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
//     messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
//     appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
//     measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
// };

// const app = initializeApp(firebaseConfig);
// export const db = getFirestore(app);


// // {userId}-{taskId}
// export const addCollection = async (collectionName: string, data: any) => {
//     // return;
//     try {
//         const docRef = await addDoc(collection(db, collectionName), {
//             ...data,
//             createdAt: serverTimestamp()
//         });
//         console.log(`[Log] ${data.logType}, ${docRef.id}`);
//     } catch (e) {
//         console.error("Error adding document: ", e);
//     }
// }

// export const getAllDataFromCollection = async (collectionName: string) => {
//     const querySnapshot = await getDocs(collection(db, collectionName));
//     const data = querySnapshot.docs.map(doc => doc.data());
//     return data as DocumentData[];
// }