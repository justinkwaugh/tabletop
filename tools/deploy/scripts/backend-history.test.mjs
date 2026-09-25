import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
    listBackendHistory,
    previousBackendRevision,
    switchBackend
} from '../esm/lib/backendHistory.js'
import { assertGameUiPairing } from '../esm/lib/publicationHistory.js'
import { deployBackendCommand } from '../esm/lib/commands.js'

const revision = (name, created, ready = true) => ({ name, created, ready })
test('rollback selects an earlier ready revision relative to traffic, not a newer staged revision', () => {
    const history = {
        service: 'backend',
        traffic: [{ revision: 'backend-v1-6-0', percent: 100 }],
        revisions: [
            revision('backend-v1-7-0', '2026-09-26'),
            revision('backend-v1-6-0', '2026-09-25'),
            revision('backend-broken', '2026-09-24', false),
            revision('backend-v1-5-1', '2026-09-23')
        ]
    }
    assert.equal(previousBackendRevision(history).name, 'backend-v1-5-1')
    assert.throws(
        () =>
            previousBackendRevision({
                ...history,
                traffic: [{ revision: 'backend-v1-6-0', percent: 50 }]
            }),
        /split/
    )
    assert.throws(
        () => previousBackendRevision({ ...history, revisions: [history.revisions[1]] }),
        /no earlier/
    )
})

test('any UI embedding the selected logic is valid; the next logic boundary is excluded', () => {
    for (const uiVersion of ['2.0.0', '2.0.1', '2.1.0']) {
        assertGameUiPairing(
            'sample',
            { logicVersion: '1.5.0', uiVersion },
            { id: 'sample', metadata: { version: '1.5.0' } }
        )
    }
    assert.throws(
        () =>
            assertGameUiPairing(
                'sample',
                { logicVersion: '1.5.0', uiVersion: '2.2.0' },
                { id: 'sample', metadata: { version: '1.6.0' } }
            ),
        /embeds logic 1.6.0/
    )
    assert.throws(
        () =>
            assertGameUiPairing(
                'sample',
                { logicVersion: '1.5.0', uiVersion: '2.1.0' },
                { id: 'different', metadata: { version: '1.5.0' } }
            ),
        /Cannot verify/
    )
})

test('all backend deployments configure HTTP child health probes and disable affinity', () => {
    const config = {
        backend: { service: 'backend', project: 'test', region: 'region', image: 'image' }
    }
    for (const service of ['backend', 'tasks']) {
        const command = deployBackendCommand('/tmp', config, { service, allowTraffic: false })
        for (const flag of ['--startup-probe', '--readiness-probe', '--liveness-probe']) {
            const settings = command.args[command.args.indexOf(flag) + 1]
            assert.match(settings, /httpGet.path=\/__health\/ready/)
            assert.match(settings, /httpGet.port=8081/)
        }
        assert.ok(command.args.includes('--no-session-affinity'))
        assert.ok(command.args.includes('--no-traffic'))
    }
})

test('backend list is read-only; rollback plans both services, honors tasks-only, verifies traffic', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'backend-history-'))
    const bin = path.join(directory, 'bin')
    await mkdir(bin)
    const statePath = path.join(directory, 'state.json')
    const state = {
        traffic: { backend: 'backend-v1-6-0', tasks: 'tasks-v1-6-0' },
        changes: [],
        missing: false
    }
    await writeFile(statePath, JSON.stringify(state))
    await writeFile(
        path.join(bin, 'gcloud'),
        `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
const file = ${JSON.stringify(statePath)}
const state = JSON.parse(readFileSync(file))
const args = process.argv.slice(2)
if (args[1] === 'services' && args[2] === 'describe') {
 console.log(JSON.stringify({ status: { traffic: [{ revisionName: state.traffic[args[3]], percent: 100 }, { revisionName: args[3] + '-v1-7-0', tag: 'latest' }] } }))
} else if (args[1] === 'revisions') {
 const service = args[args.indexOf('--service') + 1]
 console.log(JSON.stringify(['1-7-0','1-6-0','1-5-1','1-5-0'].filter(v => !(state.missing && service === 'backend' && v === '1-5-1')).map((v,i) => ({ metadata: { name: service+'-v'+v, creationTimestamp: '2026-09-'+(26-i) }, status: { conditions: [{ type: 'Ready', status: 'True' }] } }))))
} else if (args[2] === 'update-traffic') {
 const service = args[3]
 const revision = args[args.indexOf('--to-revisions')+1].split('=')[0]
 if (!revision.startsWith(service+'-')) process.exit(2)
 state.traffic[service] = revision
 state.changes.push(service)
 writeFileSync(file, JSON.stringify(state))
} else process.exit(3)
`,
        { mode: 0o755 }
    )
    const oldPath = process.env.PATH
    process.env.PATH = `${bin}:${oldPath}`
    const messages = []
    const context = {
        repoRoot: directory,
        catalogue: [],
        log: (message) => messages.push(message),
        deployConfig: {
            backendManifestUrl: 'http://unused',
            backend: {
                service: 'backend',
                tasksService: 'tasks',
                project: 'test',
                region: 'region',
                image: 'image'
            }
        }
    }
    const readState = async () => JSON.parse(await readFile(statePath, 'utf8'))
    try {
        await listBackendHistory(context, ['backend', 'tasks'])
        assert.deepEqual((await readState()).changes, [])
        assert.ok(messages.some((message) => message.startsWith('* backend-v1-6-0')))
        await switchBackend(context, ['backend', 'tasks'])
        assert.deepEqual((await readState()).traffic, {
            tasks: 'tasks-v1-5-1',
            backend: 'backend-v1-5-1'
        })
        await switchBackend(context, ['tasks'], { revision: 'tasks-v1-6-0' })
        assert.equal((await readState()).traffic.backend, 'backend-v1-5-1')
        assert.equal((await readState()).traffic.tasks, 'tasks-v1-6-0')
        await assert.rejects(
            switchBackend(context, ['tasks', 'backend']),
            /different release histories/
        )
        assert.equal((await readState()).traffic.tasks, 'tasks-v1-6-0')
        await writeFile(statePath, JSON.stringify({ ...state, missing: true }))
        await assert.rejects(
            switchBackend(context, ['tasks', 'backend'], { version: '1.5.1' }),
            /missing or not ready/
        )
        assert.deepEqual((await readState()).changes, [])
    } finally {
        process.env.PATH = oldPath
        await rm(directory, { recursive: true, force: true })
    }
})
