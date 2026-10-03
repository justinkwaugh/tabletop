import { Firestore, type Settings } from '@google-cloud/firestore'
import { randomUUID } from 'node:crypto'

// The emulator's singleProjectMode serves every project id from the one local project, so only a
// named database isolates a spec from local data; --export-on-exit saves just the (default) one.
export function isolatedFirestore(settings: Settings = {}): Firestore {
    return new Firestore({
        ...settings,
        projectId: 'demo-tabletop',
        databaseId: `test-${randomUUID()}`
    })
}
