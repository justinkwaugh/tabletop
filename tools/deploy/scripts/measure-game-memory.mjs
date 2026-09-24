import assert from 'node:assert/strict'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
        versions: { type: 'string', default: '6' },
        'max-retained-mib': { type: 'string' }
    }
})
assert(global.gc, 'Run Node with --expose-gc')
assert.equal(positionals.length, 1, 'Pass the path to a self-contained game logic bundle')
const versions = Number(values.versions)
assert(Number.isInteger(versions) && versions >= 6, 'Measure at least six versions')
const maximum =
    values['max-retained-mib'] === undefined ? undefined : Number(values['max-retained-mib'])
assert(maximum === undefined || (Number.isFinite(maximum) && maximum > 0))
const bundle = path.resolve(positionals[0])
const directory = await mkdtemp(path.join(tmpdir(), 'tabletop-logic-memory-'))
const samples = []
const mib = 1024 * 1024

async function sample(versionsLoaded) {
    for (let i = 0; i < 3; i++) {
        await setImmediate()
        global.gc()
    }
    samples.push({ versionsLoaded, ...process.memoryUsage() })
}

try {
    await sample(0)
    for (let version = 1; version <= versions; version++) {
        const artifact = path.join(directory, `${version}.mjs`)
        await copyFile(bundle, artifact)
        await import(pathToFileURL(artifact).href)
        await sample(version)
    }
    const warm = samples[3]
    const final = samples.at(-1)
    const retainedMiBPerVersion = (final.heapUsed - warm.heapUsed) / (versions - 3) / mib
    console.log(JSON.stringify({ bundle, retainedMiBPerVersion, samples }, null, 2))
    if (maximum !== undefined) {
        assert(
            retainedMiBPerVersion <= maximum,
            `Retained ${retainedMiBPerVersion.toFixed(2)} MiB/version exceeds ${maximum} MiB`
        )
    }
} finally {
    await rm(directory, { recursive: true, force: true })
}
