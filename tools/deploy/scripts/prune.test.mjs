import assert from 'node:assert/strict'
import test from 'node:test'
import { frontendPruneTarget, planTarget, pruneTargets } from '../esm/lib/prune.js'

const now = new Date('2026-10-09T12:00:00Z')
const old = '2026-08-01T00:00:00Z'
const recent = '2026-10-05T00:00:00Z'

const versionObjects = (prefix, version, createdAt, size = 100) => [
    { name: `${prefix}/${version}/`, size: 0, createdAt },
    { name: `${prefix}/${version}/index.js`, size, createdAt },
    { name: `${prefix}/${version}/assets/`, size: 0, createdAt },
    { name: `${prefix}/${version}/assets/chunk.js`, size, createdAt }
]

const manifest = {
    frontend: {
        version: '3.0.0',
        history: [{ version: '3.0.0' }, { version: '2.0.0' }]
    },
    games: [
        {
            gameId: 'sample',
            packageId: 'sample-game',
            logicVersion: '1.1.0',
            uiVersion: '1.4.0',
            history: [
                { logicVersion: '1.1.0', uiVersion: '1.4.0' },
                { logicVersion: '1.0.0', uiVersion: '1.2.0' }
            ]
        },
        { gameId: 'other', packageId: 'other', logicVersion: '0.1.0', uiVersion: '0.1.0' }
    ]
}

const keepByVersion = (plan) =>
    Object.fromEntries(plan.versions.map((version) => [version.version, version.keep ?? 'delete']))

test('keeps the current version, the rollback history, and recent uploads', () => {
    const [, ui] = pruneTargets(manifest, ['sample-game'])
    const objects = [
        { name: 'games/sample-game/ui/', size: 0, createdAt: old },
        ...versionObjects(ui.prefix, '1.0.0', old),
        ...versionObjects(ui.prefix, '1.1.0', old),
        ...versionObjects(ui.prefix, '1.2.0', old),
        ...versionObjects(ui.prefix, '1.3.0', recent),
        ...versionObjects(ui.prefix, '1.4.0', old)
    ]
    const plan = planTarget(ui, objects, now, 7)
    assert.deepEqual(keepByVersion(plan), {
        '1.0.0': 'delete',
        '1.1.0': 'delete',
        '1.2.0': 'history',
        '1.3.0': 'recent',
        '1.4.0': 'current'
    })
    assert.equal(plan.versions.find((version) => version.version === '1.0.0').bytes, 200)
})

test('a zero-day grace keeps only what the manifest references', () => {
    const [logic] = pruneTargets(manifest, ['sample-game'])
    const objects = ['0.9.0', '1.0.0', '1.1.0'].flatMap((version) =>
        versionObjects(logic.prefix, version, now.toISOString())
    )
    assert.deepEqual(keepByVersion(planTarget(logic, objects, now, 0)), {
        '0.9.0': 'delete',
        '1.0.0': 'history',
        '1.1.0': 'current'
    })
})

test('an upload inside a version directory counts towards its age', () => {
    const [logic] = pruneTargets(manifest, ['sample-game'])
    const objects = [
        ...versionObjects(logic.prefix, '0.9.0', old),
        { name: `${logic.prefix}/0.9.0/late.js`, size: 1, createdAt: recent },
        ...versionObjects(logic.prefix, '1.1.0', old)
    ]
    assert.equal(keepByVersion(planTarget(logic, objects, now, 7))['0.9.0'], 'recent')
})

test('ignores names that are not version directories or sit outside the prefix', () => {
    const [logic] = pruneTargets(manifest, ['sample-game'])
    const objects = [
        ...versionObjects(logic.prefix, '1.1.0', old),
        { name: `${logic.prefix}/notes.txt`, size: 1, createdAt: old },
        { name: `${logic.prefix}/scratch/index.js`, size: 1, createdAt: old },
        { name: `${logic.prefix}-old/0.1.0/index.js`, size: 1, createdAt: old }
    ]
    assert.deepEqual(
        planTarget(logic, objects, now, 7).versions.map((version) => version.version),
        ['1.1.0']
    )
})

test('refuses to plan when the current version is not in the listing', () => {
    const [, ui] = pruneTargets(manifest, ['sample-game'])
    assert.throws(
        () => planTarget(ui, versionObjects(ui.prefix, '1.0.0', old), now, 7),
        /current version 1\.4\.0 is not under games\/sample-game\/ui\//
    )
})

test('a manifest entry without history keeps its current versions', () => {
    const [logic, ui] = pruneTargets(manifest, ['other'])
    assert.deepEqual(logic.history, ['0.1.0'])
    assert.deepEqual(ui.history, ['0.1.0'])
})

test('the frontend target keeps its history versions', () => {
    const target = frontendPruneTarget(manifest)
    const objects = ['1.0.0', '2.0.0', '3.0.0'].flatMap((version) =>
        versionObjects('frontend', version, old)
    )
    assert.deepEqual(keepByVersion(planTarget(target, objects, now, 7)), {
        '1.0.0': 'delete',
        '2.0.0': 'history',
        '3.0.0': 'current'
    })
})

test('sorts versions numerically', () => {
    const [, ui] = pruneTargets(manifest, ['sample-game'])
    const objects = ['1.10.0', '1.4.0', '1.9.0'].flatMap((version) =>
        versionObjects(ui.prefix, version, old)
    )
    assert.deepEqual(
        planTarget(ui, objects, now, 7).versions.map((version) => version.version),
        ['1.4.0', '1.9.0', '1.10.0']
    )
})
