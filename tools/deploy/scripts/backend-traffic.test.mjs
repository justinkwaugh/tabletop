import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { routeTrafficAndVerify } from '../esm/lib/backendTraffic.js'
import { promoteBackend } from '../esm/lib/backendPublish.js'

// A fake gcloud whose service traffic is pinned to v1-7-0 while v1-7-2 is the newest revision,
// matching a service left pinned by an earlier rollback. With `stuck`, traffic updates succeed
// without moving traffic.
async function withFakeGcloud(stuck, run) {
    const directory = await mkdtemp(path.join(tmpdir(), 'backend-traffic-'))
    const bin = path.join(directory, 'bin')
    await mkdir(bin)
    const statePath = path.join(directory, 'state.json')
    await writeFile(
        statePath,
        JSON.stringify({ traffic: { backend: 'backend-v1-7-0', tasks: 'tasks-v1-7-0' }, stuck })
    )
    await writeFile(
        path.join(bin, 'gcloud'),
        `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
const file = ${JSON.stringify(statePath)}
const state = JSON.parse(readFileSync(file))
const args = process.argv.slice(2)
const versions = ['1-7-2', '1-7-1', '1-7-0']
if (args[1] === 'services' && args[2] === 'describe') {
 console.log(JSON.stringify({ status: { traffic: [{ revisionName: state.traffic[args[3]], percent: 100 }, { revisionName: args[3] + '-v1-7-2', tag: 'latest' }] } }))
} else if (args[1] === 'revisions') {
 const service = args[args.indexOf('--service') + 1]
 console.log(JSON.stringify(versions.map((v, i) => ({ metadata: { name: service + '-v' + v, creationTimestamp: '2026-09-' + (26 - i) }, status: { conditions: [{ type: 'Ready', status: v === '1-7-1' ? 'False' : 'True' }] } }))))
} else if (args[2] === 'update-traffic') {
 const service = args[3]
 const revision = args.includes('--to-latest') ? service + '-v' + versions[0] : args[args.indexOf('--to-revisions') + 1].split('=')[0]
 if (!state.stuck) state.traffic[service] = revision
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
            backendManifestUrl: 'http://127.0.0.1:9/unused',
            backend: {
                service: 'backend',
                tasksService: 'tasks',
                project: 'test',
                region: 'region',
                image: 'image'
            }
        }
    }
    try {
        await run(context, async () => JSON.parse(await readFile(statePath, 'utf8')).traffic)
    } finally {
        process.env.PATH = oldPath
        await rm(directory, { recursive: true, force: true })
    }
}

test('routing moves a pinned service to the requested revision and confirms it', async () => {
    await withFakeGcloud(false, async (context, traffic) => {
        await routeTrafficAndVerify(context, 'backend', 'backend-v1-7-2')
        assert.equal((await traffic()).backend, 'backend-v1-7-2')
    })
})

test('routing fails when the service keeps serving another revision', async () => {
    await withFakeGcloud(true, async (context) => {
        await assert.rejects(
            routeTrafficAndVerify(context, 'backend', 'backend-v1-7-2'),
            /expected backend-v1-7-2 at 100% traffic, found backend-v1-7-0 \(100%\)/
        )
    })
})

test('promotion confirms both services serve their newest ready revision', async () => {
    await withFakeGcloud(false, async (context, traffic) => {
        await promoteBackend(context, ['backend', 'tasks'])
        assert.deepEqual(await traffic(), { backend: 'backend-v1-7-2', tasks: 'tasks-v1-7-2' })
    })
    await withFakeGcloud(true, async (context) => {
        await assert.rejects(
            promoteBackend(context, ['backend', 'tasks']),
            /tasks: expected tasks-v1-7-2 at 100% traffic/
        )
    })
})
