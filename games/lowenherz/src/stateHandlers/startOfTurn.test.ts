import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, squareKey, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { HydratedDrawActionCard } from '../actions/drawActionCard.js'
import { StartOfTurnStateHandler } from './startOfTurn.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    const squares = Array.from({ length: BOARD_ROWS }, () =>
        Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }) as BoardSquare)
    )
    // One hill square, at (0,0), so region-based hill scoring has something to count.
    squares[0][0] = { type: SquareType.Hill }
    return { squares, walls: [] }
}

const standardCard: ActionCard = {
    id: 'card-standard',
    back: CardBack.B,
    type: ActionCardType.Standard,
    top: { kind: 'income', value: 4 },
    middle: { kind: 'border', count: 2 },
    bottom: { kind: 'knight', count: 1 }
}
const miningCard: ActionCard = { id: 'card-mining', back: CardBack.B, type: ActionCardType.Mining }
const kingIsDeadCard: ActionCard = { id: 'card-king', back: CardBack.E, type: ActionCardType.KingIsDead }

function buildState(actionDeck: ActionCard[]): HydratedLowenherzGameState {
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
        machineState: MachineState.StartOfTurn,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        // p1's region owns the one hill square on the board.
        regions: [{ id: 'r1', ownerColor: Color.Pink, squareKeys: [squareKey(0, 0)] }],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
        neutralColor: Color.Purple,
        actionDeck,
        currentActionCard: undefined,
        decisions: [{ playerId: 'stale', slot: 1 }],
        resolvedSlots: [],
        politicsCardPileA: [],
        politicsCardPileB: []
    }

    return new HydratedLowenherzGameState(data)
}

function makeDrawActionCard(): HydratedDrawActionCard {
    return new HydratedDrawActionCard({
        id: 'action-draw',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.DrawActionCard,
        playerId: 'p1'
    })
}

describe('StartOfTurnStateHandler', () => {
    it('transitions to ChoosingActions and resets decisions when a standard card is drawn', () => {
        const state = buildState([standardCard])
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new StartOfTurnStateHandler()

        const action = makeDrawActionCard()
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.ChoosingActions)
        expect(state.currentActionCard).toEqual(standardCard)
        expect(state.decisions).toEqual([])
    })

    it('awards hill power points and ends the game when King is Dead is drawn', () => {
        const state = buildState([kingIsDeadCard])
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new StartOfTurnStateHandler()

        const action = makeDrawActionCard()
        action.apply(state, context)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.EndOfGame)
        expect(state.getPlayerState('p1').powerPoints).toBe(1)
        expect(state.getPlayerState('p2').powerPoints).toBe(0)
        expect(action.metadata).toEqual({
            cardType: ActionCardType.KingIsDead,
            hillScoring: [
                { playerId: 'p1', points: 1 },
                { playerId: 'p2', points: 0 }
            ]
        })
    })

    it('resolves a Silver Mine card onto the discard pile and waits for a manual next draw', () => {
        const state = buildState([miningCard, standardCard])
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new StartOfTurnStateHandler()

        const firstDraw = makeDrawActionCard()
        firstDraw.apply(state, context)
        const stateAfterMining = handler.onAction(firstDraw, context)

        expect(stateAfterMining).toBe(MachineState.StartOfTurn)
        expect(state.getPlayerState('p1').powerPoints).toBe(1)
        expect(state.currentActionCard).toBeUndefined()
        expect(state.discardedActionCard).toEqual(miningCard)
        expect(state.actionDeck).toEqual([standardCard])

        // No system action is queued - the active player has to draw the next card
        // themselves, same as any other StartOfTurn draw.
        expect(context.getPendingActions().length).toBe(0)
        expect(HydratedDrawActionCard.canDrawActionCard(state, 'p1')).toBe(true)

        const secondDraw = makeDrawActionCard()
        secondDraw.apply(state, context)
        const finalState = handler.onAction(secondDraw, context)

        expect(finalState).toBe(MachineState.ChoosingActions)
        expect(state.currentActionCard).toEqual(standardCard)
        // Drawing the next card retires the mine from the discard pile - otherwise,
        // once the round ends and currentActionCard clears, the stale mine would
        // resurface as the face-up card again.
        expect(state.discardedActionCard).toBeUndefined()
    })
})
