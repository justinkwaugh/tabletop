const REDACTED_KEYS =
    /^(auth|p256dh|keys|password|passwordHash|token|tokens|secret|secrets|privateKey|accessToken|refreshToken|sessionSecret|apiKey)$/i

export function redact(value, key = '') {
    if (REDACTED_KEYS.test(key)) return '<REDACTED>'
    if (key === 'endpoint' && typeof value === 'string') return endpointHost(value)
    if (Array.isArray(value)) return value.map((item) => redact(item))
    if (value && typeof value === 'object') {
        if (typeof value.toDate === 'function') return value.toDate().toISOString()
        if (value instanceof Date) return value.toISOString()
        if (typeof value.path === 'string' && typeof value.id === 'string' && value.firestore)
            return `ref:${value.path}`
        const out = {}
        for (const [k, v] of Object.entries(value)) out[k] = redact(v, k)
        return out
    }
    if (typeof value === 'string' && key === 'data') return redact(parseJsonOr(value, value))
    return value
}

// The token store keys each token document by the token value, so its ID is itself a secret.
const SECRET_ID_COLLECTIONS = new Set(['tokens'])

export function redactDoc(docPath, data) {
    const segments = docPath.split('/')
    const secretId = SECRET_ID_COLLECTIONS.has(segments.at(-2))
    const path = segments
        .map((segment, i) =>
            i % 2 === 1 && SECRET_ID_COLLECTIONS.has(segments[i - 1]) ? '<REDACTED>' : segment
        )
        .join('/')
    if (data === undefined) return { path }
    const redacted = redact(data)
    if (secretId && 'id' in redacted) redacted.id = '<REDACTED>'
    return { path, data: redacted }
}

// A push endpoint URL is a send capability, so only its host is ever shown.
function endpointHost(endpoint) {
    try {
        return `host:${new URL(endpoint).host}`
    } catch {
        return '<REDACTED>'
    }
}

export function parseJsonOr(text, fallback) {
    try {
        return JSON.parse(text)
    } catch {
        return fallback
    }
}

const DURATION = /^(\d+)([smhd])$/
const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

export function parseTime(text, now = new Date()) {
    const match = DURATION.exec(text)
    if (match) return new Date(now.getTime() - Number(match[1]) * UNIT_MS[match[2]])
    const date = new Date(text)
    if (Number.isNaN(date.getTime()))
        throw new Error(`Cannot parse time "${text}"; use 2h, 30m, 3d or an ISO timestamp`)
    return date
}

export function parseCount(text, fallback) {
    if (text === undefined) return fallback
    const count = Number(text)
    if (!Number.isInteger(count) || count <= 0)
        throw new Error(`Expected a positive whole number but got "${text}"`)
    return count
}

export function buildLogFilter({
    services,
    since,
    until,
    severity,
    grep,
    requestId,
    raw,
    anyResource
}) {
    const parts = []
    if (!anyResource) {
        parts.push('resource.type="cloud_run_revision"')
        if (services.length === 1) parts.push(`resource.labels.service_name="${services[0]}"`)
        else if (services.length > 1)
            parts.push(
                `(${services.map((s) => `resource.labels.service_name="${s}"`).join(' OR ')})`
            )
    }
    parts.push(`timestamp>="${since.toISOString()}"`)
    if (until) parts.push(`timestamp<="${until.toISOString()}"`)
    if (severity) parts.push(`severity>=${severity.toUpperCase()}`)
    if (grep) parts.push(`"${grep.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    if (requestId)
        parts.push(`(jsonPayload.reqId="${requestId}" OR jsonPayload.req.id="${requestId}")`)
    if (raw) parts.push(`(${raw})`)
    return parts.join(' AND ')
}

export function formatLogEntry(entry) {
    const labels = entry.resource?.labels ?? {}
    const revision = (labels.revision_name ?? '').split('-').slice(-2).join('-')
    const payload = entry.jsonPayload ?? {}
    let message = entry.textPayload ?? payload.msg ?? payload.message
    if (message === undefined) {
        if (entry.protoPayload)
            message = `${entry.protoPayload.methodName ?? 'proto'} ${entry.protoPayload.status?.message ?? ''}`
        else message = JSON.stringify(payload)
    }
    const req = entry.httpRequest
    const http = req
        ? ` ${req.requestMethod ?? ''} ${req.requestUrl ?? ''} -> ${req.status ?? ''}`
        : ''
    const extras = []
    if (payload.reqId) extras.push(`req=${payload.reqId}`)
    if (payload.err?.message) extras.push(`err=${payload.err.message}`)
    return `${entry.timestamp} ${(entry.severity ?? 'DEFAULT').padEnd(7)} ${labels.service_name ?? '?'}@${revision} ${message}${http}${extras.length ? ' ' + extras.join(' ') : ''}`
}

const WHERE_OPS = new Set([
    '==',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    'array-contains',
    'in',
    'array-contains-any'
])

export function parseWhere(text) {
    const first = text.indexOf(',')
    const second = text.indexOf(',', first + 1)
    if (first < 0 || second < 0) throw new Error(`--where expects field,op,value but got "${text}"`)
    const field = text.slice(0, first).trim()
    const op = text.slice(first + 1, second).trim()
    const rawValue = text.slice(second + 1)
    if (!WHERE_OPS.has(op)) throw new Error(`Unsupported --where operator "${op}"`)
    return [field, op, parseJsonOr(rawValue, rawValue)]
}

const STUCK_AFTER_SECONDS = 300

export function summarizeTask(task, now = new Date()) {
    const request = task.httpRequest ?? {}
    const bodyText = request.body ? Buffer.from(request.body, 'base64').toString('utf8') : undefined
    const scheduleTime = protoTimestampToIso(task.scheduleTime)
    const overdueSeconds = scheduleTime
        ? Math.max(0, Math.floor((now.getTime() - Date.parse(scheduleTime)) / 1000))
        : 0
    return {
        name: (task.name ?? '').split('/tasks/').pop(),
        scheduleTime,
        overdueSeconds,
        stuck: overdueSeconds > STUCK_AFTER_SECONDS,
        createTime: protoTimestampToIso(task.createTime),
        dispatchCount: task.dispatchCount ?? 0,
        responseCount: task.responseCount ?? 0,
        lastAttemptStatus:
            task.lastAttempt?.responseStatus?.message ?? task.lastAttempt?.responseStatus?.code,
        url: request.url,
        body: bodyText === undefined ? undefined : redact(parseJsonOr(bodyText, bodyText))
    }
}

export function protoTimestampToIso(timestamp) {
    return timestamp?.seconds !== undefined
        ? new Date(Number(timestamp.seconds) * 1000).toISOString()
        : undefined
}

const CAPABILITY_ROLES = {
    logs: 'roles/logging.viewer',
    services: 'roles/run.viewer',
    tasks: 'roles/cloudtasks.viewer',
    firestore: 'roles/datastore.viewer'
}

export function permissionHint(capability, error) {
    const status = error?.code ?? error?.response?.status ?? error?.status
    const message = error?.response?.data?.error?.message ?? error?.message ?? ''
    if (/authentication scopes/i.test(message)) return `token scope rejected by the API: ${message}`
    if (status === 403 || status === 7)
        return `permission denied; grant ${CAPABILITY_ROLES[capability]} to the service account`
    if (status === 401 || status === 16)
        return 'credentials rejected; the key file may be revoked or for another project'
    return message || String(error)
}
