import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { HydratedDrawActionCard } from './drawActionCard.js'

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
        machineState: MachineState.StartOfTurn,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: playerIds[0],
        neutralColor: playerIds.length < 4 ? Color.Gray : undefined,
        actionDeck: [standardCard],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makeDrawActionCard(playerId: string): HydratedDrawActionCard {
    return new HydratedDrawActionCard({
        id: 'action-1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.DrawActionCard,
        playerId
    })
}

describe('HydratedDrawActionCard', () => {
    it('draws the top card off the deck and sets currentActionCard', () => {
        const state = buildState(['p1', 'p2'])
        const action = makeDrawActionCard('p1')

        expect(action.isValidDrawActionCard(state)).toBe(true)
        action.apply(state)

        expect(state.currentActionCard).toEqual(standardCard)
        expect(state.actionDeck.length).toBe(0)
    })

    it('rejects anyone other than the first player', () => {
        const state = buildState(['p1', 'p2'])
        const action = makeDrawActionCard('p2')

        expect(action.isValidDrawActionCard(state)).toBe(false)
    })

    it('rejects drawing while a card is already face up', () => {
        const state = buildState(['p1', 'p2'], { currentActionCard: standardCard })
        const action = makeDrawActionCard('p1')

        expect(action.isValidDrawActionCard(state)).toBe(false)
    })

    it('rejects drawing from an empty deck', () => {
        const state = buildState(['p1', 'p2'], { actionDeck: [] })
        const action = makeDrawActionCard('p1')

        expect(action.isValidDrawActionCard(state)).toBe(false)
    })

    it('rejects drawing before castle setup is complete, even though currentActionCard is unset there too', () => {
        // Regression: canDrawActionCard used to only check
        // !currentActionCard/deck-length, both of which are also true during
        // PlacingCastles (no card has ever been drawn yet) - letting a client
        // incorrectly think it could draw before setup finished.
        const state = buildState(['p1', 'p2'], { machineState: MachineState.PlacingCastles })
        const action = makeDrawActionCard('p1')

        expect(action.isValidDrawActionCard(state)).toBe(false)
    })
})
