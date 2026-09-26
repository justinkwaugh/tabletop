import {
    ActionSource,
    assertExists,
    GameEngine,
    GameResult,
    PlayerStatus,
    validateGameResult,
    type Game,
    type GameConfig
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Definition } from './definition.js'
import { LowenherzRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { ActionCardType } from './actionCards.js'
import { PoliticsCardType, type PoliticsCard } from './politicsCards.js'
import type { DrawActionCard } from '../actions/drawActionCard.js'
import { HydratedPlaceCastle, type PlaceCastle } from '../actions/placeCastle.js'
import type { PlaceSetupKnight } from '../actions/placeSetupKnight.js'
import { legalSetupKnightSquares } from '../util/setupKnightSquares.js'
import type { LowenherzProjectedState } from '../model/gameState.js'
import { awardHillPowerPoints } from '../util/hillPowerPoints.js'

const engine = new GameEngine(LowenherzRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number, config: GameConfig) {
    return LowenherzRuntime.initializer.initializeGame(
        {
            id: 'lowenherz-competition',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

describe.each([2, 3, 4])('Lowenherz tournaments with %i players', (count) => {
    describe.each([true, false])('playerPlacedCastles %s', (playerPlacedCastles) => {
        const openingState =
            count === 2 || playerPlacedCastles
                ? MachineState.PlacingCastles
                : MachineState.StartOfTurn

        it('seats players in the assigned order from the first turn', () => {
            const game = createGame(count, { playerPlacedCastles })
            const playerIds = game.players.map((player) => player.id)
            for (let offset = 0; offset < count; offset++) {
                const order = [...playerIds.slice(offset), ...playerIds.slice(0, offset)]
                const { initialState, startedGame } = engine.startGame(game, {
                    masterSeed,
                    startingPositions: { playerIds: order }
                })
                expect(startedGame.protectedInformation).toBe(true)
                expect(initialState.machineState).toBe(openingState)
                expect(initialState.turnManager.turnOrder).toEqual(order)
                expect(initialState.turnOrder).toEqual(order)
                expect(initialState.firstPlayerId).toBe(order[0])
                expect(initialState.players.map((player) => player.playerId)).toEqual(order)
                expect(initialState.activePlayerIds).toEqual([order[0]])
            }
        })

        it('keeps the seeded board, colors, and decks independent of the assigned order', () => {
            const game = createGame(count, { playerPlacedCastles })
            const uninitialized = engine.generateUninitializedState(game, masterSeed)
            const normal = LowenherzRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized))
                .dehydrate()
            const sameOrder = LowenherzRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), {
                    playerIds: normal.turnManager.turnOrder
                })
                .dehydrate()
            expect(sameOrder).toEqual(normal)

            const reversedIds = normal.turnManager.turnOrder.toReversed()
            const reversed = LowenherzRuntime.initializer
                .initializeGameState(game, structuredClone(uninitialized), {
                    playerIds: reversedIds
                })
                .dehydrate()
            expect(reversed.turnOrder).toEqual(reversedIds)
            expect(
                reversed.players.map((player) => [player.playerId, player.color]).toSorted()
            ).toEqual(normal.players.map((player) => [player.playerId, player.color]).toSorted())
            expect(reversed.neutralColor).toEqual(normal.neutralColor)
            expect(reversed.board).toEqual(normal.board)
            expect(reversed.actionDeck).toEqual(normal.actionDeck)
            expect(reversed.politicsCardPileA).toEqual(normal.politicsCardPileA)
            expect(reversed.politicsCardPileB).toEqual(normal.politicsCardPileB)
            expect(reversed.prng).toEqual(normal.prng)
            expect(reversed.protectedPrng).toEqual(normal.protectedPrng)
        })
    })
})

type FinalStanding = { finalPowerPoints: number; money: number; politicsCards: PoliticsCard[] }

function legalCastleAndKnight(state: LowenherzProjectedState, playerId: string) {
    const hydrated = LowenherzRuntime.hydrator.hydrateState(state)
    for (const [castleRow, row] of hydrated.board.squares.entries()) {
        for (const castleCol of row.keys()) {
            if (!HydratedPlaceCastle.isValidCastleSquare(hydrated, playerId, castleCol, castleRow))
                continue
            const [knight] = legalSetupKnightSquares(hydrated, castleCol, castleRow)
            if (knight) return { castleCol, castleRow, knight }
        }
    }
    throw new Error(`No legal castle placement for ${playerId}`)
}

function completeCastleSetup(game: Game, initialState: LowenherzProjectedState) {
    let state = initialState
    for (let placement = 0; state.machineState === MachineState.PlacingCastles; placement++) {
        const [playerId] = state.activePlayerIds
        const { castleCol, castleRow, knight } = legalCastleAndKnight(state, playerId)
        const castle: PlaceCastle = {
            id: `castle-${placement}`,
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.PlaceCastle,
            playerId,
            castleCol,
            castleRow
        }
        state = engine.executeCanonicalAction({ game, state, action: castle }).updatedState
        const setupKnight: PlaceSetupKnight = {
            id: `knight-${placement}`,
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.PlaceSetupKnight,
            playerId,
            knightCol: knight.col,
            knightRow: knight.row
        }
        state = engine.executeCanonicalAction({ game, state, action: setupKnight }).updatedState
    }
    return state
}

