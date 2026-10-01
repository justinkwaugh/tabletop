import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    Visibility,
    assertExists,
    type RandomState,
    type AxialCoordinates
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { actionCard, type ActionCard } from '../components/actionCards.js'
import type { RoadEnds } from '../components/pieces.js'
import type { Market } from '../components/pieces.js'
import type { Place } from '../components/places.js'
import { Board, HydratedBoard } from './board.js'
import { planCityPlacement, type CityPlacementPlan } from './cityRules.js'
import { canBuildMarket, isMarketActive } from './marketRules.js'
import { HydratedMagnaGreciaPlayerState, MagnaGreciaPlayerState } from './playerState.js'
import { canPlaceRoad } from './roadRules.js'
import { scoreBreakdown, type ScoreBreakdown } from './scoring.js'
import {
    TurnProgress,
    hasUnfinishedCity,
    newTurn,
    remainingCityPlacements,
    remainingRoadPlacements,
    resupplyLimit
} from './turn.js'

export type MagnaGreciaGameState = Type.Static<typeof MagnaGreciaGameState>
export const MagnaGreciaGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(MagnaGreciaPlayerState),
    machineState: Type.Enum(MachineState),
    board: Board,
    deck: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.HostOnly
    }),
    revealedCardIds: Type.Array(Type.String()),
    roundCount: Type.Number(),
    round: Type.Number(),
    roundOrder: Type.Array(Type.String()),
    turnIndex: Type.Number(),
    turn: Type.Optional(TurnProgress)
})

export const MagnaGreciaGameStateValidator = Compile(MagnaGreciaGameState)
export const MagnaGreciaProjectedState = Visibility.createProjectionSchema(MagnaGreciaGameState)
export type MagnaGreciaProjectedState = Type.Static<typeof MagnaGreciaProjectedState>
export const MagnaGreciaProjectedStateValidator = Compile(MagnaGreciaProjectedState)

export class HydratedMagnaGreciaGameState
    extends HydratableGameState<typeof MagnaGreciaProjectedState, HydratedMagnaGreciaPlayerState>
    implements MagnaGreciaProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedMagnaGreciaPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedBoard
    declare deck?: string[]
    declare revealedCardIds: string[]
    declare roundCount: number
    declare round: number
    declare roundOrder: string[]
    declare turnIndex: number
    declare turn?: TurnProgress

    constructor(data: MagnaGreciaProjectedState) {
        super(data, MagnaGreciaProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedMagnaGreciaPlayerState(player))
        this.board = new HydratedBoard(data.board)
    }

    currentCard(): ActionCard {
        return actionCard(this.revealedCardIds[this.round])
    }

    upcomingCard(): ActionCard | undefined {
        const upcoming = this.revealedCardIds[this.round + 1]
        return upcoming === undefined ? undefined : actionCard(upcoming)
    }

    turnOrderForCard(card: ActionCard): string[] {
        return card.turnOrder
            .map((color) => this.players.find((player) => player.color === color)?.playerId)
            .filter((playerId) => playerId !== undefined)
    }

    beginRound(round: number) {
        const deck = this.deck
        assertExists(deck, 'Starting a round requires the action deck')
        this.round = round
        this.revealedCardIds = deck.slice(0, Math.min(round + 2, this.roundCount))
        this.roundOrder = this.turnOrderForCard(this.currentCard())
        this.turnIndex = 0
    }

    beginTurn(): string {
        const playerId = this.roundOrder[this.turnIndex]
        assertExists(playerId, `No player for turn ${this.turnIndex} of round ${this.round}`)
        this.turn = newTurn(playerId)
        return playerId
    }

    activeTurn(playerId: string): TurnProgress {
        const turn = this.turn
        assertExists(turn, 'No turn in progress')
        if (turn.playerId !== playerId) {
            throw Error(`It is not ${playerId}'s turn`)
        }
        return turn
    }

    isTurnOf(playerId: string): boolean {
        return this.turn?.playerId === playerId
    }

    hasUnfinishedCity(playerId: string): boolean {
        return this.isTurnOf(playerId) && !!this.turn && hasUnfinishedCity(this.turn)
    }

    roadPlacementsRemaining(playerId: string): number {
        if (!this.isTurnOf(playerId)) {
            return 0
        }
        const player = this.getPlayerState(playerId)
        return Math.min(
            remainingRoadPlacements(this.currentCard(), this.activeTurn(playerId)),
            player.supplyRoads
        )
    }

    cityPlacementsRemaining(playerId: string): number {
        if (!this.isTurnOf(playerId)) {
            return 0
        }
        const player = this.getPlayerState(playerId)
        return Math.min(
            remainingCityPlacements(this.currentCard(), this.activeTurn(playerId)),
            player.supplyCities,
            player.points
        )
    }

    resupplyAllowance(playerId: string): number {
        if (!this.isTurnOf(playerId)) {
            return 0
        }
        const player = this.getPlayerState(playerId)
        return Math.min(
            resupplyLimit(this.currentCard(), this.activeTurn(playerId)),
            player.stagingRoads + player.stagingCities
        )
    }

    canPlaceRoad(playerId: string, coords: AxialCoordinates, ends: RoadEnds): boolean {
        return (
            this.roadPlacementsRemaining(playerId) > 0 &&
            canPlaceRoad(this.board, playerId, coords, ends)
        )
    }

    cityPlacementPlan(playerId: string, coords: AxialCoordinates): CityPlacementPlan | undefined {
        if (!this.isTurnOf(playerId)) {
            return undefined
        }
        return planCityPlacement({
            board: this.board,
            playerId,
            coords,
            turn: this.activeTurn(playerId),
            tilesAvailable: this.cityPlacementsRemaining(playerId)
        })
    }

    canFinishTurn(playerId: string): boolean {
        return this.isTurnOf(playerId) && !this.hasUnfinishedCity(playerId)
    }

    marketSites(playerId: string): Place[] {
        if (!this.canFinishTurn(playerId)) {
            return []
        }
        const points = this.getPlayerState(playerId).points
        return this.board
            .places()
            .filter((place) => canBuildMarket(this.board, playerId, place, points))
    }

    sellableMarkets(playerId: string): Market[] {
        if (!this.canFinishTurn(playerId)) {
            return []
        }
        const network = this.board.network()
        return this.board.markets.filter(
            (market) =>
                market.playerId === playerId &&
                !market.sold &&
                isMarketActive(this.board, network, market)
        )
    }

    scores(): Record<string, ScoreBreakdown> {
        const network = this.board.network()
        return Object.fromEntries(
            this.players.map((player) => [
                player.playerId,
                scoreBreakdown(this.board, network, player)
            ])
        )
    }
}
