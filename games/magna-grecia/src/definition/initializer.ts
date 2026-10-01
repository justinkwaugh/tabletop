import {
    BaseGameInitializer,
    Color,
    HydratedTurnManager,
    Prng,
    assertExists,
    shuffle,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { actionCard, buildActionDeck } from '../components/actionCards.js'
import { BOARD_GRID } from '../components/boardGrid.js'
import type { Oracle } from '../components/pieces.js'
import {
    HydratedMagnaGreciaGameState,
    type MagnaGreciaGameState,
    type MagnaGreciaProjectedState
} from '../model/gameState.js'
import {
    HydratedMagnaGreciaPlayerState,
    STARTING_SUPPLY,
    TILES_PER_TYPE
} from '../model/playerState.js'
import { MagnaGreciaColors } from './colors.js'
import { roundCount } from './config.js'
import { MachineState } from './states.js'

const STARTING_POINTS: Record<number, number> = { 2: 10, 3: 12, 4: 15 }
const ORACLES_BY_PLAYER_COUNT: Record<number, number> = { 2: 7, 3: 7, 4: 9 }

export class MagnaGreciaGameInitializer
    extends BaseGameInitializer<MagnaGreciaProjectedState, HydratedMagnaGreciaGameState>
    implements GameInitializer<MagnaGreciaProjectedState, HydratedMagnaGreciaGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedMagnaGreciaGameState {
        const prng = new Prng(state.prng)
        const colors = [...MagnaGreciaColors]
        shuffle(colors, prng.random)
        const players = game.players.map(
            (player, index) =>
                new HydratedMagnaGreciaPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    points: STARTING_POINTS[game.players.length],
                    supplyRoads: STARTING_SUPPLY,
                    stagingRoads: TILES_PER_TYPE - STARTING_SUPPLY,
                    supplyCities: STARTING_SUPPLY,
                    stagingCities: TILES_PER_TYPE - STARTING_SUPPLY
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        assertExists(state.protectedPrng, 'Shuffling the action deck requires protectedPrng')
        const deck = buildActionDeck(new Prng(state.protectedPrng).random)
        if (assignment) {
            this.seatByFirstCard(players, assignment, actionCard(deck[0]).turnOrder)
        }

        const magnaGreciaState: MagnaGreciaGameState = Object.assign(state, {
            players: this.playersInColorOrder(players),
            machineState: MachineState.TakingTurn,
            turnManager,
            board: {
                roads: [],
                cities: [],
                oracles: this.placeOracles(game.players.length, prng),
                markets: [],
                nextCityNumber: 1
            },
            deck,
            revealedCardIds: [],
            roundCount: roundCount(game.config),
            round: 0,
            roundOrder: [],
            turnIndex: 0
        })
        const hydrated = new HydratedMagnaGreciaGameState(magnaGreciaState)
        hydrated.beginRound(0)
        return hydrated
    }

    private seatByFirstCard(
        players: HydratedMagnaGreciaPlayerState[],
        assignment: StartingPositionAssignment,
        cardOrder: Color[]
    ) {
        const seatColors = cardOrder.filter((color) =>
            players.some((player) => player.color === color)
        )
        assignment.playerIds.forEach((playerId, seat) => {
            const player = players.find((candidate) => candidate.playerId === playerId)
            assertExists(player, `No player ${playerId} for seat ${seat}`)
            player.color = seatColors[seat]
        })
    }

    private playersInColorOrder(
        players: HydratedMagnaGreciaPlayerState[]
    ): HydratedMagnaGreciaPlayerState[] {
        const order: Color[] = MagnaGreciaColors
        return players.toSorted((a, b) => order.indexOf(a.color) - order.indexOf(b.color))
    }

    private placeOracles(playerCount: number, prng: Prng): Oracle[] {
        const villages = BOARD_GRID.inlandVillages().map((space) => space.coords)
        shuffle(villages, prng.random)
        return villages.slice(0, ORACLES_BY_PLAYER_COUNT[playerCount]).map((coords) => ({ coords }))
    }
}
