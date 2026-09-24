import type { Static, TSchema } from 'typebox'
import * as Value from 'typebox/value'

export function readStoredValue<T extends TSchema>(key: string, schema: T): Static<T> | undefined {
    const stored = localStorage.getItem(key)
    if (!stored) {
        return undefined
    }
    try {
        const value = Value.Convert(schema, JSON.parse(stored))
        return Value.Check(schema, value) ? value : undefined
    } catch {
        return undefined
    }
}

export function writeStoredValue(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        localStorage.removeItem(key)
    }
}

export function removeStoredValue(key: string): void {
    localStorage.removeItem(key)
}
