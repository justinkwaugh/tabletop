import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { HydratedChooseAction } from './chooseAction.js'

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

const miningCard: ActionCard = { id: 'card-mining', back: CardBack.B, type: ActionCardType.Mining }

function buildState(
    playerIds: string[],
    overrides: Partial<LowenherzGameState> = {}
): HydratedLowenherzGameState {
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
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makeChooseAction(playerId: string, slot: 1 | 2 | 3): HydratedChooseAction {
    return new HydratedChooseAction({
        id: `action-${playerId}-${slot}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ChooseAction,
        playerId,
        slot
    })
}

describe('HydratedChooseAction', () => {
    it('lets the first player in the decision plan choose a slot', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const action = makeChooseAction('p1', 1)

        expect(action.isValidChooseAction(state)).toBe(true)
        action.apply(state)

        expect(state.decisions).toEqual([{ playerId: 'p1', slot: 1 }])
    })

    it('records the kind of action the chosen slot held, so history can name it later', () => {
        const state = buildState(['p1', 'p2'], { decisions: [] })

        const top = makeChooseAction('p1', 1)
        top.apply(state)
        expect(top.metadata?.slotKind).toBe('income')

        const middle = makeChooseAction('p1', 2)
        middle.apply(state)
        expect(middle.metadata?.slotKind).toBe('border')

        const bottom = makeChooseAction('p2', 3)
        bottom.apply(state)
        expect(bottom.metadata?.slotKind).toBe('knight')
    })

    it('rejects a player picking out of turn', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        expect(makeChooseAction('p2', 1).isValidChooseAction(state)).toBe(false)
    })

    it('lets two different players choose the same slot (ties are allowed here)', () => {
        const state = buildState(['p1', 'p2'], { decisions: [] })
        makeChooseAction('p1', 2).apply(state)
        makeChooseAction('p1', 3).apply(state)

        const action = makeChooseAction('p2', 2)
        expect(action.isValidChooseAction(state)).toBe(true)
        action.apply(state)

        expect(state.decisions).toEqual([
            { playerId: 'p1', slot: 2 },
            { playerId: 'p1', slot: 3 },
            { playerId: 'p2', slot: 2 }
        ])
    })

    it('rejects a player using the same slot twice in one round (they only own one card of each number)', () => {
        const state = buildState(['p1', 'p2'], { decisions: [] })
        makeChooseAction('p1', 2).apply(state)

        expect(makeChooseAction('p1', 2).isValidChooseAction(state)).toBe(false)
    })

    it('rejects choosing when there is no standard card face up', () => {
        const state = buildState(['p1', 'p2'], { currentActionCard: miningCard })
        expect(makeChooseAction('p1', 1).isValidChooseAction(state)).toBe(false)
    })

    it('rejects choosing once the round is already fully decided', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'], {
            decisions: [
                { playerId: 'p1', slot: 1 },
                { playerId: 'p2', slot: 2 },
                { playerId: 'p3', slot: 3 },
                { playerId: 'p4', slot: 1 }
            ]
        })
        expect(makeChooseAction('p1', 1).isValidChooseAction(state)).toBe(false)
    })
})
