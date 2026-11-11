import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { mergeEnvConfig, readDeployConfig } from '../esm/lib/config.js'
import {
    requireFrontendRelease,
    resolveHostingTarget,
    runFrontendSwitch
} from '../esm/lib/hostingPublish.js'
import { isVersionAtLeast } from '../esm/lib/versions.js'

const temporaryDir = async (t, prefix) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
    t.after(() => fs.rm(dir, { recursive: true, force: true }))
    return dir
}

const switching = { channel: 'live', from: '1.0.0', to: '2.0.0' }

const recordedSwitch = (failing) => {
    const lines = []
    const step = (name) => async () => {
        lines.push(name)
        if (name === failing) throw new Error(`${name} failed`)
    }
    return {
        lines,
        context: { log: (line) => lines.push(line) },
        steps: {
            copyToChannel: step('copy'),
            writeManifest: step('write'),
            invalidateBackend: step('invalidate')
        }
    }
}

test('a frontend switch copies to Hosting before it publishes the manifest', async () => {
    const { lines, context, steps } = recordedSwitch()
    await runFrontendSwitch(context, switching, steps)
    assert.deepEqual(lines, ['copy', 'write', 'invalidate'])
})

test('each failed switch step names what production serves and how to recover', async () => {
    const recoveries = {
        copy: 'hosting: live may serve frontend 2.0.0 while the manifest names 1.0.0; rerun, or run sync-hosting to put Hosting back on frontend 1.0.0',
        write: 'hosting: live serves frontend 2.0.0 but the manifest still names 1.0.0; rerun, or run sync-hosting to put Hosting back on frontend 1.0.0',
        invalidate:
            'the manifest names frontend 2.0.0 but the backend may still report 1.0.0; run sync-hosting to finish'
    }
    for (const [failing, recovery] of Object.entries(recoveries)) {
        const { lines, context, steps } = recordedSwitch(failing)
        await assert.rejects(runFrontendSwitch(context, switching, steps), /failed/)
        assert.equal(lines.at(-1), recovery)
        assert.equal(lines.at(-2), failing)
    }
})

test('a frontend release needs a Hosting channel', async () => {
    await assert.rejects(
        requireFrontendRelease({ repoRoot: '/nonexistent', deployConfig: {}, log: () => {} }),
        /needs hosting\.channel/
    )
})

test('version minimums compare major, then minor, then patch', () => {
    assert.ok(isVersionAtLeast('1.23.0', '1.23.0'))
    assert.ok(isVersionAtLeast('1.23.1', '1.23.0'))
    assert.ok(isVersionAtLeast('2.0.0', '1.23.0'))
    assert.ok(!isVersionAtLeast('1.22.9', '1.23.0'))
    assert.ok(!isVersionAtLeast('0.99.0', '1.23.0'))
})

test('the Hosting target names the site from the frontend firebase.json', async (t) => {
    const repoRoot = await temporaryDir(t, 'hosting-target-')
    await fs.mkdir(path.join(repoRoot, 'apps', 'frontend'), { recursive: true })
    await fs.writeFile(
        path.join(repoRoot, 'apps', 'frontend', 'firebase.json'),
        JSON.stringify({ hosting: { site: 'example-site', public: 'build' } })
    )
    const target = await resolveHostingTarget({
        repoRoot,
        deployConfig: { hosting: { channel: 'live' }, backend: { project: 'example-project' } },
        log: () => {}
    })
    assert.equal(target?.site, 'example-site')
    assert.equal(target?.project, 'example-project')
    assert.equal(target?.channel, 'live')
})

test('the Hosting channel comes from the deploy config or TABLETOP_HOSTING_CHANNEL', async (t) => {
    const dir = await temporaryDir(t, 'hosting-config-')
    const configPath = path.join(dir, 'deploy.config.json')
    await fs.writeFile(configPath, JSON.stringify({ hosting: { channel: 'live' } }))
    const config = await readDeployConfig(configPath)
    assert.equal(config.hosting?.channel, 'live')

    const previous = process.env.TABLETOP_HOSTING_CHANNEL
    process.env.TABLETOP_HOSTING_CHANNEL = 'rehearsal'
    try {
        assert.equal(mergeEnvConfig(config).hosting?.channel, 'rehearsal')
    } finally {
        if (previous === undefined) delete process.env.TABLETOP_HOSTING_CHANNEL
        else process.env.TABLETOP_HOSTING_CHANNEL = previous
    }
    assert.equal(mergeEnvConfig({}).hosting?.channel, undefined)
})
