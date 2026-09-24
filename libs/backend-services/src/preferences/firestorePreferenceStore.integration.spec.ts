import { Firestore } from '@google-cloud/firestore'
import { afterAll, expect, it } from 'vitest'
import { FirestorePreferenceStore } from './firestorePreferenceStore.js'

const firestore = new Firestore({ projectId: 'pane-preference-test' })
const store = new FirestorePreferenceStore(firestore)
const userId = `layout-${Date.now()}`
afterAll(async () => {
    if (process.env.FIRESTORE_EMULATOR_HOST) await firestore.recursiveDelete(firestore.collection('users').doc(userId))
    await firestore.terminate()
})
it.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('round trips split layouts through the actual Firestore store, preserving older preferences', async () => {
    const scopes = ['title:the-old-prince', 'family:18xx']
    const old = { version: 1, revision: 2, values: { theme: 'dark' } }
    await firestore.collection('users').doc(userId).collection('preferences').doc(encodeURIComponent(scopes[1])).set(old)
    expect(await store.read(userId, scopes)).toEqual([undefined, old])
    const layout = { v: 1, sidebar: ['Players', 'Chat'], main: ['rows', 40, ['Actions'], ['cols', 55, ['Map'], ['Spreadsheet', 'History']]] }
    const updated = { version: 1, revision: 3, values: { theme: 'dark', paneLayout: layout } }
    await store.update(userId, scopes, () => ({ changedIndex: 1, records: [{ version: 1, revision: 0, values: {} }, updated] }))
    expect(await store.read(userId, scopes)).toEqual([undefined, updated])
    await store.update(userId, scopes, records => {
        const family = records[1]
        if (!family) throw new Error('Missing family preferences')
        return { changedIndex: 1, records: [{ version: 1, revision: 0, values: {} }, { ...family, revision: 4, values: { ...family.values, theme: 'light' } }] }
    })
    expect((await store.read(userId, scopes))[1]).toEqual({ ...updated, revision: 4, values: { ...updated.values, theme: 'light' } })
})
