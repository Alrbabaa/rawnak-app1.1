import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { firebaseApp, firebaseAuth } from "./client";

export interface QuizResultRecord {
  id?: string;
  videoId: string;
  videoTitle: string;
  scorePercent: number;
  correctAnswersCount: number;
  totalQuestions: number;
  timestamp: number;
  answersSummary?: { questionId: string; isCorrect: boolean }[];
}

const LOCAL_STORAGE_KEY = "rawnak_academy_quiz_scores";

/**
 * Saves a completed quiz result to Firestore and localStorage.
 */
export async function saveQuizScore(record: Omit<QuizResultRecord, "id" | "timestamp">): Promise<QuizResultRecord> {
  const timestamp = Date.now();
  const fullRecord: QuizResultRecord = {
    ...record,
    timestamp,
  };

  // 1. Always save to LocalStorage first for instant availability & offline support
  try {
    const existing = getLocalQuizScores();
    existing.unshift(fullRecord);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing.slice(0, 50)));
  } catch (err) {
    console.warn("Failed saving quiz score to localStorage:", err);
  }

  // 2. Try saving to Firestore if available
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return fullRecord;

    const db = getFirestore(firebaseApp);
    const docRef = await addDoc(collection(db, "users", user.uid, "academy_quiz_results"), {
      ...fullRecord,
      // The security rule requires the server timestamp, rather than a
      // client-clock value that could be forged or drift from request.time.
      createdAt: serverTimestamp(),
    });
    fullRecord.id = docRef.id;
  } catch (err) {
    console.warn("[Firestore] Unable to save quiz result to Firestore (using local fallback):", err);
  }

  return fullRecord;
}

/**
 * Fetches all saved quiz scores, merged from Firestore and LocalStorage.
 */
export async function getQuizHistory(videoId?: string): Promise<QuizResultRecord[]> {
  let localScores = getLocalQuizScores();
  if (videoId) {
    localScores = localScores.filter((s) => s.videoId === videoId);
  }

  try {
    const user = firebaseAuth.currentUser;
    if (!user) return localScores.sort((a, b) => b.timestamp - a.timestamp);

    const db = getFirestore(firebaseApp);
    const colRef = collection(db, "users", user.uid, "academy_quiz_results");
    
    let q;
    if (videoId) {
      q = query(colRef, where("videoId", "==", videoId), orderBy("createdAt", "desc"), limit(20));
    } else {
      q = query(colRef, orderBy("createdAt", "desc"), limit(30));
    }

    const snapshot = await getDocs(q);
    const firestoreScores: QuizResultRecord[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as Record<string, any>;
      firestoreScores.push({
        id: doc.id,
        videoId: data.videoId,
        videoTitle: data.videoTitle || "درس تعليمي",
        scorePercent: data.scorePercent || 0,
        correctAnswersCount: data.correctAnswersCount || 0,
        totalQuestions: data.totalQuestions || 0,
        timestamp: data.timestamp || (data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now()),
        answersSummary: data.answersSummary,
      });
    });

    if (firestoreScores.length > 0) {
      // Merge unique by timestamp or id
      const combined = [...firestoreScores];
      localScores.forEach((ls) => {
        if (!combined.some((fs) => fs.timestamp === ls.timestamp)) {
          combined.push(ls);
        }
      });
      return combined.sort((a, b) => b.timestamp - a.timestamp);
    }
  } catch (err) {
    console.warn("[Firestore] Reading quiz history from local cache:", err);
  }

  return localScores.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Reads scores stored locally in browser storage.
 */
export function getLocalQuizScores(): QuizResultRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const str = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!str) return [];
    return JSON.parse(str);
  } catch {
    return [];
  }
}
