import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBHiAufmktyog7Jmd2PINr-jRQMVpfG6pU",
  authDomain: "baerenstarker-app.firebaseapp.com",
  projectId: "baerenstarker-app",
  storageBucket: "baerenstarker-app.firebasestorage.app",
  messagingSenderId: "169875598096",
  appId: "1:169875598096:web:543aab167df4d3d8d89395"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
