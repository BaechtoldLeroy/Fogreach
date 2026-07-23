// js/leaderboard.js
//
// !! AKTUELL DEAKTIVIERT — wird von index.html NICHT geladen. !!
// Das Online-Leaderboard wird momentan nicht gebraucht, und die Firestore-
// Initialisierung lief bei JEDEM Seitenstart auf Modul-Ebene: sie oeffnete einen
// Backend-Kanal zu firestore.googleapis.com, der bei Blockade (Tracking-Schutz/
// Adblocker) oder offline dauerhaft Verbindungsversuche wiederholte und das
// Log mit Netzwerk-Fehlern flutete (SDK-interne Meldungen, per .catch NICHT
// unterdrueckbar). Das Spiel selbst braucht kein Netzwerk.
//
// Ohne den Script-Tag bleiben window.saveScore/loadScores undefined; die
// Aufrufer (js/scenes/startScene.js, js/main.js) pruefen per typeof und
// ueberspringen ihren Highscore-Block rueckstandslos.
//
// Zum Reaktivieren: in index.html die Firebase-Module + den leaderboard.js-
// Script-Tag wieder einkommentieren. Besser waere dabei, initializeApp/
// getFirestore LAZY in loadScores()/saveScore() zu verschieben, damit ohne
// geoeffnete Highscore-Liste gar keine Verbindung entsteht.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// 1) Hol dir die Konfiguration aus deiner Firebase-Konsole (Projekt-Einstellungen → SDK-Snippet)
const firebaseConfig = {
  apiKey: "AIzaSyBXCLFIN0LdA6PQ-ZJFddawAlg8GIKJ7IQ",
  authDomain: "demonfall-leaderboard.firebaseapp.com",
  projectId: "demonfall-leaderboard",
  storageBucket: "demonfall-leaderboard.firebasestorage.app",
  messagingSenderId: "104802489739",
  appId: "1:104802489739:web:ad37b32f63fcb24d744b8e"
};

// 2) Initialisiere Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const scoresCol = collection(db, 'leaderboard');

/**
 * Holt die Top-10 Scores, absteigend nach score.
 */
async function loadScores() {
  const q = query(scoresCol, orderBy('score','desc'), limit(10));
  const snap = await getDocs(q);
  // gib ein Array {name, score, ts} zurück
  return snap.docs.map(doc => doc.data());
}

/**
 * Speichert einen neuen Eintrag.
 * @param {string} name 
 * @param {number} score 
 */
async function saveScore(name, score) {
  if (!name || typeof score !== 'number') {
    throw new Error('Ungültige Daten');
  }
  await addDoc(scoresCol, {
    name,
    score,
    ts: Date.now()
  });
}

window.saveScore = saveScore;
window.loadScores = loadScores;