import { FormatRegistry } from '@sinclair/typebox'

const Uuid = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

/**
 * `[ajv-formats]` A Universally Unique Identifier as defined by [RFC 4122](https://datatracker.ietf.org/doc/html/rfc4122).
 * @example `9aa8a673-8590-4db2-9830-01755844f7c1`
 */
export function IsUuid(value: string): boolean {
    return Uuid.test(value)
}

FormatRegistry.Set('uuid', (value) => IsUuid(value))
