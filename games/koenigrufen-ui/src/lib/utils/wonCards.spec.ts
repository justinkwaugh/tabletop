import { describe, expect, it } from 'vitest'
import { Contract, contractDefinition, MachineState } from '@tabletop/koenigrufen'
import { wonCardCount, type WonCardsTable } from './wonCards.js'

const order = ['a', 'b', 'c', 'd']

function trickWonBy(winnerId: string) {
    return {
        winnerId,
        plays: order.map((playerId, index) => ({ playerId, cardId: `${winnerId}${index}` }))
    }
}

// Declarer is c, so d gathers the defenders' cards.
function table({
    contract = Contract.Rufer,
    machineState = MachineState.Playing,
    tricks = [],
    discardCount = 0,
    shownDiscards = [],
    rejectedTalonHalf,
    kingInTalon = false
}: {
    contract?: Contract
    machineState?: MachineState
    tricks?: WonCardsTable['tricks']
    discardCount?: number
    shownDiscards?: string[]
    rejectedTalonHalf?: string[]
    kingInTalon?: boolean
}): WonCardsTable {
    return {
        contract: { declarerId: 'c' },
        machineState,
        talonHalves: rejectedTalonHalf ? [['x1', 'x2', 'x3'], rejectedTalonHalf] : undefined,
        rejectedTalonHalf,
        turnManager: { turnOrder: order },
        contractDefinition: () => contractDefinition(contract),
        isCalledKingInTalon: () => kingInTalon,
        tricks,
        getPlayerState: (playerId) =>
            playerId === 'c'
                ? { discardCount, shownDiscards }
                : { discardCount: 0, shownDiscards: [] }
    }
}

const half = ['r1', 'r2', 'r3']

describe('cards won', () => {
    it('counts every card of the tricks a player won', () => {
        const won = table({ tricks: [trickWonBy('a'), trickWonBy('b'), trickWonBy('a')] })
        expect(wonCardCount(won, 'a')).toBe(8)
        expect(wonCardCount(won, 'b')).toBe(4)
        expect(wonCardCount(won, 'd')).toBe(0)
    })

    it('adds the cards the declarer laid away face down', () => {
        expect(wonCardCount(table({ discardCount: 3 }), 'c')).toBe(3)
        expect(
            wonCardCount(table({ contract: Contract.Sechserdreier, discardCount: 6 }), 'c')
        ).toBe(6)
    })

    it('leaves out laid-away cards shown face up', () => {
        expect(
            wonCardCount(
                table({
                    contract: Contract.Farbendreier,
                    discardCount: 3,
                    shownDiscards: ['s1', 's2']
                }),
                'c'
            )
        ).toBe(1)
    })

    it('leaves out the half waiting in the corner while the partner is secret', () => {
        const waiting = table({ rejectedTalonHalf: half, discardCount: 3 })
        expect(order.map((playerId) => wonCardCount(waiting, playerId))).toEqual([0, 0, 3, 0])
    })

    it('leaves out a face-down talon waiting in the corner', () => {
        const waiting = table({ contract: Contract.Piccolo })
        expect(order.map((playerId) => wonCardCount(waiting, playerId))).toEqual([0, 0, 0, 0])
    })

    it('gives the rejected half to the defenders’ collector when declarer plays alone', () => {
        expect(
            wonCardCount(table({ contract: Contract.Dreier, rejectedTalonHalf: half }), 'd')
        ).toBe(3)
        expect(wonCardCount(table({ rejectedTalonHalf: half, kingInTalon: true }), 'd')).toBe(3)
    })

    it('gives the unseen talon to the defenders’ collector once it has left the middle', () => {
        expect(wonCardCount(table({ contract: Contract.Solodreier }), 'd')).toBe(6)
        expect(
            wonCardCount(
                table({ contract: Contract.Solodreier, machineState: MachineState.CallingKing }),
                'd'
            )
        ).toBe(0)
    })
})
