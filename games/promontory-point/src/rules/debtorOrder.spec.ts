import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { startGame } from '../testing/startGame.js'
import { debtorOrder } from './debtorOrder.js'

function seat(turnOrder: string[], index: number): string {
    const playerId = turnOrder[index % turnOrder.length]
    assertExists(playerId, `No seat ${index}`)
    return playerId
}

describe('Promontory Point debtor order', () => {
    const { state } = startGame({ playerCount: 4 })
    const { turnOrder } = state.turnManager

    it('R-4.3-H4: the placing player decides first when short, then seat order from the placing player', () => {
        const placing = seat(turnOrder, 2)
        const debtors = [seat(turnOrder, 0), seat(turnOrder, 1), placing, seat(turnOrder, 3)].map(
            (playerId, index) => ({ playerId, owed: index + 1 })
        )

        expect(debtorOrder(state, placing, debtors).map((debtor) => debtor.playerId)).toEqual([
            placing,
            seat(turnOrder, 3),
            seat(turnOrder, 0),
            seat(turnOrder, 1)
        ])
    })

    it('R-4.3-H4: without the placing player short, the next short seat after it decides first', () => {
        const placing = seat(turnOrder, 1)
        const debtors = [
            { playerId: seat(turnOrder, 0), owed: 4 },
            { playerId: seat(turnOrder, 3), owed: 2 }
        ]

        expect(debtorOrder(state, placing, debtors)).toEqual([
            { playerId: seat(turnOrder, 3), owed: 2 },
            { playerId: seat(turnOrder, 0), owed: 4 }
        ])
    })

    it('R-4.3-H4: follows seat order, not the order of the players list', () => {
        const placing = seat(turnOrder, 0)
        const debtors = [...state.players]
            .reverse()
            .map((player) => ({ playerId: player.playerId, owed: 2 }))

        expect(debtorOrder(state, placing, debtors).map((debtor) => debtor.playerId)).toEqual(
            turnOrder
        )
    })
})
