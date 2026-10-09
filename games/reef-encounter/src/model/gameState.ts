import {
    assert,
    assertExists,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    type OffsetCoordinates,
    PrngState,
    sameCoordinates,
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
import { isRock, ReefBoards, type ReefBoardId } from '../components/reefBoards.js'
import {
    isProtected,
    isStronger,
    joinsGuardedCorals,
    neighboringCorals,
    orthogonalNeighbors,
    polypAt,
    PolypPlacement,
    Reef,
    Shrimp,
    shrimpAt
} from './reef.js'
import { LarvaCubesPerTurn, ScreenPolypsPerLarvaCube, TurnRecord } from './turn.js'
import { compareScores, coralValues, scoreBreakdown, type ScoreBreakdown } from './scoring.js'
import { HydratedReefEncounterPlayerState, ReefEncounterPlayerState } from './playerState.js'

export const LarvaCubesChosenAtSetup = 2

export type ReefEncounterGameState = Type.Static<typeof ReefEncounterGameState>
// Left unevaluated, like the player state, so hidden player fields stay optional when projected.
export const ReefEncounterGameState = Type.Intersect([
    Type.Omit(GameState, ['players', 'machineState']),
    Type.Object({
        players: Type.Array(ReefEncounterPlayerState),
        machineState: Type.Enum(MachineState),
        reefs: Type.Array(Reef),
        shrimps: Type.Array(Shrimp),
        turn: TurnRecord,
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
    declare shrimps: Shrimp[]
    declare turn: TurnRecord
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

    canPlayLarvaCube(playerId: string, color: CoralColor): boolean {
        return (
            this.turn.larvaCubesPlayed < LarvaCubesPerTurn &&
            this.getPlayerState(playerId).getLarvaCubes()[color] > 0
        )
    }

    // Actions 2 and 3: the cube returns to the supply, and polyps of its colour may follow.
    playLarvaCube(playerId: string, color: CoralColor) {
        assert(
            this.canPlayLarvaCube(playerId, color),
            `Player ${playerId} cannot play a ${color} larva cube`
        )
        this.getPlayerState(playerId).spendLarvaCube(color)
        this.larvaCubeSupply[color] += 1
        this.turn.larvaCubesPlayed += 1
        this.turn.placing = { color, screenPolypsLeft: ScreenPolypsPerLarvaCube }
    }

    canPlacePolyp(
        playerId: string,
        boardId: ReefBoardId,
        coords: OffsetCoordinates,
        fromConsumed: boolean
    ): boolean {
        const placing = this.turn.placing
        return (
            placing !== undefined &&
            this.hasPolypToPlace(playerId, fromConsumed) &&
            this.placementBlocker(boardId, coords, placing.color) === undefined
        )
    }

    hasLegalPlacement(playerId: string): boolean {
        const placing = this.turn.placing
        if (
            !placing ||
            ![false, true].some((fromConsumed) => this.hasPolypToPlace(playerId, fromConsumed))
        ) {
            return false
        }
        return this.reefs.some((reef) =>
            ReefBoards[reef.boardId].rock.some(
                (coords) => this.placementBlocker(reef.boardId, coords, placing.color) === undefined
            )
        )
    }

    // Why a polyp of this colour may not go on this square, or undefined when it may.
    placementBlocker(
        boardId: ReefBoardId,
        coords: OffsetCoordinates,
        color: CoralColor
    ): string | undefined {
        const reef = this.reefs.find((candidate) => candidate.boardId === boardId)
        if (!reef) {
            return `Reef board ${boardId} is not in play`
        }
        if (!isRock(boardId, coords)) {
            return 'Polyps grow only on rock'
        }
        const shrimps = this.shrimpsOn(boardId)
        if (shrimpAt(shrimps, coords)) {
            return 'A shrimp is on that square'
        }
        if (joinsGuardedCorals(reef, shrimps, coords, color)) {
            return 'That would join two corals that each have a shrimp'
        }
        const occupant = polypAt(reef, coords)
        if (!occupant) {
            return undefined
        }
        if (occupant.color === color) {
            return 'A coral never attacks its own colour'
        }
        if (!isStronger(this.coralTiles, color, occupant.color)) {
            return `${occupant.color} is not weaker than ${color}`
        }
        if (isProtected(reef, shrimps, coords)) {
            return 'A shrimp protects that polyp'
        }
        if (!neighboringCorals(reef, coords, color).some((coral) => coral.length >= 2)) {
            return 'Only a coral of at least two polyps can attack'
        }
        return undefined
    }

    placePolyp(
        playerId: string,
        boardId: ReefBoardId,
        coords: OffsetCoordinates,
        fromConsumed: boolean
    ): PolypPlacement {
        assert(
            this.canPlacePolyp(playerId, boardId, coords, fromConsumed),
            'That polyp cannot be placed there'
        )
        const placing = this.turn.placing
        assertExists(placing, 'No larva cube is being played')
        const color = placing.color
        const player = this.getPlayerState(playerId)
        if (fromConsumed) {
            player.spendConsumedPolyp(color)
        } else {
            player.spendScreenPolyp(color)
            placing.screenPolypsLeft -= 1
        }

        const reef = this.reefOn(boardId)
        const placement: PolypPlacement = { color }
        const occupant = polypAt(reef, coords)
        if (occupant) {
            reef.polyps = reef.polyps.filter((polyp) => polyp !== occupant)
            player.addConsumedPolyp(occupant.color)
            placement.attacked = occupant.color
        }
        reef.polyps.push({ coords: structuredClone(coords), color })

        const extraGrowth = this.growExtraPolyp(reef, coords, color)
        if (extraGrowth) {
            placement.extraGrowth = extraGrowth
        }
        return placement
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

    private hasPolypToPlace(playerId: string, fromConsumed: boolean): boolean {
        const placing = this.turn.placing
        if (!placing) {
            return false
        }
        const player = this.getPlayerState(playerId)
        return fromConsumed
            ? player.consumedPolyps[placing.color] > 0
            : placing.screenPolypsLeft > 0 && player.hasScreenPolyp(placing.color)
    }

    private reefOn(boardId: ReefBoardId): Reef {
        const reef = this.reefs.find((candidate) => candidate.boardId === boardId)
        assertExists(reef, `Reef board ${boardId} is not in play`)
        return reef
    }

    private shrimpsOn(boardId: ReefBoardId): Shrimp[] {
        return this.shrimps.filter((shrimp) => shrimp.boardId === boardId)
    }

    // A polyp placed next to an empty extra-growth square grows a bonus polyp there at once
    // (rulebook p. 7). It does not count towards the cube's four polyps.
    private growExtraPolyp(
        reef: Reef,
        placedAt: OffsetCoordinates,
        color: CoralColor
    ): OffsetCoordinates | undefined {
        const square = ReefBoards[reef.boardId].extraGrowth
        const shrimps = this.shrimpsOn(reef.boardId)
        const grows =
            orthogonalNeighbors(placedAt).some((neighbor) => sameCoordinates(neighbor, square)) &&
            !polypAt(reef, square) &&
            !shrimpAt(shrimps, square) &&
            this.bonusPolyps[color] > 0 &&
            !joinsGuardedCorals(reef, shrimps, square, color)
        if (!grows) {
            return undefined
        }
        reef.polyps.push({ coords: structuredClone(square), color })
        this.bonusPolyps[color] -= 1
        if (this.polypBag.takeColor(color)) {
            this.bonusPolyps[color] += 1
        }
        return structuredClone(square)
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
