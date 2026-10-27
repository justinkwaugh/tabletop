import { createHash } from 'node:crypto'

const MAX_CONCEALMENT_DEPTH = 8

type Concealment = { secret: string; reference: string }

export function secretReference(secret: string): string {
    return createHash('sha256').update(secret).digest('base64url')
}

export function concealedCause(error: unknown, secrets: readonly string[]): Error | undefined {
    if (!(error instanceof Error)) {
        return undefined
    }
    const concealments = secrets
        .filter((secret) => secret.length > 0)
        .map((secret) => ({ secret, reference: secretReference(secret) }))
    return concealError(error, concealments, new WeakSet(), 0)
}

function concealError(
    error: Error,
    concealments: Concealment[],
    seen: WeakSet<object>,
    depth: number
): Error {
    seen.add(error)
    const cause =
        error.cause === undefined
            ? undefined
            : concealValue(error.cause, concealments, seen, depth + 1)
    const concealed = new Error(concealText(error.message, concealments), { cause })
    Object.defineProperty(concealed, 'name', {
        value: error.name,
        writable: true,
        configurable: true
    })
    concealed.stack = error.stack === undefined ? undefined : concealText(error.stack, concealments)
    const ownProperties = Object.entries(error).filter(([key]) => key !== 'cause')
    return Object.assign(
        concealed,
        Object.fromEntries(
            ownProperties.map(([key, value]) => [
                key,
                concealValue(value, concealments, seen, depth + 1)
            ])
        )
    )
}

function concealValue(
    value: unknown,
    concealments: Concealment[],
    seen: WeakSet<object>,
    depth: number
): unknown {
    if (typeof value === 'string') {
        return concealText(value, concealments)
    }
    if (typeof value !== 'object' || value === null) {
        return value
    }
    if (seen.has(value)) {
        return '[circular]'
    }
    if (depth > MAX_CONCEALMENT_DEPTH) {
        return '[omitted]'
    }
    if (value instanceof Error) {
        return concealError(value, concealments, seen, depth)
    }
    if (Array.isArray(value)) {
        seen.add(value)
        return value.map((entry) => concealValue(entry, concealments, seen, depth + 1))
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
        return value
    }
    seen.add(value)
    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
            key,
            concealValue(entry, concealments, seen, depth + 1)
        ])
    )
}

function concealText(text: string, concealments: Concealment[]): string {
    return concealments.reduce(
        (concealed, { secret, reference }) => concealed.replaceAll(secret, reference),
        text
    )
}
