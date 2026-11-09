import { describe, expect, it } from 'vitest'
import { Value } from 'typebox/value'
import { GameMetadata } from './gameMetadata.js'

const metadata: GameMetadata = {
    name: 'Example',
    designer: 'Example Designer',
    description: 'An example.',
    year: '2005',
    minPlayers: 2,
    maxPlayers: 4,
    defaultPlayerCount: 3,
    version: '1.0.0',
    beta: false
}

describe('GameMetadata publisher', () => {
    it('is optional', () => {
        expect(Value.Check(GameMetadata, metadata)).toBe(true)
    })

    it('accepts a named https link', () => {
        const publisher = { name: 'Example Publisher', url: 'https://example.com/game' }
        expect(Value.Check(GameMetadata, { ...metadata, publisher })).toBe(true)
    })

    it('accepts a link to a page that sells the game', () => {
        const publisher = {
            name: 'Example Publisher',
            url: 'https://example.com/game',
            sellsGame: true
        }
        expect(Value.Check(GameMetadata, { ...metadata, publisher })).toBe(true)
    })

    it.each([
        { name: 'Example Publisher', url: 'http://example.com/game' },
        { name: 'Example Publisher', url: 'javascript:alert(1)' },
        { name: '', url: 'https://example.com/game' }
    ])('rejects $url named "$name"', (publisher) => {
        expect(Value.Check(GameMetadata, { ...metadata, publisher })).toBe(false)
    })
})
