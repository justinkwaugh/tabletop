import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveObjectURL } from 'node:buffer'
import { moduleWorkers } from './workers.js'

const BUNDLE_URL = 'https://bucket.example.com/games/a/ui/1.0.0/index-abc.js'
const WORKER_URL = 'https://bucket.example.com/games/a/ui/1.0.0/route.worker-def.js'
const WORKER_CHUNK_REFERENCE = 'ref1'
const WORKER_OPTIONS = ", { type: 'module' })"

async function bundleWorkerCallSite() {
    const emitted = []
    const context = {
        resolve: async (source) => ({ id: `/src/${source}` }),
        emitFile: (file) => {
            emitted.push(file)
            return WORKER_CHUNK_REFERENCE
        },
        error: (message) => {
            throw new Error(message)
        }
    }
    const source = `const worker = new Worker(new URL('./route.worker.js', import.meta.url)${WORKER_OPTIONS}`
    const { code } = await moduleWorkers().transform.call(context, source, '/src/Table.svelte')
    const workerUrlExpression = code.slice(
        code.indexOf('new Worker(') + 'new Worker('.length,
        code.lastIndexOf(WORKER_OPTIONS)
    )
    return { emitted, code, workerUrlExpression }
}

function workerUrlOnPage(workerUrlExpression, pageOrigin) {
    const rendered = workerUrlExpression
        .replaceAll(
            `import.meta.ROLLUP_FILE_URL_${WORKER_CHUNK_REFERENCE}`,
            JSON.stringify(WORKER_URL)
        )
        .replaceAll('import.meta.url', JSON.stringify(BUNDLE_URL))
    return new Function('self', `return ${rendered}`)({ location: { origin: pageOrigin } })
}

test('a worker script is emitted as its own chunk and still constructed as a module worker', async () => {
    const { emitted, code } = await bundleWorkerCallSite()

    assert.deepEqual(emitted, [{ type: 'chunk', id: '/src/./route.worker.js' }])
    assert.ok(code.startsWith('const worker = new Worker('))
    assert.ok(code.endsWith(WORKER_OPTIONS))
    assert.doesNotMatch(code, /route\.worker\.js/)
})

test('a bundle served from the page origin starts its worker from the script URL', async () => {
    const { workerUrlExpression } = await bundleWorkerCallSite()

    const workerUrl = workerUrlOnPage(workerUrlExpression, 'https://bucket.example.com')

    assert.ok(workerUrl instanceof URL)
    assert.equal(workerUrl.href, WORKER_URL)
})

test('a bundle served from another origin starts its worker from a blob that imports the script and then releases itself', async () => {
    const { workerUrlExpression } = await bundleWorkerCallSite()

    const workerUrl = workerUrlOnPage(workerUrlExpression, 'https://site.example.com')

    assert.equal(typeof workerUrl, 'string')
    assert.match(workerUrl, /^blob:/)
    const blob = resolveObjectURL(workerUrl)
    assert.equal(blob.type, 'text/javascript')
    assert.equal(
        await blob.text(),
        `import ${JSON.stringify(WORKER_URL)};URL.revokeObjectURL(self.location.href)`
    )
    URL.revokeObjectURL(workerUrl)
})
