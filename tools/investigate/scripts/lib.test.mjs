import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    buildLogFilter,
    formatLogEntry,
    parseCount,
    parseTime,
    parseWhere,
    permissionHint,
    redact,
    summarizeTask
} from '../src/lib.mjs'

test('redact masks secret keys, reduces endpoints to hosts, expands stored data, converts timestamps', () => {
    const stored = {
        id: 'webpush:abc',
        data: JSON.stringify({
            endpoint: 'https://fcm.googleapis.com/fcm/send/secret-path',
            keys: { p256dh: 'k', auth: 'a' }
        }),
        createdAt: { toDate: () => new Date('2026-09-24T00:00:00Z') },
        passwordHash: 'hash',
        owner: { path: 'users/u1', id: 'u1', firestore: {} }
    }
    assert.deepEqual(redact(stored), {
        id: 'webpush:abc',
        data: { endpoint: 'host:fcm.googleapis.com', keys: '<REDACTED>' },
        createdAt: '2026-09-24T00:00:00.000Z',
        passwordHash: '<REDACTED>',
        owner: 'ref:users/u1'
    })
})

test('parseTime handles durations and ISO timestamps', () => {
    const now = new Date('2026-09-24T12:00:00Z')
    assert.equal(parseTime('2h', now).toISOString(), '2026-09-24T10:00:00.000Z')
    assert.equal(parseTime('3d', now).toISOString(), '2026-09-21T12:00:00.000Z')
    assert.equal(parseTime('2026-09-01T00:00:00Z', now).toISOString(), '2026-09-01T00:00:00.000Z')
    assert.throws(() => parseTime('yesterday', now))
})

test('parseCount accepts positive integers and rejects the rest', () => {
    assert.equal(parseCount(undefined, 20), 20)
    assert.equal(parseCount('5', 20), 5)
    assert.throws(() => parseCount('abc', 20))
    assert.throws(() => parseCount('0', 20))
})

test('buildLogFilter scopes to cloud run services and time and escapes the grep text', () => {
    const filter = buildLogFilter({
        services: ['backend', 'tasks'],
        since: new Date('2026-09-24T10:00:00Z'),
        severity: 'error',
        grep: 'web "push" C:\\x',
        requestId: 'req-1'
    })
    assert.equal(
        filter,
        'resource.type="cloud_run_revision" AND (resource.labels.service_name="backend" OR resource.labels.service_name="tasks") AND timestamp>="2026-09-24T10:00:00.000Z" AND severity>=ERROR AND "web \\"push\\" C:\\\\x" AND (jsonPayload.reqId="req-1" OR jsonPayload.req.id="req-1")'
    )
})

test('buildLogFilter can drop the cloud run restriction for a raw filter', () => {
    const filter = buildLogFilter({
        services: ['backend'],
        since: new Date('2026-09-24T10:00:00Z'),
        raw: 'resource.type="cloud_tasks_queue"',
        anyResource: true
    })
    assert.equal(
        filter,
        'timestamp>="2026-09-24T10:00:00.000Z" AND (resource.type="cloud_tasks_queue")'
    )
})

test('formatLogEntry prefers text, then pino msg, then proto, and appends http status', () => {
    const line = formatLogEntry({
        timestamp: '2026-09-24T10:00:00Z',
        severity: 'ERROR',
        resource: { labels: { service_name: 'backend', revision_name: 'backend-00042-abc' } },
        jsonPayload: { msg: 'request errored', reqId: 'req-1', err: { message: 'boom' } },
        httpRequest: { requestMethod: 'POST', requestUrl: '/api/x', status: 500 }
    })
    assert.equal(
        line,
        '2026-09-24T10:00:00Z ERROR   backend@00042-abc request errored POST /api/x -> 500 req=req-1 err=boom'
    )
    const proto = formatLogEntry({
        timestamp: 't',
        resource: { labels: {} },
        protoPayload: {
            methodName: 'google.cloud.run.v1.Services.ReplaceService',
            status: { message: 'ok' }
        }
    })
    assert.equal(proto, 't DEFAULT ?@ google.cloud.run.v1.Services.ReplaceService ok')
})

test('parseWhere splits field, operator and JSON value', () => {
    assert.deepEqual(parseWhere('status,==,started'), ['status', '==', 'started'])
    assert.deepEqual(parseWhere('count,>,3'), ['count', '>', 3])
    assert.deepEqual(parseWhere('ids,in,["a","b"]'), ['ids', 'in', ['a', 'b']])
    assert.throws(() => parseWhere('status,like,x'))
})

test('summarizeTask decodes and redacts the JSON body and marks overdue tasks stuck', () => {
    const now = new Date(1790000000 * 1000 + 600_000)
    const summary = summarizeTask(
        {
            name: 'projects/p/locations/l/queues/verification-email/tasks/123',
            scheduleTime: { seconds: 1790000000 },
            dispatchCount: 1,
            httpRequest: {
                url: 'https://tasks.example/tasks/email/sendVerificationEmail',
                body: Buffer.from('{"userId":"u1","token":"live-token"}').toString('base64')
            }
        },
        now
    )
    assert.equal(summary.name, '123')
    assert.equal(summary.scheduleTime, new Date(1790000000 * 1000).toISOString())
    assert.equal(summary.overdueSeconds, 600)
    assert.equal(summary.stuck, true)
    assert.deepEqual(summary.body, { userId: 'u1', token: '<REDACTED>' })
})

test('permissionHint separates a scope rejection from a missing role', () => {
    assert.match(
        permissionHint('services', {
            response: {
                status: 403,
                data: { error: { message: 'Request had insufficient authentication scopes.' } }
            }
        }),
        /scope/
    )
    assert.match(permissionHint('services', { response: { status: 403 } }), /roles\/run\.viewer/)
})
