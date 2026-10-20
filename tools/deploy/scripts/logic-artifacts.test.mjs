import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planLogicArtifactMigration } from '../esm/lib/logicArtifacts.js'

const entry = {
    gameId: 'oath',
    packageId: 'oath',
    logicVersion: '2.0.0',
    uiVersion: '2.1.0',
    priorLogicVersions: ['1.9.0'],
    history: [
        { logicVersion: '2.0.0', uiVersion: '2.1.0' },
        { logicVersion: '1.9.0', uiVersion: '2.0.0' }
    ]
}

test('the plan covers only current logic versions that lack their factory', async () => {
    const present = new Set(['gs://bucket/games/sol/logic/3.0.0/index.cjs'])
    const sol = { ...entry, gameId: 'sol', packageId: 'sol', logicVersion: '3.0.0' }
    const plans = await planLogicArtifactMigration([entry, sol], 'bucket', async (url) =>
        present.has(url)
    )
    assert.deepEqual(plans, [
        {
            packageId: 'oath',
            gameId: 'oath',
            version: '2.0.0',
            url: 'gs://bucket/games/oath/logic/2.0.0',
            missing: ['index.cjs']
        }
    ])
})
