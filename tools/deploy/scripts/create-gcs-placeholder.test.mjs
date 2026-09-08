import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'

const source = await readFile(new URL('./create-gcs-placeholder.mjs', import.meta.url), 'utf8')

function createHarness() {
    const files = new Map()
    const uploads = []
    let activeConfiguration = 'first'
    let tokenRequests = 0

    async function run({ env = {}, statuses = [200] } = {}) {
        const finished = Promise.withResolvers()
        const context = createContext({
            URL,
            process: {
                argv: ['node', 'create-gcs-placeholder.mjs', 'gs://test-bucket/site/'],
                env
            },
            console: { log: finished.resolve, error: finished.reject },
            fetch: async (_url, options) => {
                uploads.push(options.headers.Authorization)
                const status = statuses.shift() ?? 200
                return {
                    status,
                    ok: status === 200,
                    statusText: 'Test response',
                    text: async () => ''
                }
            }
        })
        const childProcess = new SyntheticModule(
            ['spawn'],
            function () {
                this.setExport('spawn', (command, args) => {
                    assert.equal(command, 'gcloud')
                    assert.deepEqual(Array.from(args), ['auth', 'print-access-token'])
                    tokenRequests++
                    const child = new EventEmitter()
                    child.stdout = new EventEmitter()
                    child.stderr = new EventEmitter()
                    queueMicrotask(() => {
                        child.stdout.emit('data', `fake-token-${activeConfiguration}\n`)
                        child.emit('close', 0)
                    })
                    return child
                })
            },
            { context }
        )
        const fs = new SyntheticModule(
            ['default'],
            function () {
                this.setExport('default', {
                    readFile: async (path) => {
                        if (!files.has(path)) throw new Error('ENOENT')
                        return files.get(path)
                    },
                    writeFile: async (path, value) => {
                        files.set(path, value)
                    },
                    unlink: async (path) => {
                        files.delete(path)
                    }
                })
            },
            { context }
        )
        const script = new SourceTextModule(source, { context })
        await script.link((specifier) => {
            if (specifier === 'node:child_process') return childProcess
            if (specifier === 'node:fs/promises') return fs
            throw new Error(`Unexpected import: ${specifier}`)
        })
        await script.evaluate()
        await finished.promise
    }

    return {
        run,
        uploads,
        activate(name) {
            activeConfiguration = name
        },
        tokenRequests: () => tokenRequests
    }
}

test('placeholder uploads follow a gcloud configuration switch immediately', async () => {
    const harness = createHarness()
    await harness.run()
    harness.activate('second')
    await harness.run()
    assert.deepEqual(harness.uploads, ['Bearer fake-token-first', 'Bearer fake-token-second'])
})

test('an explicitly supplied access token takes precedence over gcloud', async () => {
    const harness = createHarness()
    await harness.run({ env: { TABLETOP_GCS_ACCESS_TOKEN: 'fake-explicit-token' } })
    assert.deepEqual(harness.uploads, ['Bearer fake-explicit-token'])
    assert.equal(harness.tokenRequests(), 0)
})

test('an unauthorized upload retries with a token obtained from gcloud', async () => {
    const harness = createHarness()
    await harness.run({ statuses: [401, 200] })
    assert.equal(harness.tokenRequests(), 2)
    assert.equal(harness.uploads.length, 2)
})
