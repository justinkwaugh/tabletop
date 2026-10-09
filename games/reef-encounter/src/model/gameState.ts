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
import {
    CoralColor,
    CoralColors,
    CoralCounts,
    countColors,
    containsCounts,
    totalCount
} from '../components/colors.js'
import { CoralTileState } from '../components/coralTiles.js'
import {
    type OpenSeaAddition,
    OpenSeaPolypLimit,
    type OpenSeaRefill,
    OpenSeaSpace
} from '../components/openSea.js'
import { HydratedPolypBag, PolypBag } from '../components/polypBag.js'
import { ReefBoardIdSchema } from '../components/reefBoards.js'
import { compareScores, coralValues, scoreBreakdown, type ScoreBreakdown } from './scoring.js'
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

    openSeaSpace(larvaColor: CoralColor): OpenSeaSpace {
        const space = this.openSea.find((candidate) => candidate.larvaColor === larvaColor)
        assertExists(space, `The open sea has no ${larvaColor} space`)
        return space
    }

    canTakeOpenSeaSpace(larvaColor: CoralColor): boolean {
        return this.openSeaSpace(larvaColor).hasLarvaCube
    }

    // Action 10: the larva cube and every polyp on its space go behind the player's screen.
    takeOpenSeaSpace(playerId: string, larvaColor: CoralColor): CoralColor[] {
        assert(this.canTakeOpenSeaSpace(larvaColor), `The ${larvaColor} space has no larva cube`)
        const space = this.openSeaSpace(larvaColor)
        const polyps = space.polyps
        const player = this.getPlayerState(playerId)
        player.addLarvaCube(larvaColor)
        player.addKnownScreenPolyps(polyps)
        space.hasLarvaCube = false
        space.polyps = []
        return polyps
    }

    // A shortage of the cube or of polyps ends the game at once, so it leaves the open sea as it is.
    refillOpenSea(): OpenSeaRefill {
        const emptied = this.openSea.find((space) => !space.hasLarvaCube)
        assertExists(emptied, 'No open-sea space is waiting for a larva cube')
        const larvaColor = emptied.larvaColor
        const short = this.openSea.filter((space) => space.polyps.length < OpenSeaPolypLimit)
        const bonusPolypsReturned = short.length > this.polypBag.remaining
        const polypsAvailable =
            this.polypBag.remaining + (bonusPolypsReturned ? totalCount(this.bonusPolyps) : 0)
        const shortage = this.larvaCubeSupply[larvaColor] === 0 || short.length > polypsAvailable
        if (shortage) {
            return { larvaColor, additions: [], bonusPolypsReturned: false, shortage }
        }

        if (bonusPolypsReturned) {
            this.returnBonusPolypsToBag()
        }
        this.larvaCubeSupply[larvaColor] -= 1
        emptied.hasLarvaCube = true
        const additions: OpenSeaAddition[] = short.map((space) => {
            const polyp = this.polypBag.draw()
            space.polyps.push(polyp)
            return { larvaColor: space.larvaColor, polyp }
        })
        return { larvaColor, additions, bonusPolypsReturned, shortage }
    }

    scores(): Record<string, ScoreBreakdown> {
        const values = coralValues(this.coralTiles)
        return Object.fromEntries(
            this.players.map((player) => [player.playerId, scoreBreakdown(player, values)])
        )
    }

    leadingPlayerIds(): string[] {
        const scores = this.scores()
        const best = Object.values(scores).reduce((top, score) =>
            compareScores(score, top) > 0 ? score : top
        )
        return this.players
            .filter((player) => compareScores(scores[player.playerId], best) === 0)
            .map((player) => player.playerId)
    }

    // When the bag runs out, the bonus polyps join it for ordinary play (rulebook p. 11).
    private returnBonusPolypsToBag() {
        this.polypBag.addItems(
            CoralColors.flatMap((color) =>
                Array.from({ length: this.bonusPolyps[color] }, () => color)
            )
        )
        this.polypBag.shuffle(this.getProtectedPrng().random)
        for (const color of CoralColors) {
            this.bonusPolyps[color] = 0
        }
    }
}
