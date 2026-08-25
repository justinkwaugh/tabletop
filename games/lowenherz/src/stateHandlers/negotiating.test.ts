import { describe, expect, it } from 'vitest'
import { Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { NegotiatingStateHandler } from './negotiating.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

const card: ActionCard = {
    id: 'card-1',
    back: CardBack.B,
    type: ActionCardType.Standard,
    top: { kind: 'politics' },
    middle: { kind: 'knight', count: 2 },
    bottom: { kind: 'knight', count: 1 }
}

function buildState(overrides: Partial<LowenherzGameState> = {}): HydratedLowenherzGameState {
    const playerIds = ['p1', 'p2']
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: [Color.Pink, Color.Yellow][index],
        money: 12,
        powerPoints: 0,
        knightsInStock: 12,
        politicsCards: []
    }))

    const data: LowenherzGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players,
        activePlayerIds: ['p1', 'p2'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.Negotiating,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
        neutralColor: undefined,
        actionDeck: [],
        currentActionCard: card,
        decisions: [],
        resolvedSlots: [],
        negotiation: { slot: 1, playerIds: ['p1', 'p2'], offer: undefined, signedPlayerIds: [] },
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function enter(state: HydratedLowenherzGameState) {
    new NegotiatingStateHandler().enter(new MachineContext({ gameConfig: {}, gameState: state }))
}

describe('NegotiatingStateHandler active players', () => {
    it('waits on both negotiators while no offer has been signed', () => {
        const state = buildState()

        enter(state)

        expect(state.activePlayerIds).toEqual(['p1', 'p2'])
    })

    it('stops waiting on a player once they have signed the standing offer', () => {
        const state = buildState({
            negotiation: {
                slot: 1,
                playerIds: ['p1', 'p2'],
                offer: { fromPlayerId: 'p1', amount: 3 },
                signedPlayerIds: ['p1']
            }
        })

        enter(state)

        // The move is p2's: p1 has said what they will do and cannot act again without
        // undoing it first.
        expect(state.activePlayerIds).toEqual(['p2'])
    })

    it('waits on both again once a counter-proposal has cleared the signatures', () => {
        // What NegotiationMove.apply leaves behind for a Propose: a new offer, no signatures.
        const state = buildState({
            negotiation: {
                slot: 1,
                playerIds: ['p1', 'p2'],
                offer: { fromPlayerId: 'p2', amount: 4 },
                signedPlayerIds: []
            }
        })

        enter(state)

        expect(state.activePlayerIds).toEqual(['p1', 'p2'])
    })

    it('waits on nobody when there is no negotiation', () => {
        const state = buildState({ negotiation: undefined })

        enter(state)

        expect(state.activePlayerIds).toEqual([])
    })
})
