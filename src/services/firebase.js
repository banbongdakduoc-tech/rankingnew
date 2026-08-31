// src/services/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBV2h9BOmTQMLNFQ24r4SPQz3M8ERmVNLY",
  authDomain: "bxh-football.firebaseapp.com",
  databaseURL: "https://bxh-football-default-rtdb.firebaseio.com",
  projectId: "bxh-football",
  storageBucket: "bxh-football.firebasestorage.app",
  messagingSenderId: "526751547213",
  appId: "1:526751547213:web:a0ed95f858c10ac140c104",
  measurementId: "G-FLQQ932H63"
};

// Initialize Firebase safely without duplicate app initialization
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);
export const auth = getAuth(app);
export default app;
