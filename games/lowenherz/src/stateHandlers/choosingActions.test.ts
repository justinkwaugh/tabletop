import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { HydratedChooseAction } from '../actions/chooseAction.js'
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
        knightsInStock: 12
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
        turnOrder: playerIds,
        firstPlayerId: playerIds[0],
        neutralColor: playerIds.length < 4 ? Color.Gray : undefined,
        actionDeck: [],
        currentActionCard: standardCard,
        decisions: [],
        resolvedSlots: []
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
})
