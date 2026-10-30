import {
    BaseGameInitializer,
    HydratedTurnManager,
    Prng,
    assertExists,
    shuffle,
    type Game,
    type GameInitializer,
    type Player,
    type RandomFunction,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { BOARD_GRID, BoardNodeKind, type SpaceId } from '../components/board.js'
import { START_PRICE_INDEX } from '../components/priceTrack.js'
import { perRailroad } from '../components/railroads.js'
import {
    TOWN_TILE_KINDS,
    TOWN_TILE_KIND_IDS,
    type TownTileKindId
} from '../components/townTiles.js'
import {
    CURRENT_PROMONTORY_POINT_REVISION,
    HydratedPromontoryPointGameState,
    type PromontoryPointGameState,
    type PromontoryPointProjectedState
} from '../model/gameState.js'
import type { PromontoryPointPlayerState } from '../model/playerState.js'
import { HydratedTrackBag } from '../model/trackBag.js'
import { PromontoryPointColors } from './colors.js'
import { normalizePromontoryPointConfig } from './config.js'
import { MachineState } from './states.js'

// R-1.3 steps 4–5
export const STARTING_MONEY = 20
export const STARTING_SHARES_PER_RAILROAD = 1
// R-1.3 step 6, R-6.3
export const HAND_SIZE = 3
export const FOUR_PIECE_VARIANT_HAND_SIZE = 4

export class PromontoryPointGameInitializer
    extends BaseGameInitializer<PromontoryPointProjectedState, HydratedPromontoryPointGameState>
    implements GameInitializer<PromontoryPointProjectedState, HydratedPromontoryPointGameState>
{
    readonly supportsStartingPositions = true

    // R-1.3, R-2.1, R-2.1-H1
    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedPromontoryPointGameState {
        const prng = new Prng(state.prng)
        assertExists(state.protectedPrng, 'The bag is shuffled from the protected stream')
        const protectedPrng = new Prng(state.protectedPrng)

        const players = this.initializePlayers(game, prng.random)
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const orderedPlayers = turnManager.turnOrder.map((playerId) => {
            const player = players.find((candidate) => candidate.playerId === playerId)
            assertExists(player, `No player ${playerId} in the turn order`)
            return player
        })
        const towns = this.dealTownTiles(prng.random)
        const bag = HydratedTrackBag.create(protectedPrng.random)
        const handSize = normalizePromontoryPointConfig(game.config).fourPieceVariant
            ? FOUR_PIECE_VARIANT_HAND_SIZE
            : HAND_SIZE
        for (const player of orderedPlayers) {
            player.hand = bag.drawItems(handSize)
            player.handCount = player.hand.length
        }

        const promontoryPointGameState: PromontoryPointGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.StartingTurn,
            turnManager,
            promontoryPointRevision: CURRENT_PROMONTORY_POINT_REVISION,
            towns,
            track: {},
            priceIndex: perRailroad(() => START_PRICE_INDEX),
            bag: bag.dehydrate(),
            scrapped: perRailroad(() => 0)
        })

        return new HydratedPromontoryPointGameState(promontoryPointGameState)
    }

    private initializePlayers(game: Game, random: RandomFunction): PromontoryPointPlayerState[] {
        const colors = [...PromontoryPointColors]
        shuffle(colors, random)

        return game.players.map((player: Player, index: number) => ({
            playerId: player.id,
            color: colors[index],
            money: STARTING_MONEY,
            shares: perRailroad(() => STARTING_SHARES_PER_RAILROAD),
            hand: [],
            handCount: 0
        }))
    }

    // R-1.3 step 1, R-1.1-H1
    private dealTownTiles(random: RandomFunction): Record<SpaceId, TownTileKindId> {
        const tiles = TOWN_TILE_KIND_IDS.flatMap((kindId) =>
            Array.from({ length: TOWN_TILE_KINDS[kindId].count }, () => kindId)
        )
        shuffle(tiles, random)
        const towns = BOARD_GRID.spaces().filter((space) => space.kind === BoardNodeKind.Town)
        return Object.fromEntries(towns.map((town, index) => [town.spaceId, tiles[index]]))
    }
}
