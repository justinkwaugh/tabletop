import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { Region } from '../model/region.js'
import { HydratedPlayAllianceCard } from './playAllianceCard.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function ownRegion(): Region {
    return { id: 'own', ownerColor: Color.Pink, squareKeys: ['0,0', '1,0'], castleSquareKey: '0,0' }
}

function enemyRegion(): Region {
    return { id: 'enemy', ownerColor: Color.Yellow, squareKeys: ['0,1', '1,1'], castleSquareKey: '0,1' }
}

function buildState(overrides: Partial<LowenherzGameState> = {}): HydratedLowenherzGameState {
    const playerIds = ['p1', 'p2']
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: [Color.Pink, Color.Yellow][index],
        money: 12,
        powerPoints: 0,
        knightsInStock: 5,
        politicsCards: [{ id: 'card-alliance', type: PoliticsCardType.Alliance }]
    }))

    const data: LowenherzGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players,
        activePlayerIds: ['p1'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.ChoosingActions,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [ownRegion(), enemyRegion()],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
        neutralColor: undefined,
        actionDeck: [],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makePlayAllianceCard(
    playerId: string,
    overrides: Partial<{ cardId: string; ownRegionId: string; enemyRegionId: string }> = {}
): HydratedPlayAllianceCard {
    return new HydratedPlayAllianceCard({
        id: 'alliance-1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlayAllianceCard,
        playerId,
        cardId: 'card-alliance',
        ownRegionId: 'own',
        enemyRegionId: 'enemy',
        ...overrides
    })
}

describe('HydratedPlayAllianceCard', () => {
    it('creates an alliance between the two chosen regions and discards the card', () => {
        const state = buildState()
        const action = makePlayAllianceCard('p1')

        expect(action.isValidPlayAllianceCard(state)).toBe(true)
        action.apply(state)

        expect(state.alliances).toEqual([{ id: 'alliance-1', regionAId: 'own', regionBId: 'enemy' }])
        expect(state.getPlayerState('p1').politicsCards).toEqual([])
        expect(action.metadata).toEqual({ allianceId: 'alliance-1', enemyColor: Color.Yellow })
    })

    it("rejects play when it isn't the player's turn to lay a decision card", () => {
        const state = buildState()
        expect(makePlayAllianceCard('p2').isValidPlayAllianceCard(state)).toBe(false)
    })

    it("rejects a card that isn't an Alliance card the player actually holds", () => {
        const state = buildState()
        state.getPlayerState('p1').politicsCards = []
        expect(makePlayAllianceCard('p1').isValidPlayAllianceCard(state)).toBe(false)
    })

    it("rejects when the chosen 'own' region doesn't belong to the player", () => {
        const state = buildState()
        expect(
            makePlayAllianceCard('p1', { ownRegionId: 'enemy', enemyRegionId: 'own' }).isValidPlayAllianceCard(state)
        ).toBe(false)
    })

    it("rejects when the chosen 'enemy' region is neutral or the player's own", () => {
        const state = buildState({ regions: [ownRegion(), { ...enemyRegion(), ownerColor: undefined }] })
        expect(makePlayAllianceCard('p1').isValidPlayAllianceCard(state)).toBe(false)
    })

    it("rejects when the two regions don't border each other", () => {
        const farEnemy: Region = { id: 'enemy', ownerColor: Color.Yellow, squareKeys: ['9,9'], castleSquareKey: '9,9' }
        const state = buildState({ regions: [ownRegion(), farEnemy] })

        expect(makePlayAllianceCard('p1').isValidPlayAllianceCard(state)).toBe(false)
    })

    it('rejects re-allying a pair of regions that are already allied', () => {
        const state = buildState({ alliances: [{ id: 'existing', regionAId: 'own', regionBId: 'enemy' }] })
        expect(makePlayAllianceCard('p1').isValidPlayAllianceCard(state)).toBe(false)
    })

    it('does not block a second alliance between different regions', () => {
        const otherEnemy: Region = { id: 'other-enemy', ownerColor: Color.Yellow, squareKeys: ['1,1'] }
        const state = buildState({
            regions: [ownRegion(), { ...enemyRegion(), squareKeys: ['0,1'] }, otherEnemy],
            alliances: [{ id: 'existing', regionAId: 'own', regionBId: 'enemy' }]
        })

        expect(
            makePlayAllianceCard('p1', { enemyRegionId: 'other-enemy' }).isValidPlayAllianceCard(state)
        ).toBe(true)
    })
})
