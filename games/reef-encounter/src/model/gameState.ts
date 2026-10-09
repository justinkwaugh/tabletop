import {
    assert,
    assertExists,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    OffsetCoordinates,
    PrngState,
    Visibility
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { CoralColor, CoralCounts, countColors, containsCounts } from '../components/colors.js'
import { CoralTileState } from '../components/coralTiles.js'
import { OpenSeaSpace } from '../components/openSea.js'
import { HydratedPolypBag, PolypBag } from '../components/polypBag.js'
import { ReefBoardIdSchema } from '../components/reefBoards.js'
import { HydratedReefEncounterPlayerState, ReefEncounterPlayerState } from './playerState.js'

export const LarvaCubesChosenAtSetup = 2

export type Polyp = Type.Static<typeof Polyp>
export const Polyp = Type.Object({
    coords: OffsetCoordinates,
    color: Type.Enum(CoralColor)
})

export type Reef = Type.Static<typeof Reef>
export const Reef = Type.Object({
    boardId: ReefBoardIdSchema,
    polyps: Type.Array(Polyp)
})

export type ReefEncounterGameState = Type.Static<typeof ReefEncounterGameState>
// Left unevaluated, like the player state, so hidden player fields stay optional when projected.
export const ReefEncounterGameState = Type.Intersect([
    Type.Omit(GameState, ['players', 'machineState']),
    Type.Object({
        players: Type.Array(ReefEncounterPlayerState),
        machineState: Type.Enum(MachineState),
        reefs: Type.Array(Reef),
        coralTiles: Type.Array(CoralTileState),
        openSea: Type.Array(OpenSeaSpace),
        larvaCubeSupply: CoralCounts,
        bonusPolyps: CoralCounts,
        polypBag: PolypBag
    })
])

export const ReefEncounterGameStateValidator = Compile(ReefEncounterGameState)

export const ReefEncounterProjectedState = Visibility.createProjectionSchema(ReefEncounterGameState)
export type ReefEncounterProjectedState = Type.Static<typeof ReefEncounterProjectedState>
const ReefEncounterProjectedStateValidator = Compile(ReefEncounterProjectedState)

export class HydratedReefEncounterGameState extends HydratableGameState<
    typeof ReefEncounterProjectedState,
    HydratedReefEncounterPlayerState
> {
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedReefEncounterPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare reefs: Reef[]
    declare coralTiles: CoralTileState[]
    declare openSea: OpenSeaSpace[]
    declare larvaCubeSupply: CoralCounts
    declare bonusPolyps: CoralCounts
    declare polypBag: HydratedPolypBag

    constructor(data: ReefEncounterProjectedState) {
        super(data, ReefEncounterProjectedStateValidator)

        this.players = data.players.map((player) => new HydratedReefEncounterPlayerState(player))
        this.polypBag = new HydratedPolypBag(data.polypBag)
    }

    turnPlayerId(): string {
        const turn = this.turnManager.currentTurn()
        assertExists(turn, 'No turn is in progress')
        return turn.playerId
    }

    isLastInTurnOrder(playerId: string): boolean {
        return this.turnManager.turnOrder.at(-1) === playerId
    }

    canTakeLarvaCubes(colors: readonly CoralColor[]): boolean {
        return (
            colors.length === LarvaCubesChosenAtSetup &&
            containsCounts(this.larvaCubeSupply, countColors(colors))
        )
    }

    takeLarvaCubes(playerId: string, colors: readonly CoralColor[]) {
        assert(
            this.canTakeLarvaCubes(colors),
            `The supply cannot provide larva cubes ${colors.join(', ')}`
        )
        const player = this.getPlayerState(playerId)
        for (const color of colors) {
            this.larvaCubeSupply[color] -= 1
            player.addLarvaCube(color)
        }
    }
}
