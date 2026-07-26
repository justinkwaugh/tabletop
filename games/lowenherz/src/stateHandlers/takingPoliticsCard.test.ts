import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { HydratedLookAtPoliticsPile } from '../actions/lookAtPoliticsPile.js'
import { HydratedTakePoliticsCard } from '../actions/takePoliticsCard.js'
import { TakingPoliticsCardStateHandler } from './takingPoliticsCard.js'

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
        activePlayerIds: [],
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
        politicsCardPileA: [{ id: 'card-alliance', type: PoliticsCardType.Alliance }],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

describe('TakingPoliticsCardStateHandler', () => {
    it('sets activePlayerIds to the designated politics-taking player on enter', () => {
        const state = buildState()
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        new TakingPoliticsCardStateHandler().enter(context)

        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('only offers LookAtPoliticsPile to the designated player before a pile is opened', () => {
        const state = buildState()
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new TakingPoliticsCardStateHandler()

        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.LookAtPoliticsPile])
        expect(handler.validActionsForPlayer('p2', context)).toEqual([])
    })

    it('offers only TakePoliticsCard once a pile has been opened', () => {
        const state = buildState({ openedPoliticsPile: 'A' })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new TakingPoliticsCardStateHandler()

        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.TakePoliticsCard])
    })

    it('stays in TakingPoliticsCard once a pile is opened, so the pick remains undoable on its own', () => {
        const state = buildState()
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new TakingPoliticsCardStateHandler()

        const action = new HydratedLookAtPoliticsPile({
            id: 'look-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.LookAtPoliticsPile,
            playerId: 'p1',
            pile: 'A',
            revealsInfo: true
        })
        expect(handler.isValidAction(action, context)).toBe(true)
        action.apply(state, context)

        expect(handler.onAction(action, context)).toBe(MachineState.TakingPoliticsCard)
        expect(state.openedPoliticsPile).toBe('A')
    })

    it('returns to ResolvingActions once a card is taken', () => {
        const state = buildState({ openedPoliticsPile: 'A' })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new TakingPoliticsCardStateHandler()

        const action = new HydratedTakePoliticsCard({
            id: 'take-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.TakePoliticsCard,
            playerId: 'p1',
            pile: 'A',
            cardId: 'card-alliance'
        })
        expect(handler.isValidAction(action, context)).toBe(true)
        action.apply(state, context)

        expect(handler.onAction(action, context)).toBe(MachineState.ResolvingActions)
        expect(state.politicsTakingPlayerId).toBeUndefined()
        expect(state.openedPoliticsPile).toBeUndefined()
        expect(state.getPlayerState('p1').politicsCards).toHaveLength(1)
    })
})
