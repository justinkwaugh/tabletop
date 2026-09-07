import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        fixture: { type: 'string' },
        variant: { type: 'string' },
        hosted: { type: 'boolean', default: false },
        'no-build': { type: 'boolean', default: false },
        output: { type: 'string' },
        site: { type: 'string', default: 'http://localhost:5173' },
        backend: { type: 'string', default: 'http://localhost:3000' },
        'firestore-host': { type: 'string', default: 'localhost:8080' },
        'redis-host': { type: 'string', default: 'localhost:6379' },
        project: { type: 'string', default: 'demo-tabletop' },
        'pace-ms': { type: 'string', default: '0' },
        help: { type: 'boolean', short: 'h' }
    }
})

if (values.help || positionals.length !== 1) {
    console.log(`Usage: pnpm rehearse <game-package> [--fixture path/to/fixture.mjs] [--variant name]

Rebuilds the Game and runs all fixtures in games/<game>/rehearsals.
Exit status is nonzero for incomplete exports, rule errors or unexpected differences.

--hosted           Also replay in real Chromium player sessions against a running local hosted site.
                   First start tools/scripts/local-hosted-game.mjs with Redis/SSE enabled.
                   Hosted mode verifies package/manifest versions and uses already-built artifacts.
--no-build         Use already-built logic for an engine-only run.
--output <path>    Report directory (default: .local-rehearsals/<timestamp>/<game>).
--site <url>       Local Site Frontend (default: http://localhost:5173).
--backend <url>    Local backend (default: http://localhost:3000).
--firestore-host   Emulator host:port (default: localhost:8080; devcontainer: firebase:8080).
--redis-host       Local Redis host:port (default: localhost:6379; devcontainer: cache:6379).
--project <id>     Firestore emulator project, must start demo- (default: demo-tabletop).
--pace-ms <ms>     Optional delay between hosted inputs (default: 0).
`)
    process.exit(values.help ? 0 : 1)
}

const packageId = positionals[0]
assert.match(packageId, /^[a-z0-9-]+$/)
const output = path.resolve(
    root,
    values.output ??
        `.local-rehearsals/${new Date().toISOString().replaceAll(':', '-')}/${packageId}`
)
await mkdir(output, { recursive: true })
const options = {
    output,
    site: values.site,
    backend: values.backend,
    firestoreHost: values['firestore-host'],
    redisHost: values['redis-host'],
    project: values.project,
    paceMs: Number(values['pace-ms'])
}
assert(Number.isFinite(options.paceMs) && options.paceMs >= 0, 'pace-ms must be nonnegative')

if (!values.hosted && !values['no-build']) {
    const build = spawnSync(
        'pnpm',
        ['exec', 'turbo', 'run', 'build', `--filter=@tabletop/${packageId}`],
        { cwd: root, stdio: 'inherit' }
    )
    assert.equal(build.status, 0, 'Game build failed')
}

const { loadRehearsal, runReplay, jsonCopy } = await import('./replay.js')
const { version: logicVersion } = JSON.parse(
    await readFile(path.join(root, 'games', packageId, 'package.json'), 'utf8')
)
if (values.hosted) {
    const { validateLocalOptions } = await import('./localStore.mjs')
    validateLocalOptions(options)
    const response = await fetch(`${options.backend}/api/v1/manifest`)
    assert(response.ok, 'Local backend manifest is unavailable')
    const manifest = await response.json()
    const publication = manifest.payload.games.find((game) => game.packageId === packageId)
    const ui = JSON.parse(
        await readFile(path.join(root, 'games', `${packageId}-ui`, 'package.json'), 'utf8')
    )
    assert.equal(
        publication?.logicVersion,
        logicVersion,
        'Run the hosted runner with current Logic selected'
    )
    assert.equal(
        publication?.uiVersion,
        ui.version,
        'Run the hosted runner with current UI selected'
    )
}
const fixturesDirectory = path.join(root, 'games', packageId, 'rehearsals')
const fixturePaths = values.fixture
    ? [path.resolve(root, values.fixture)]
    : (await readdir(fixturesDirectory, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.join(fixturesDirectory, entry.name, 'fixture.mjs'))
assert(fixturePaths.length, `No rehearsal fixtures for ${packageId}`)
const report = {
    packageId,
    logicVersion,
    mode: values.hosted ? 'hosted' : 'engine',
    passed: true,
    fixtures: []
}
for (const fixturePath of fixturePaths) {
    const entry = { fixture: path.relative(root, fixturePath), results: [] }
    report.fixtures.push(entry)
    try {
        const rehearsal = await loadRehearsal(pathToFileURL(fixturePath))
        assert.equal(rehearsal.fixture.packageId, packageId)
        const variants = values.variant
            ? [values.variant === 'recorded' ? undefined : values.variant]
            : [undefined, ...Object.keys(rehearsal.fixture.variants ?? {})]
        for (const variant of variants) {
            const replay = runReplay(rehearsal, variant)
            const result = { engine: replay.report }
            entry.results.push(result)
            const runOutput = path.join(output, path.basename(path.dirname(fixturePath)))
            await mkdir(runOutput, { recursive: true })
            await writeFile(
                path.join(runOutput, `${replay.report.variant}-engine-final.json`),
                JSON.stringify(jsonCopy(replay.finalState), null, 2)
            )
            if (values.hosted && replay.report.passed) {
                const { runHosted } = await import('./hosted.mjs')
                result.hosted = await runHosted(rehearsal, replay, {
                    ...options,
                    output: runOutput
                })
            }
            const passed = replay.report.passed && (!result.hosted || result.hosted.passed)
            report.passed &&= passed
            console.log(
                `${passed ? 'PASS' : 'FAIL'} ${rehearsal.fixture.name} [${replay.report.variant}]: ${replay.report.inputs} inputs, ${replay.report.processedActions} actions`
            )
            for (const failure of replay.report.failures)
                console.error(
                    `${failure.stage} at ${failure.index ?? 'final'} (${failure.type ?? 'state'}): ${failure.message.slice(0, 500)}`
                )
            if (result.hosted?.failure)
                console.error(JSON.stringify(result.hosted.failure).slice(0, 1000))
        }
    } catch (error) {
        entry.failure = error.message
        report.passed = false
        console.error(`FAIL ${entry.fixture}: ${error.message}`)
    }
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
}
console.log(`Report: ${path.join(output, 'report.json')}`)
process.exitCode = report.passed ? 0 : 1
