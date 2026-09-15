import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Tournament, TournamentSchedule } from '../../libs/common/esm/index.js'
import { storeTournamentSchedule } from '../../libs/backend-services/esm/persistence/model/storedTournamentSchedule.js'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT)
    throw new Error('Set FIRESTORE_EMULATOR_HOST and GCLOUD_PROJECT for the local data migration')

const require = createRequire(
    fileURLToPath(new URL('../../libs/backend-services/package.json', import.meta.url))
)
const { Firestore } = require('@google-cloud/firestore')
const Value = await import(require.resolve('typebox/value'))
const firestore = new Firestore({ projectId: process.env.GCLOUD_PROJECT })
let migrated = 0
try {
    const documents = await firestore.collection('tournaments').get()
    for (const document of documents.docs) {
        const original = document.data()
        if (Array.isArray(original.entrants)) continue
        const entrants = (await document.ref.collection('entrants').get()).docs.map((entrant) =>
            entrant.data()
        )
        const stageDocs = await document.ref.collection('stages').get()
        const stages = stageDocs.docs.map((document) => {
            const stage = document.data()
            delete stage.tournamentId
            return stage
        })
        const schedules = []
        for (const stage of stages) {
            if (!stage.scheduleId) continue
            const ref = document.ref
                .collection('stages')
                .doc(stage.id)
                .collection('schedules')
                .doc(stage.scheduleId)
            const metadata = (await ref.get()).data()
            const tables = (await ref.collection('tables').orderBy('__name__').get()).docs.map(
                (table) => table.data()
            )
            const schedule = { ...metadata, tables }
            Value.Assert(TournamentSchedule, schedule)
            schedules.push(storeTournamentSchedule(schedule))
        }
        const tournament = { ...original, entrants, stages }
        delete tournament.entrantCount
        Value.Assert(Tournament, tournament)
        await firestore.runTransaction(async (transaction) => {
            const latest = (await transaction.get(document.ref)).data()
            if (!Value.Equal(original, latest))
                throw new Error(`Tournament changed during migration: ${document.id}`)
            for (const schedule of schedules)
                transaction.create(
                    document.ref.collection('schedules').doc(schedule.stageId),
                    schedule
                )
            transaction.set(document.ref, {
                ...tournament,
                entrantIds: entrants.map((entrant) => entrant.userId)
            })
        })
        await firestore.recursiveDelete(document.ref.collection('entrants'))
        await firestore.recursiveDelete(document.ref.collection('stages'))
        migrated++
    }
    const memberships = await firestore.collectionGroup('tournamentEntries').get()
    for (const entry of memberships.docs) await entry.ref.delete()
    console.log(
        `Migrated ${migrated} local tournaments to embedded rosters/stages and one document per schedule`
    )
} finally {
    await firestore.terminate()
}
