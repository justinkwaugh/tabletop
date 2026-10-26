import { describe, expect, it } from 'vitest'
import {
    GameClientCapability,
    GameStatus,
    PlayerStatus,
    PlayerVoteKind,
    type Game,
    type UndoVote
} from '@tabletop/common'
import { callGameOffer } from './callGameOffer.js'

function game(playerIds: string[], overrides: Partial<Game> = {}): Game {
    return {
        id: 'g',
        typeId: 't',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'a',
        name: 'Game',
        players: playerIds.map((id) => ({
            id,
            userId: id,
            name: id,
            isHuman: true,
            status: PlayerStatus.Joined
        })),
        config: {},
        hotseat: false,
        createdAt: new Date(),
        winningPlayerIds: [],
        ...overrides
    }
}

const supported = [GameClientCapability.CalledGames]

describe('callGameOffer', () => {
    it('offers Concede for two players and Call the game otherwise', () => {
        expect(callGameOffer(game(['a', 'b']), 'a', supported)).toEqual({
            concession: true,
            label: 'Concede'
        })
        expect(callGameOffer(game(['a', 'b', 'c']), 'a', supported)?.label).toBe('Call the game')
    })

    it('offers nothing to spectators, to titles without support, or once the game is over', () => {
        expect(callGameOffer(game(['a', 'b']), 'z', supported)).toBeUndefined()
        expect(callGameOffer(game(['a', 'b']), 'a', [])).toBeUndefined()
        expect(
            callGameOffer(game(['a', 'b'], { status: GameStatus.Finished }), 'a', supported)
        ).toBeUndefined()
        expect(callGameOffer(game(['a', 'b'], { hotseat: true }), 'a', supported)).toBeUndefined()
    })

    it('waits for an open vote to close before offering a call', () => {
        const vote: UndoVote = {
            id: 'v',
            kind: PlayerVoteKind.Undo,
            initiatorPlayerId: 'b',
            targetActionId: 'x',
            targetActionIndex: 0,
            approvingPlayerIds: ['b']
        }
        expect(callGameOffer(game(['a', 'b', 'c'], { vote }), 'a', supported)).toBeUndefined()
        expect(callGameOffer(game(['a', 'b'], { vote }), 'a', supported)?.label).toBe('Concede')
    })
})
