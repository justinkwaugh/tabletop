import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { mergeEnvConfig, readDeployConfig } from '../esm/lib/config.js'
import { frontendSelection, resolveHostingTarget } from '../esm/lib/hostingPublish.js'
import { runReportedDeploy } from '../esm/lib/publishCore.js'

const artifact = { kind: 'frontend', version: '2.0.0', tag: 'frontend-v2.0.0', destination: '' }
const settle = { timeoutMs: 200, intervalMs: 10 }

const recorder = () => {
    const lines = []
    return { lines, context: { log: (line) => lines.push(line) } }
}

const sequence = (...versions) => {
    let call = 0
    return async () => ({ frontend: versions[Math.min(call++, versions.length - 1)] })
}

test('the after-serving step runs once the backend serves the version, before success', async () => {
    const { lines, context } = recorder()
    await runReportedDeploy(
        context,
        'frontend',
        [artifact],
        sequence('1.0.0', '1.0.0', '2.0.0'),
        async () => 'staged',
        {
            verifyServing: true,
            settle,
            afterServing: async (deployed) => {
                lines.push(`after serving ${deployed}`)
            }
        }
    )
    const waited = lines.indexOf('frontend waiting for the backend to serve frontend 2.0.0')
    const after = lines.indexOf('after serving staged')
    const succeeded = lines.indexOf('frontend deploy SUCCEEDED: frontend 2.0.0')
    assert.ok(waited >= 0 && waited < after && after < succeeded)
})

test('a failed after-serving step fails the deploy and reports what the backend serves', async () => {
    const { lines, context } = recorder()
    await assert.rejects(
        runReportedDeploy(
            context,
            'frontend',
            [artifact],
            sequence('1.0.0', '2.0.0'),
            async () => 'staged',
            {
                verifyServing: true,
                settle,
                afterServing: async () => {
                    throw new Error('hosting did not switch')
                }
            }
        ),
        /hosting did not switch/
    )
    assert.ok(
        lines.includes('frontend deploy FAILED after the backend switched: hosting did not switch')
    )
    assert.ok(lines.includes('frontend serving now: frontend 2.0.0'))
    assert.ok(!lines.some((line) => line.includes('SUCCEEDED')))
})

test('without a Hosting channel the selection only publishes the manifest', async () => {
    let published = 0
    const selection = await frontendSelection(
        { repoRoot: '/nonexistent', deployConfig: {}, log: () => {} },
        '2.0.0',
        async () => {
            published++
        }
    )
    assert.equal(await selection.deploy(), null)
    await selection.afterServing(null)
    assert.equal(published, 1)
})

test('the Hosting target names the site from the frontend firebase.json', async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hosting-target-'))
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

test('the Hosting channel comes from the deploy config or TABLETOP_HOSTING_CHANNEL', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hosting-config-'))
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
