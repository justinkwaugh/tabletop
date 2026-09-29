import {
    BaseGameInitializer,
    Color,
    HydratedTurnManager,
    Prng,
    shuffle,
    type Game,
    type GameInitializer,
    type UninitializedGameState
} from '@tabletop/common'
import { buildActionDeck } from '../components/actionCards.js'
import { BOARD_GRID } from '../components/boardGrid.js'
import type { Oracle } from '../components/pieces.js'
import { HydratedMagnaGreciaGameState, type MagnaGreciaGameState } from '../model/gameState.js'
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
    extends BaseGameInitializer<MagnaGreciaGameState, HydratedMagnaGreciaGameState>
    implements GameInitializer<MagnaGreciaGameState, HydratedMagnaGreciaGameState>
{
    initializeGameState(game: Game, state: UninitializedGameState): HydratedMagnaGreciaGameState {
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
        const turnManager = HydratedTurnManager.generate(players, prng.random)
        const deck = buildActionDeck(prng.random)

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
            roundCount: roundCount(game.config),
            round: 0,
            roundOrder: [],
            turnIndex: 0
        })
        const hydrated = new HydratedMagnaGreciaGameState(magnaGreciaState)
        hydrated.beginRound(0)
        return hydrated
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
