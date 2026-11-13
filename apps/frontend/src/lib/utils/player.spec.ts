import { describe, expect, it } from 'vitest'
import { GameStatus, PlayerStatus, type Game } from '@tabletop/common'
import { activePlayerText, ownerName } from './player'

const players = ['dana', 'rhys', 'mira'].map((name) => ({
    id: `p-${name}`,
    userId: name,
    name,
    isHuman: true,
    status: PlayerStatus.Joined
}))

function startedGame(activePlayerIds: string[]): Game {
    return {
        id: 'g',
        typeId: 't',
        status: GameStatus.Started,
        isPublic: true,
        deleted: false,
        ownerId: 'dana',
        name: 'Game',
        players,
        config: {},
        hotseat: false,
        createdAt: new Date('2026-11-12T12:00:00Z'),
        winningPlayerIds: [],
        activePlayerIds
    }
}

describe('activePlayerText', () => {
    it('names the one active player, or You when it is the viewer', () => {
        expect(activePlayerText(startedGame(['p-rhys']), 'dana')).toBe('rhys')
        expect(activePlayerText(startedGame(['p-dana']), 'dana')).toBe('You')
    })

    it('says Multiple players when several are active, even when the viewer is one', () => {
        expect(activePlayerText(startedGame(['p-dana', 'p-rhys']), 'dana')).toBe('Multiple players')
    })
})

describe('ownerName', () => {
    it('names the owner from their seat, and nobody when they have none', () => {
        expect(ownerName({ ownerId: 'dana', players })).toBe('dana')
        expect(ownerName({ ownerId: 'someone', players })).toBeUndefined()
    })
})
