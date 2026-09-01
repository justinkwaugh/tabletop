import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { NegotiatingStateHandler } from './negotiating.js'
import { ActionType } from '../definition/actions.js'
import { HydratedNegotiationMove, NegotiationMoveKind } from '../actions/negotiationMove.js'

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
        negotiation: { slot: 1, playerIds: ['p1', 'p2'], offer: undefined, lastProposedBy: undefined },
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
    it('waits on both negotiators while nobody has proposed yet', () => {
        const state = buildState()

        enter(state)

        expect(state.activePlayerIds).toEqual(['p1', 'p2'])
    })

    it('stops waiting on a player once they have proposed the standing offer', () => {
        const state = buildState({
            negotiation: {
                slot: 1,
                playerIds: ['p1', 'p2'],
                offer: { fromPlayerId: 'p1', amount: 3 },
                lastProposedBy: 'p1'
            }
        })

        enter(state)

        // The move is p2's: p1 has said what they will do and cannot act again without
        // undoing it first (except to Decline - see isActivePlayer).
        expect(state.activePlayerIds).toEqual(['p2'])
    })

    it('flips to waiting on the other player once a counter-proposal lands', () => {
        // What NegotiationMove.apply leaves behind for a non-matching Propose: a new
        // offer, and lastProposedBy pointing at whoever just moved.
        const state = buildState({
            negotiation: {
                slot: 1,
                playerIds: ['p1', 'p2'],
                offer: { fromPlayerId: 'p2', amount: 4 },
                lastProposedBy: 'p2'
            }
        })

        enter(state)

        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('waits on nobody when there is no negotiation', () => {
        const state = buildState({ negotiation: undefined })

        enter(state)

        expect(state.activePlayerIds).toEqual([])
    })
})

describe('HydratedLowenherzGameState.isActivePlayer during a negotiation', () => {
    it('still counts the non-active negotiator as an active player, for Decline', () => {
        const state = buildState({
            activePlayerIds: ['p2'],
            negotiation: {
                slot: 1,
                playerIds: ['p1', 'p2'],
                offer: { fromPlayerId: 'p1', amount: 3 },
                lastProposedBy: 'p1'
            }
        })

        expect(state.isActivePlayer('p1')).toBe(true)
        expect(state.isActivePlayer('p2')).toBe(true)
    })

    it('does not extend that to a player outside the negotiation', () => {
        const state = buildState({
            activePlayerIds: ['p2'],
            negotiation: {
                slot: 1,
                playerIds: ['p1', 'p2'],
                offer: { fromPlayerId: 'p1', amount: 3 },
                lastProposedBy: 'p1'
            }
        })

        expect(state.isActivePlayer('p3')).toBe(false)
    })
})

function propose(playerId: string, amount: number): HydratedNegotiationMove {
    return new HydratedNegotiationMove({
        id: `action-${playerId}-${amount}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.NegotiationMove,
        playerId,
        kind: NegotiationMoveKind.Propose,
        fromPlayerId: playerId,
        amount
    })
}

describe('the minimumOneDucat option', () => {
    it('rejects a zero-ducat offer while the rule is on', () => {
        const state = buildState({ minimumOneDucat: true })
        expect(propose('p1', 0).isValidNegotiationMove(state)).toBe(false)
        expect(propose('p1', 1).isValidNegotiationMove(state)).toBe(true)
    })

    it('treats an absent setting as the rule being on', () => {
        const state = buildState()
        expect(state.minimumOneDucat).toBeUndefined()
        expect(propose('p1', 0).isValidNegotiationMove(state)).toBe(false)
    })

    it('allows a zero-ducat offer once the rule is off', () => {
        const state = buildState({ minimumOneDucat: false })
        expect(propose('p1', 0).isValidNegotiationMove(state)).toBe(true)
    })

    it('still rejects a negative offer, or one larger than the proposer has', () => {
        const state = buildState({ minimumOneDucat: false })
        expect(propose('p1', -1).isValidNegotiationMove(state)).toBe(false)
        expect(propose('p1', 13).isValidNegotiationMove(state)).toBe(false)
    })
})
