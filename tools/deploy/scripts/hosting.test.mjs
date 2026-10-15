import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { mergeEnvConfig, readDeployConfig } from '../esm/lib/config.js'
import { publishFrontendVersion, resolveHostingTarget } from '../esm/lib/hostingPublish.js'

const temporaryDir = async (t, prefix) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
    t.after(() => fs.rm(dir, { recursive: true, force: true }))
    return dir
}

test('without a Hosting channel a frontend selection only publishes the manifest', async () => {
    let published = 0
    await publishFrontendVersion(
        { repoRoot: '/nonexistent', deployConfig: {}, log: () => {} },
        '2.0.0',
        async () => {
            published++
        }
    )
    assert.equal(published, 1)
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
