import {
    assertExists,
    BaseGameInitializer,
    Game,
    type GameInitializer,
    HydratedTurnManager,
    Prng,
    shuffle,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import {
    HydratedReefEncounterGameState,
    type Reef,
    type ReefEncounterGameState,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import { newPlayerState, type ReefEncounterPlayerState } from '../model/playerState.js'
import { CoralColors, type CoralColor, coralCounts, countColors } from '../components/colors.js'
import { CoralTiles, type CoralTileState } from '../components/coralTiles.js'
import {
    OpenSeaOrder,
    type OpenSeaSpace,
    spacesClockwiseFrom,
    StartingOpenSeaPolyps
} from '../components/openSea.js'
import { HydratedPolypBag } from '../components/polypBag.js'
import { ReefBoardIds, ReefBoards, type ReefBoardId } from '../components/reefBoards.js'
import { MachineState } from './states.js'
import { ReefEncounterColors } from './colors.js'

export const PolypsPerColor = 40
export const LarvaCubesPerColor = 10

// Polyps dealt behind each screen, in turn order from the start player (rulebook p. 4).
export const SetupDeal: Record<number, readonly number[]> = {
    2: [6, 9],
    3: [6, 7, 9],
    4: [6, 7, 8, 9]
}

export class ReefEncounterGameInitializer
    extends BaseGameInitializer<ReefEncounterProjectedState, HydratedReefEncounterGameState>
    implements GameInitializer<ReefEncounterProjectedState, HydratedReefEncounterGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedReefEncounterGameState {
        const prng = new Prng(state.prng)
        assertExists(state.protectedPrng, 'Dealing polyps requires protectedPrng')
        const protectedPrng = new Prng(state.protectedPrng)

        const colors = structuredClone(ReefEncounterColors)
        shuffle(colors, prng.random)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player, index) => ({ playerId: player.id, color: colors[index] })),
            prng.random,
            assignment
        )

        const reefs = this.chooseReefs(game.players.length, prng)
        const bonusPolyps = coralCounts(1)
        const polypBag = this.fillPolypBag(reefs.length, protectedPrng)
        const openSea = this.seedOpenSea(polypBag, protectedPrng)
        const deal = SetupDeal[game.players.length]
        assertExists(deal, `Reef Encounter has no setup for ${game.players.length} players`)

        const players: ReefEncounterPlayerState[] = turnManager.turnOrder.map((playerId, seat) => {
            const color = colors[game.players.findIndex((player) => player.id === playerId)]
            return newPlayerState(playerId, color, countColors(polypBag.drawItems(deal[seat])))
        })

        const reefEncounterState: ReefEncounterGameState = Object.assign(state, {
            players,
            machineState: MachineState.ChoosingParrotfishPolyp,
            turnManager,
            reefs,
            coralTiles: this.placeCoralTiles(prng),
            openSea,
            larvaCubeSupply: coralCounts(LarvaCubesPerColor - 1),
            bonusPolyps,
            polypBag
        })

        return new HydratedReefEncounterGameState(reefEncounterState)
    }

    private chooseReefs(playerCount: number, prng: Prng): Reef[] {
        const boardIds: ReefBoardId[] = [...ReefBoardIds]
        shuffle(boardIds, prng.random)
        return boardIds
            .slice(0, playerCount)
            .sort((a, b) => a - b)
            .map((boardId) => ({
                boardId,
                polyps: ReefBoards[boardId].startingPolyps.map((polyp) => structuredClone(polyp))
            }))
    }

    // Every board seeds one polyp of each colour, and one of each waits beside the board as a bonus.
    private fillPolypBag(reefCount: number, protectedPrng: Prng): HydratedPolypBag {
        const perColor = PolypsPerColor - reefCount - 1
        const bag = HydratedPolypBag.create(
            CoralColors.flatMap((color) => Array.from({ length: perColor }, () => color))
        )
        bag.shuffle(protectedPrng.random)
        return bag
    }

    // A polyp drawn and returned names the first space; the spaces then fill 3, 3, 3, 2, 1 clockwise.
    private seedOpenSea(bag: HydratedPolypBag, protectedPrng: Prng): OpenSeaSpace[] {
        const first: CoralColor = bag.draw()
        bag.addItem(first)
        bag.shuffle(protectedPrng.random)

        const polypsBySpace = new Map(
            spacesClockwiseFrom(first).map((larvaColor, index) => [
                larvaColor,
                bag.drawItems(StartingOpenSeaPolyps[index])
            ])
        )
        return OpenSeaOrder.map((larvaColor) => {
            const polyps = polypsBySpace.get(larvaColor)
            assertExists(polyps, `The open sea has no ${larvaColor} space`)
            return { larvaColor, polyps }
        })
    }

    // One tile is flipped; all ten then show the side it landed on.
    private placeCoralTiles(prng: Prng): CoralTileState[] {
        const starfishSideUp = prng.random() < 0.5
        return CoralTiles.map((tile) => ({ tileId: tile.id, starfishSideUp }))
    }
}
