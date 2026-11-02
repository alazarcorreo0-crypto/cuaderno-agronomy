import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBcASI713Reo9bMOb9JYchAx-tTAeZWuo4',
  authDomain: 'cuaderno-agronomy.firebaseapp.com',
  projectId: 'cuaderno-agronomy',
  storageBucket: 'cuaderno-agronomy.firebasestorage.app',
  messagingSenderId: '505841559526',
  appId: '1:505841559526:web:f93750968ebed32cff1827',
  measurementId: 'G-M6013YXX18',
}

const app = initializeApp(firebaseConfig)

/**
 * Caché local persistente de Firestore: las lecturas y escrituras siguen
 * funcionando sin conexión y se sincronizan cuando vuelve la red.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

export const analytics = getAnalytics(app)
