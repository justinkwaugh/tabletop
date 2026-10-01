import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchBackendManifest } from '../esm/lib/backend.js'
import { runReportedDeploy } from '../esm/lib/publishCore.js'

const artifact = { kind: 'frontend', version: '2.0.0', tag: 'frontend-v2.0.0', destination: '' }
const settle = { timeoutMs: 200, intervalMs: 10 }

const context = () => {
    const lines = []
    return { lines, context: { log: (line) => lines.push(line) } }
}

const sequence = (...versions) => {
    let call = 0
    return async () => ({ frontend: versions[Math.min(call++, versions.length - 1)] })
}

test('a deploy succeeds once the backend serves the deployed version', async () => {
    const { lines, context: reportContext } = context()
    await runReportedDeploy(
        reportContext,
        'frontend',
        [artifact],
        sequence('1.0.0', '1.0.0', '1.0.0', '2.0.0'),
        async () => {},
        { verifyServing: true, settle }
    )
    assert.ok(lines.includes('frontend waiting for the backend to serve frontend 2.0.0'))
    assert.ok(lines.includes('frontend deploy SUCCEEDED: frontend 2.0.0'))
    assert.ok(lines.includes('frontend serving now: frontend 2.0.0'))
})

test('a deploy fails when the backend never serves the deployed version', async () => {
    const { lines, context: reportContext } = context()
    await assert.rejects(
        runReportedDeploy(
            reportContext,
            'frontend',
            [artifact],
            sequence('1.0.0', '1.0.0'),
            async () => {},
            { verifyServing: true, settle }
        ),
        /still serves frontend 1\.0\.0/
    )
    assert.ok(!lines.some((line) => line.includes('SUCCEEDED')))
})

test('the served frontend version comes from the response header, not the manifest body', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                status: 'ok',
                payload: { frontend: { version: '2.0.0' }, games: [] }
            }),
            { headers: { 'content-type': 'application/json', 'x-tabletop-version': '1.0.0' } }
        )
    try {
        const result = await fetchBackendManifest('https://backend.example/api/v1/manifest')
        assert.equal(result.manifest?.frontend.version, '2.0.0')
        assert.equal(result.servedFrontendVersion, '1.0.0')
    } finally {
        globalThis.fetch = original
    }
})
