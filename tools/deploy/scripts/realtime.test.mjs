import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { readDeployConfig } from '../esm/lib/config.js'
import {
    buildRealtimeCommand,
    cloudSdkAccountEnv,
    parseRealtimeStats,
    realtimeCopyCommand,
    realtimeSshCommand,
    resolveRealtimeTarget
} from '../esm/lib/realtimePublish.js'

const target = {
    project: 'project-1',
    zone: 'us-central1-a',
    instance: 'realtime',
    healthUrl: 'https://events.example/health'
}

test('the realtime target comes from the realtime block and the backend project', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'realtime-config-'))
    const configPath = path.join(dir, 'deploy.config.json')
    await writeFile(
        configPath,
        JSON.stringify({
            backend: { project: 'project-1' },
            realtime: {
                instance: 'realtime',
                zone: 'us-central1-a',
                healthUrl: 'https://events.example/health'
            }
        })
    )
    assert.deepEqual(resolveRealtimeTarget(await readDeployConfig(configPath)), target)
    await rm(dir, { recursive: true })
})

test('a realtime deploy refuses to start without its target', () => {
    assert.throws(
        () => resolveRealtimeTarget({ backend: { project: 'project-1' }, realtime: { zone: 'z' } }),
        /realtime\.instance, realtime\.zone, realtime\.healthUrl, and backend\.project/
    )
})

test('the relay is reached over IAP as the named account', () => {
    const env = { CLOUDSDK_CORE_ACCOUNT: 'deploy@project-1.iam.gserviceaccount.com' }
    const ssh = realtimeSshCommand('/repo', target, 'install-realtime', 'sudo true', env)
    assert.deepEqual(ssh.args, [
        'compute',
        'ssh',
        'realtime',
        '--project',
        'project-1',
        '--zone',
        'us-central1-a',
        '--tunnel-through-iap',
        '--quiet',
        '--command=sudo true'
    ])
    assert.equal(ssh.env, env)
    const copy = realtimeCopyCommand('/repo', target, '/tmp/bundle', 'realtime-release-1.0.0', env)
    assert.deepEqual(copy.args.slice(0, 3), ['compute', 'scp', '--recurse'])
    assert.deepEqual(copy.args.slice(-2), ['/tmp/bundle', 'realtime:realtime-release-1.0.0'])
})

test('the relay binary is a static linux build with its version stamped in', () => {
    const build = buildRealtimeCommand('/repo', '1.2.3', '/tmp/bundle/realtime')
    assert.equal(build.command, 'go')
    assert.equal(build.cwd, path.join('/repo', 'apps', 'realtime'))
    assert.ok(build.args.includes('-ldflags=-s -X main.version=1.2.3'))
    assert.deepEqual(build.env, { CGO_ENABLED: '0', GOOS: 'linux', GOARCH: 'amd64' })
})

test('the serving relay version comes from its stats', () => {
    assert.deepEqual(parseRealtimeStats('{"version":"1.2.3","connections":4}\n'), {
        realtime: '1.2.3'
    })
    assert.deepEqual(parseRealtimeStats('{"connections":4}'), {
        error: 'the relay stats name no version'
    })
    assert.deepEqual(parseRealtimeStats('curl: (7) refused'), {
        error: 'the relay stats are not JSON'
    })
})

test('SSH names the account of the credential file override', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'realtime-key-'))
    const keyPath = path.join(dir, 'key.json')
    await writeFile(
        keyPath,
        JSON.stringify({ client_email: 'deploy@project-1.iam.gserviceaccount.com' })
    )
    const previous = process.env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE
    process.env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE = keyPath
    try {
        assert.deepEqual(await cloudSdkAccountEnv(), {
            CLOUDSDK_CORE_ACCOUNT: 'deploy@project-1.iam.gserviceaccount.com'
        })
    } finally {
        if (previous === undefined) delete process.env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE
        else process.env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE = previous
        await rm(dir, { recursive: true })
    }
})
