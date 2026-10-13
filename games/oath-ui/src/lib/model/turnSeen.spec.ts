import { describe, expect, it } from 'vitest'
import { readTurnSeen, saveTurnSeen, turnSeenKey } from './turnSeen.js'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
    const items = new Map<string, string>()
    return {
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => void items.set(key, value)
    }
}

describe('the turn a seat last cleared, kept per game and seat in the browser', () => {
    it('keeps one turn’s start under a key of its own per game and seat', () => {
        const storage = memoryStorage()
        saveTurnSeen(storage, turnSeenKey('g1', 'p1'), 12)
        saveTurnSeen(storage, turnSeenKey('g1', 'p1'), 30)
        expect(readTurnSeen(storage.getItem(turnSeenKey('g1', 'p1')))).toBe(30)
        expect(readTurnSeen(storage.getItem(turnSeenKey('g1', 'p2')))).toBeUndefined()
        expect(turnSeenKey('g1', 'p1')).not.toBe(turnSeenKey('g2', 'p1'))
    })

    it('reads nothing from a value that is not a turn', () => {
        expect(readTurnSeen(null)).toBeUndefined()
        expect(readTurnSeen('["a1"]')).toBeUndefined()
        expect(readTurnSeen('-1')).toBeUndefined()
        expect(readTurnSeen('2.5')).toBeUndefined()
        expect(readTurnSeen('0')).toBe(0)
    })

    it('does not read the old Vision key', () => {
        expect(turnSeenKey('g1', 'p1')).toBe('oath:g1:p1:turnSeen')
    })

    it('survives a storage that refuses the write', () => {
        const full: Pick<Storage, 'setItem'> = {
            setItem: () => {
                throw Error('quota')
            }
        }
        expect(() => saveTurnSeen(full, turnSeenKey('g1', 'p1'), 4)).not.toThrow()
        expect(() => saveTurnSeen(undefined, turnSeenKey('g1', 'p1'), 4)).not.toThrow()
    })
})
