import { createHash } from 'node:crypto'

export const REDACTED = '[redacted]'
const MAX_CONCEALMENT_DEPTH = 8

// A digest is an offline equality oracle for whatever it names, so it is only acceptable for
// identifiers with enough entropy to make enumeration hopeless: Session IDs, Authorization
// States and data tokens. Challenge codes and other supplied secrets are redacted, never digested.
export function secretReference(secret: string): string {
    return createHash('sha256').update(secret).digest('base64url')
}

export function concealedCause(error: unknown, secrets: readonly string[]): Error | undefined {
    if (!(error instanceof Error)) {
        return undefined
    }
    return concealError(error, concealedForms(secrets), new WeakSet(), 0)
}

function concealedForms(secrets: readonly string[]): string[] {
    const forms = new Set<string>()
    for (const secret of secrets) {
        if (secret.length === 0) continue
        forms.add(secret)
        forms.add(encodeURIComponent(secret))
    }
    return [...forms].sort((a, b) => b.length - a.length)
}

function concealError(
    error: Error,
    secrets: string[],
    seen: WeakSet<object>,
    depth: number
): Error {
    seen.add(error)
    const cause =
        error.cause === undefined ? undefined : concealValue(error.cause, secrets, seen, depth + 1)
    const concealed = new Error(concealText(error.message, secrets), { cause })
    Object.defineProperty(concealed, 'name', {
        value: error.name,
        writable: true,
        configurable: true
    })
    concealed.stack = error.stack === undefined ? undefined : concealText(error.stack, secrets)
    const ownProperties = Object.entries(error).filter(([key]) => key !== 'cause')
    return Object.assign(
        concealed,
        Object.fromEntries(
            ownProperties.map(([key, value]) => [
                key,
                concealValue(value, secrets, seen, depth + 1)
            ])
        )
    )
}

function concealValue(
    value: unknown,
    secrets: string[],
    seen: WeakSet<object>,
    depth: number
): unknown {
    if (typeof value === 'string') {
        return concealText(value, secrets)
    }
    if (typeof value !== 'object' || value === null || value instanceof Date) {
        return value
    }
    if (seen.has(value)) {
        return '[circular]'
    }
    if (depth > MAX_CONCEALMENT_DEPTH) {
        return '[omitted]'
    }
    if (value instanceof Error) {
        return concealError(value, secrets, seen, depth)
    }
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        return '[binary]'
    }
    seen.add(value)
    if (Array.isArray(value)) {
        return value.map((entry) => concealValue(entry, secrets, seen, depth + 1))
    }
    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
            key,
            concealValue(entry, secrets, seen, depth + 1)
        ])
    )
}

function concealText(text: string, secrets: string[]): string {
    return secrets.reduce((concealed, secret) => concealed.replaceAll(secret, REDACTED), text)
}
