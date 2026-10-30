import { describe, expect, it } from 'vitest'
import { isValidStorageId } from './storageId.js'

describe('storage IDs', () => {
    it.each(['account-id', 'person@example.com', 'emailChange:account-id', '...', '__', '___'])(
        'accepts %j',
        (id) => {
            expect(isValidStorageId(id)).toBe(true)
        }
    )

    it.each(['', '.', '..', '/', 'a/b', '____', 'first__middle__last@example.com'])(
        'refuses %j',
        (id) => {
            expect(isValidStorageId(id)).toBe(false)
        }
    )

    it('enforces the length boundary before examining the content', () => {
        expect(isValidStorageId('a'.repeat(1500))).toBe(true)
        expect(isValidStorageId('a'.repeat(1501))).toBe(false)
        expect(isValidStorageId('a'.repeat(1_000_000) + '__')).toBe(false)
    })

    it.each(['\n', '\r', '\u2028', '\u2029'])(
        'preserves existing behavior across the line terminator %j',
        (separator) => {
            expect(isValidStorageId(`.${separator}`)).toBe(true)
            expect(isValidStorageId(`__${separator}__`)).toBe(true)
            expect(isValidStorageId(`${separator}____`)).toBe(true)
            expect(isValidStorageId(`____${separator}`)).toBe(false)
            expect(isValidStorageId(`${separator}/`)).toBe(false)
        }
    )
})
