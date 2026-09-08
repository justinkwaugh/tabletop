import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCardType, type PoliticsCard } from '../definition/politicsCards.js'
import { HydratedTakePoliticsCard } from './takePoliticsCard.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
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
        activePlayerIds: ['p1'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.TakingPoliticsCard,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
        neutralColor: undefined,
        actionDeck: [],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        politicsTakingPlayerId: 'p1',
        openedPoliticsPile: 'A',
        politicsCardPileA: [
            { type: PoliticsCardType.Alliance },
            { type: PoliticsCardType.Treasure, value: 8 }
        ],
        politicsCardPileB: [{ type: PoliticsCardType.Renegade }],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makeTakePoliticsCard(
    playerId: string,
    pile: 'A' | 'B',
    card: PoliticsCard
): HydratedTakePoliticsCard {
    return new HydratedTakePoliticsCard({
        id: 'take-1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.TakePoliticsCard,
        playerId,
        pile,
        card
    })
}

describe('HydratedTakePoliticsCard', () => {
    it('takes exactly one of two identical copies and leaves the other available', () => {
        const state = buildState({
            politicsCardPileA: [
                { type: PoliticsCardType.Alliance },
                { type: PoliticsCardType.Alliance }
            ]
        })
        makeTakePoliticsCard('p1', 'A', { type: PoliticsCardType.Alliance }).apply(state)
        expect(state.getPoliticsPile('A')).toEqual([{ type: PoliticsCardType.Alliance }])
        expect(state.getPlayerState('p1').politicsCards).toEqual([
            { type: PoliticsCardType.Alliance }
        ])
    })

    it('picks a specific card out of the chosen pile and adds it to the hand', () => {
        const state = buildState()
        const action = makeTakePoliticsCard('p1', 'A', {
            type: PoliticsCardType.Treasure,
            value: 8
        })

        expect(action.isValidTakePoliticsCard(state)).toBe(true)
        action.apply(state)

        expect(state.getPoliticsPile('A')).toEqual([{ type: PoliticsCardType.Alliance }])
        expect(state.getPlayerState('p1').politicsCards).toEqual([
            { type: PoliticsCardType.Treasure, value: 8 }
        ])
        expect(state.politicsTakingPlayerId).toBeUndefined()
    })

    it('can pick from pile B instead, leaving pile A untouched', () => {
        const state = buildState({ openedPoliticsPile: 'B' })
        const action = makeTakePoliticsCard('p1', 'B', { type: PoliticsCardType.Renegade })
        action.apply(state)

        expect(state.getPoliticsPile('B')).toEqual([])
        expect(state.getPoliticsPile('A').length).toBe(2)
        expect(state.getPlayerState('p1').politicsCards).toEqual([
            { type: PoliticsCardType.Renegade }
        ])
    })

    it('rejects a pick from anyone other than the designated player', () => {
        const state = buildState()
        expect(
            makeTakePoliticsCard('p2', 'A', {
                type: PoliticsCardType.Alliance
            }).isValidTakePoliticsCard(state)
        ).toBe(false)
    })

    it("rejects a card that isn't in the chosen pile", () => {
        const state = buildState()
        expect(
            makeTakePoliticsCard('p1', 'A', {
                type: PoliticsCardType.Renegade
            }).isValidTakePoliticsCard(state)
        ).toBe(false)
    })

    it("rejects a pick from a pile the player hasn't looked through yet", () => {
        const state = buildState({ openedPoliticsPile: undefined })
        expect(
            makeTakePoliticsCard('p1', 'A', {
                type: PoliticsCardType.Alliance
            }).isValidTakePoliticsCard(state)
        ).toBe(false)
    })
})
