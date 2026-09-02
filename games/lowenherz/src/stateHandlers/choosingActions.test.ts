import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { HydratedChooseAction } from '../actions/chooseAction.js'
import { HydratedPlayRenegadeCard } from '../actions/playRenegadeCard.js'
import { HydratedPlayAllianceCard } from '../actions/playAllianceCard.js'
import { HydratedCancelAlliance } from '../actions/cancelAlliance.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { ChoosingActionsStateHandler } from './choosingActions.js'
import { buildDecisionPlan, rotateToStart } from '../util/decisionPlan.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

const standardCard: ActionCard = {
    id: 'card-1',
    back: CardBack.B,
    type: ActionCardType.Standard,
    top: { kind: 'income', value: 4 },
    middle: { kind: 'border', count: 2 },
    bottom: { kind: 'knight', count: 1 }
}

function buildState(playerIds: string[]): HydratedLowenherzGameState {
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: [Color.Pink, Color.Yellow, Color.Purple, Color.Gray][index],
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
        machineState: MachineState.ChoosingActions,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: playerIds[0],
        neutralColor: playerIds.length < 4 ? Color.Gray : undefined,
        actionDeck: [],
        currentActionCard: standardCard,
        decisions: [],
        resolvedSlots: [],
        politicsCardPileA: [],
        politicsCardPileB: []
    }

    return new HydratedLowenherzGameState(data)
}

