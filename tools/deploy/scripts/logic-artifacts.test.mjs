import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { migrateLogicArtifacts, planLogicArtifactMigration } from '../esm/lib/logicArtifacts.js'

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

const OATH_LOGIC_ESM = `export const Definition = {
    info: { id: 'oath', metadata: { version: '2.0.0' } },
    runtime: { apiActions: {} }
}
`

const manifest = {
    frontend: { version: '1.0.0' },
    games: [
        { gameId: 'oath', packageId: 'oath', logicVersion: '2.0.0', uiVersion: '2.1.0' },
        { gameId: 'sol', packageId: 'sol', logicVersion: '3.0.0', uiVersion: '3.0.0' }
    ]
}

// A fake gcloud whose bucket is a local directory: `storage cat`, `ls` and `cp` read and write
// there and every invocation is recorded. Nothing answers on the network.
async function withFakeBucket(deployConfig, run) {
    const directory = await mkdtemp(path.join(tmpdir(), 'logic-artifacts-'))
    const bucket = path.join(directory, 'bucket')
    const bin = path.join(directory, 'bin')
    const callsPath = path.join(directory, 'calls.jsonl')
    await mkdir(bin)
    await mkdir(path.join(bucket, 'config'), { recursive: true })
    await writeFile(path.join(bucket, 'config', 'site-manifest.json'), JSON.stringify(manifest))
    await mkdir(path.join(bucket, 'games', 'oath', 'logic', '2.0.0'), { recursive: true })
    await writeFile(
        path.join(bucket, 'games', 'oath', 'logic', '2.0.0', 'index.js'),
        OATH_LOGIC_ESM
    )
    await mkdir(path.join(bucket, 'games', 'sol', 'logic', '3.0.0'), { recursive: true })
    await writeFile(path.join(bucket, 'games', 'sol', 'logic', '3.0.0', 'index.cjs'), '')
    await writeFile(
        path.join(bin, 'gcloud'),
        `#!/usr/bin/env node
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
const args = process.argv.slice(2)
appendFileSync(${JSON.stringify(callsPath)}, JSON.stringify(args) + '\\n')
const local = (url) =>
    url.startsWith('gs://bucket/') ? path.join(${JSON.stringify(bucket)}, url.slice('gs://bucket/'.length)) : url
if (args[0] !== 'storage') process.exit(3)
if (args[1] === 'cat') {
    process.stdout.write(readFileSync(local(args[2])))
} else if (args[1] === 'ls') {
    if (!existsSync(local(args[2]))) process.exit(1)
    console.log(args[2])
} else if (args[1] === 'cp') {
    const destination = local(args[3])
    mkdirSync(path.dirname(destination), { recursive: true })
    copyFileSync(local(args[2]), destination)
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
        deployConfig,
        log: (message) => messages.push(message)
    }
    const calls = async () =>
        existsSync(callsPath)
            ? (await readFile(callsPath, 'utf8'))
                  .trim()
                  .split('\n')
                  .map((line) => JSON.parse(line).join(' '))
            : []
    try {
        await run({
            context,
            messages,
            calls,
            uploaded: (file) =>
                existsSync(path.join(bucket, 'games', 'oath', 'logic', '2.0.0', file))
        })
    } finally {
        process.env.PATH = oldPath
        await rm(directory, { recursive: true, force: true })
    }
}

test('planning the migration needs the bucket alone, not backend credentials', async () => {
    await withFakeBucket(
        { gcsBucket: 'bucket' },
        async ({ context, messages, calls, uploaded }) => {
            const plans = await migrateLogicArtifacts(context, { apply: false })
            assert.deepEqual(
                plans.map((plan) => `${plan.url}: ${plan.missing.join(', ')}`),
                ['gs://bucket/games/oath/logic/2.0.0: index.cjs']
            )
            assert.ok(messages.some((message) => message.startsWith('plan only')))
            assert.deepEqual(await calls(), [
                'storage cat gs://bucket/config/site-manifest.json',
                'storage ls gs://bucket/games/oath/logic/2.0.0/index.cjs',
                'storage ls gs://bucket/games/sol/logic/3.0.0/index.cjs'
            ])
            assert.equal(uploaded('index.cjs'), false)
        }
    )
})

test('applying the migration uploads the factory without signing in, even beside a leftover token', async () => {
    const legacyTokenOnly = {
        gcsBucket: 'bucket',
        backendAdmin: {
            url: 'http://127.0.0.1:9/api/v1/admin/manifest/invalidate',
            unsupportedSettings: ['backendAdmin.token']
        }
    }
    await withFakeBucket(legacyTokenOnly, async ({ context, calls, uploaded }) => {
        const plans = await migrateLogicArtifacts(context, { apply: true, game: 'oath' })
        assert.equal(plans.length, 1)
        assert.equal(uploaded('index.cjs'), true)
        const recorded = await calls()
        assert.ok(
            recorded.some((call) =>
                call.startsWith('storage cp gs://bucket/games/oath/logic/2.0.0/index.js ')
            )
        )
        assert.ok(
            recorded.some((call) => call.endsWith(' gs://bucket/games/oath/logic/2.0.0/index.cjs'))
        )
        assert.ok(recorded.every((call) => call.startsWith('storage ')))
    })
})
