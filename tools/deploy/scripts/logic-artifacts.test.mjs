import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planLogicArtifactMigration, selectableLogicVersions } from '../esm/lib/logicArtifacts.js'

const entry = {
    gameId: 'oath',
    packageId: 'oath',
    logicVersion: '2.0.0',
    uiVersion: '2.1.0',
    priorLogicVersions: ['1.9.0'],
    history: [
        { logicVersion: '2.0.0', uiVersion: '2.1.0' },
        { logicVersion: '1.9.0', uiVersion: '2.0.0' },
        { logicVersion: '1.8.0', uiVersion: '1.8.0' }
    ]
}

test('selectable versions are the current logic and its rollback history, once each', () => {
    assert.deepEqual(selectableLogicVersions(entry), ['2.0.0', '1.9.0', '1.8.0'])
    assert.deepEqual(selectableLogicVersions({ ...entry, history: undefined }), ['2.0.0', '1.9.0'])
})

test('the plan names only the artifacts missing a sidecar, per missing file', async () => {
    const present = new Set([
        'gs://bucket/games/oath/logic/2.0.0/index.cjs',
        'gs://bucket/games/oath/logic/2.0.0/validators.cjs',
        'gs://bucket/games/oath/logic/1.9.0/index.cjs'
    ])
    const plans = await planLogicArtifactMigration([entry], 'bucket', async (url) =>
        present.has(url)
    )
    assert.deepEqual(plans, [
        {
            packageId: 'oath',
            gameId: 'oath',
            version: '1.9.0',
            url: 'gs://bucket/games/oath/logic/1.9.0',
            missing: ['validators.cjs']
        },
        {
            packageId: 'oath',
            gameId: 'oath',
            version: '1.8.0',
            url: 'gs://bucket/games/oath/logic/1.8.0',
            missing: ['index.cjs', 'validators.cjs']
        }
    ])
})
