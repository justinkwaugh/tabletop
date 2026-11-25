import { describe, expect, it } from 'vitest'
import { APIError } from '@tabletop/frontend-components'
import { PlayerVoteKind } from '@tabletop/common'
import type { MessagePart } from '@tabletop/common'
import { undoneSummary, voteErrorMessage, voteRequestParts, voteTally } from './playerVoteText.js'

function partsText(parts: MessagePart[]): string {
    return parts.map((part) => (part.type === 'text' ? part.value : '')).join('')
}

const preview = {
    targetActionId: 'a',
    targetActionIndex: 4,
    affectedPlayerIds: ['p1', 'p2'],
    ownUndoReaches: false
}

describe('playerVoteText', () => {
    it('summarises what going back undoes', () => {
        expect(undoneSummary(preview)).toBe('Undoes moves by 2 players.')
    })

    it('shows the server’s reason for a refused vote', () => {
        const error = new APIError({
            name: 'DisallowedPlayerVoteError',
            message: 'refused',
            metadata: { reason: 'a vote is open' }
        })
        expect(voteErrorMessage(error)).toBe("That didn't work: a vote is open.")
        expect(voteErrorMessage(new Error('offline'))).toBe('That did not work. Please try again.')
    })

    it('says what a vote asks for, detailing an undo once its preview arrives', () => {
        const ballot = { id: 'v', initiatorPlayerId: 'p1', approvingPlayerIds: ['p1'] }
        const undo = {
            ...ballot,
            kind: PlayerVoteKind.Undo,
            targetActionId: 'a',
            targetActionIndex: 4
        } as const
        const name = (playerId: string) => (playerId === 'p2' ? 'Ann' : 'Bob')
        expect(partsText(voteRequestParts(undo, undefined, name, 'line'))).toBe(
            'Bob is asking to undo to an earlier point'
        )
        expect(partsText(voteRequestParts(undo, preview, name, 'sentence'))).toBe(
            'Bob is asking to undo to an earlier point undoing moves by 2 players.'
        )
    })

    it('names the winner a call declares', () => {
        const ballot = { id: 'v', initiatorPlayerId: 'p1', approvingPlayerIds: ['p1'] }
        const name = (playerId: string) => (playerId === 'p2' ? 'Ann' : 'Bob')
        expect(
            partsText(
                voteRequestParts(
                    { ...ballot, kind: PlayerVoteKind.Call, decliningPlayerIds: [] },
                    undefined,
                    name,
                    'line'
                )
            )
        ).toBe('Bob is asking to end the game with no winner')
        expect(
            partsText(
                voteRequestParts(
                    {
                        ...ballot,
                        kind: PlayerVoteKind.Call,
                        decliningPlayerIds: [],
                        declaredWinnerId: 'p2'
                    },
                    undefined,
                    name,
                    'line'
                )
            )
        ).toBe('Bob is asking to end the game with Ann as the winner')
    })

    it('counts agreement against everyone for undo and the majority for a call', () => {
        const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, userId: id }))
        const base = { id: 'v', initiatorPlayerId: 'a', approvingPlayerIds: ['a'] }
        expect(
            voteTally(
                { ...base, kind: PlayerVoteKind.Undo, targetActionId: 't', targetActionIndex: 0 },
                players
            )
        ).toBe('1 of 4 agreed')
        expect(
            voteTally(
                {
                    ...base,
                    kind: PlayerVoteKind.Call,
                    decliningPlayerIds: []
                },
                players
            )
        ).toBe('1 of 3 needed')
    })
})
