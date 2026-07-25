import { initializeApp, getApps } from 'firebase-admin/app'

export const app = getApps().length > 0 ? getApps()[0] : initializeApp()
