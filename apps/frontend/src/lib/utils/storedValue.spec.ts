import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Type from 'typebox'
import { readStoredValue, removeStoredValue, writeStoredValue } from './storedValue.js'

const Entry = Type.Object({ name: Type.String(), count: Type.Number() })

let entries: Map<string, string>
let quotaExceeded: boolean

beforeEach(() => {
    entries = new Map()
    quotaExceeded = false
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => {
            if (quotaExceeded) {
                throw new DOMException('Quota exceeded', 'QuotaExceededError')
            }
            entries.set(key, value)
        },
        removeItem: (key: string) => entries.delete(key)
    })
})

describe('stored values', () => {
    it('reads back a written value', () => {
        writeStoredValue('entry', { name: 'a', count: 1 })

        expect(readStoredValue('entry', Entry)).toEqual({ name: 'a', count: 1 })
    })

    it.each([
        { stored: undefined, reason: 'nothing is stored' },
        { stored: '{not json', reason: 'the value is not JSON' },
        { stored: '{"name":"a"}', reason: 'the value does not match the schema' }
    ])('reads nothing when $reason', ({ stored }) => {
        if (stored !== undefined) {
            entries.set('entry', stored)
        }

        expect(readStoredValue('entry', Entry)).toBeUndefined()
    })

    it('drops the previous value when a write fails', () => {
        writeStoredValue('entry', { name: 'a', count: 1 })
        quotaExceeded = true

        writeStoredValue('entry', { name: 'b', count: 2 })

        expect(readStoredValue('entry', Entry)).toBeUndefined()
    })

    it('removes a value', () => {
        writeStoredValue('entry', { name: 'a', count: 1 })

        removeStoredValue('entry')

        expect(readStoredValue('entry', Entry)).toBeUndefined()
    })
})