function finishGame(count: number, standings: Record<string, FinalStanding>) {
    const game = createGame(count, { playerPlacedCastles: false })
    const { initialState, startedGame } = engine.startGame(game, {
        masterSeed,
        startingPositions: { playerIds: game.players.map((player) => player.id).reverse() }
    })
    const state = LowenherzRuntime.hydrator.hydrateState(
        completeCastleSetup(startedGame, initialState)
    )
    expect(state.machineState).toBe(MachineState.StartOfTurn)

    const deck = state.getActionDeck()
    const kingIsDeadIndex = deck.findIndex((card) => card.type === ActionCardType.KingIsDead)
    deck.unshift(...deck.splice(kingIsDeadIndex, 1))
    state.actionDeckBacks = deck.map((card) => card.back)

    const hillPoints = Object.fromEntries(
        awardHillPowerPoints(LowenherzRuntime.hydrator.hydrateState(state.dehydrate())).map(
            (entry) => [entry.playerId, entry.points]
        )
    )
    for (const player of state.players) {
        const standing = standings[player.playerId]
        const parchmentPoints = standing.politicsCards
            .filter((card) => card.type === PoliticsCardType.Parchment)
            .reduce((sum, card) => sum + (card.value ?? 0), 0)
        player.powerPoints =
            standing.finalPowerPoints - hillPoints[player.playerId] - parchmentPoints
        player.money = standing.money
        player.politicsCards = structuredClone(standing.politicsCards)
        player.syncPoliticsCardCount()
    }

    const action: DrawActionCard = {
        id: 'draw-king-is-dead',
        gameId: game.id,
        source: ActionSource.User,
        type: ActionType.DrawActionCard,
        playerId: state.firstPlayerId
    }
    const finished = engine.executeCanonicalAction({
        game: startedGame,
        state: state.dehydrate(),
        action
    }).updatedState
    expect(finished.machineState).toBe(MachineState.EndOfGame)
    return finished
}

describe.each([2, 3, 4])('Lowenherz final scores with %i players', (count) => {
    const standing = (
        finalPowerPoints: number,
        money: number,
        politicsCards: PoliticsCard[] = []
    ): FinalStanding => ({ finalPowerPoints, money, politicsCards })
    const others = (from: number) =>
        Object.fromEntries(
            Array.from({ length: count - from }, (_, index) => [
                `p${from + index}`,
                standing(10 + index, 20)
            ])
        )

    it.each([
        {
            name: 'a sole power leader, counting held Parchment',
            standings: {
                p0: standing(30, 0, [{ type: PoliticsCardType.Parchment, value: 5 }]),
                p1: standing(25, 40),
                ...others(2)
            },
            result: GameResult.Win,
            winners: ['p0'],
            powerLeaders: ['p0']
        },
        {
            name: 'a power tie broken by ducats including Treasure',
            standings: {
                p0: standing(30, 10),
                p1: standing(30, 3, [{ type: PoliticsCardType.Treasure, value: 15 }]),
                ...others(2)
            },
            result: GameResult.Win,
            winners: ['p1'],
            powerLeaders: ['p0', 'p1']
        },
        {
            name: 'a power and ducat tie',
            standings: { p0: standing(30, 10), p1: standing(30, 10), ...others(2) },
            result: GameResult.Draw,
            winners: ['p0', 'p1'],
            powerLeaders: ['p0', 'p1']
        }
    ])('scores final power points for $name', ({ standings, result, winners, powerLeaders }) => {
        const finished = finishGame(count, standings)
        expect(finished.result).toBe(result)
        expect(finished.winningPlayerIds.toSorted()).toEqual(winners)
        expect(() => validateGameResult(finished)).not.toThrow()

        const scoring = LowenherzRuntime.scoring
        assertExists(scoring, 'Lowenherz declares final scores')
        const finalScores = scoring.finalScores(finished)
        expect(finalScores).toEqual(
            Object.fromEntries(
                Object.entries(standings).map(([playerId, { finalPowerPoints }]) => [
                    playerId,
                    finalPowerPoints
                ])
            )
        )
        expect(finalScores).toEqual(
            Object.fromEntries(
                finished.players.map((player) => [player.playerId, player.powerPoints])
            )
        )
        const best = Math.max(...Object.values(finalScores))
        expect(
            Object.keys(finalScores)
                .filter((playerId) => finalScores[playerId] === best)
                .toSorted()
        ).toEqual(powerLeaders)
        for (const playerId of finished.winningPlayerIds) {
            expect(finalScores[playerId]).toBe(best)
        }
    })
})