function makeChooseAction(playerId: string, slot: 1 | 2 | 3, index: number): HydratedChooseAction {
    return new HydratedChooseAction({
        id: `action-${index}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ChooseAction,
        playerId,
        slot
    })
}

// Drives the full decision-card round for a given turn order, following the plan
// exactly (each placement picks slot 1 - the specific slot doesn't matter for this
// test, only that the right player is allowed to act at each step).
function runFullRound(state: HydratedLowenherzGameState) {
    const handler = new ChoosingActionsStateHandler()
    const context = new MachineContext({ gameConfig: {}, gameState: state })
    const plan = buildDecisionPlan(rotateToStart(state.turnOrder, state.firstPlayerId))

    handler.enter(context)
    expect(state.activePlayerIds).toEqual([plan[0]])

    for (let i = 0; i < plan.length; i++) {
        const candidates = state.turnOrder.filter(
            (playerId) => handler.validActionsForPlayer(playerId, context).length > 0
        )
        expect(candidates).toEqual([plan[i]])

        // A player only owns one decision card of each number, so when the same
        // player places more than once this round (front-loaded for 2p/3p games),
        // each placement must use a different slot.
        const priorPlacementsThisPlayer = plan.slice(0, i).filter((id) => id === plan[i]).length
        const slot = ((priorPlacementsThisPlayer % 3) + 1) as 1 | 2 | 3
        const action = makeChooseAction(plan[i], slot, i)
        expect(handler.isValidAction(action, context)).toBe(true)

        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        const expectedDone = i === plan.length - 1
        expect(nextState).toBe(expectedDone ? MachineState.ResolvingActions : MachineState.ChoosingActions)

        if (!expectedDone) {
            handler.enter(context)
            expect(state.activePlayerIds).toEqual([plan[i + 1]])
        }
    }

    expect(state.decisions.map((d) => d.playerId)).toEqual(plan)
}

describe('ChoosingActionsStateHandler', () => {
    it('drives a full 4-player round (1 decision each)', () => {
        runFullRound(buildState(['p1', 'p2', 'p3', 'p4']))
    })

    it('drives a full 3-player round (first player places 2)', () => {
        runFullRound(buildState(['p1', 'p2', 'p3']))
    })

    it('drives a full 2-player round (both players place 2)', () => {
        runFullRound(buildState(['p1', 'p2']))
    })

    it('offers PlayRenegadeCard alongside ChooseAction when the player holds one and has knights in stock', () => {
        const state = buildState(['p1', 'p2'])
        state.getPlayerState('p1').politicsCards = [{ id: 'card-renegade', type: PoliticsCardType.Renegade }]
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        expect(handler.validActionsForPlayer('p1', context)).toEqual([
            ActionType.ChooseAction,
            ActionType.PlayRenegadeCard
        ])
    })

    it('does not offer PlayRenegadeCard when the player holds no Renegade card', () => {
        const state = buildState(['p1', 'p2'])
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.ChooseAction])
    })

    it('does not offer PlayRenegadeCard when the player has no knights left in stock', () => {
        const state = buildState(['p1', 'p2'])
        state.getPlayerState('p1').politicsCards = [{ id: 'card-renegade', type: PoliticsCardType.Renegade }]
        state.getPlayerState('p1').knightsInStock = 0
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.ChooseAction])
    })

    it('playing a Renegade card stays in ChoosingActions without consuming the decision-card turn', () => {
        const state = buildState(['p1', 'p2'])
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        const action = new HydratedPlayRenegadeCard({
            id: 'renegade-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlayRenegadeCard,
            playerId: 'p1',
            cardId: 'card-renegade',
            ownRegionId: 'own',
            enemyRegionId: 'enemy',
            removedCol: 0,
            removedRow: 0,
            placedCol: 1,
            placedRow: 0
        })

        expect(handler.onAction(action, context)).toBe(MachineState.ChoosingActions)
        expect(state.decisions).toEqual([])
    })

    it('offers PlayAllianceCard alongside ChooseAction when the player holds an Alliance card', () => {
        const state = buildState(['p1', 'p2'])
        state.getPlayerState('p1').politicsCards = [{ id: 'card-alliance', type: PoliticsCardType.Alliance }]
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        expect(handler.validActionsForPlayer('p1', context)).toEqual([
            ActionType.ChooseAction,
            ActionType.PlayAllianceCard
        ])
    })

    it('does not offer PlayAllianceCard when the player holds no Alliance card', () => {
        const state = buildState(['p1', 'p2'])
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.ChooseAction])
    })

    it('offers CancelAlliance to either participant when they can afford it', () => {
        const state = buildState(['p1', 'p2'])
        state.regions = [
            { id: 'r1', owner: 'p1', squareKeys: ['0,0'] },
            { id: 'r2', owner: 'p2', squareKeys: ['1,0'] }
        ]
        state.alliances = [{ id: 'alliance-1', regionAId: 'r1', regionBId: 'r2' }]
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        expect(handler.validActionsForPlayer('p1', context)).toEqual([
            ActionType.ChooseAction,
            ActionType.CancelAlliance
        ])
    })

    it('does not offer CancelAlliance when the player cannot afford the 10-ducat cost', () => {
        const state = buildState(['p1', 'p2'])
        state.regions = [
            { id: 'r1', owner: 'p1', squareKeys: ['0,0'] },
            { id: 'r2', owner: 'p2', squareKeys: ['1,0'] }
        ]
        state.alliances = [{ id: 'alliance-1', regionAId: 'r1', regionBId: 'r2' }]
        state.getPlayerState('p1').money = 0
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.ChooseAction])
    })

    it('does not offer CancelAlliance when the player is not a participant in any alliance', () => {
        const state = buildState(['p1', 'p2'])
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.ChooseAction])
    })

    it('playing an Alliance card stays in ChoosingActions without consuming the decision-card turn', () => {
        const state = buildState(['p1', 'p2'])
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        const action = new HydratedPlayAllianceCard({
            id: 'alliance-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlayAllianceCard,
            playerId: 'p1',
            cardId: 'card-alliance',
            ownRegionId: 'own',
            enemyRegionId: 'enemy'
        })

        expect(handler.onAction(action, context)).toBe(MachineState.ChoosingActions)
        expect(state.decisions).toEqual([])
    })

    it('cancelling an Alliance stays in ChoosingActions without consuming the decision-card turn', () => {
        const state = buildState(['p1', 'p2'])
        const handler = new ChoosingActionsStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        const action = new HydratedCancelAlliance({
            id: 'cancel-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.CancelAlliance,
            playerId: 'p1',
            allianceId: 'alliance-1'
        })

        expect(handler.onAction(action, context)).toBe(MachineState.ChoosingActions)
        expect(state.decisions).toEqual([])
    })
})
