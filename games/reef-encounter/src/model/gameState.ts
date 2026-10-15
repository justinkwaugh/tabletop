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
    AlgaColor,
    AlgaColors,
    AlgaCounts,
    CoralColor,
    CoralColors,
    CoralCounts,
    countColors,
    containsCounts,
    totalCount
} from '../components/colors.js'
import { CoralTileState, faceUp } from '../components/coralTiles.js'
import {
    type OpenSeaAddition,
    OpenSeaPolypLimit,
    type OpenSeaRefill,
    OpenSeaSpace
} from '../components/openSea.js'
import { HydratedPolypBag, PolypBag } from '../components/polypBag.js'
import { isRock, ReefBoards, type ReefBoardId } from '../components/reefBoards.js'
import {
    type AlgaPlayed,
    coralAt,
    type CoralEaten,
    isGuarded,
    isProtected,
    isStronger,
    joinsGuardedCorals,
    neighboringCorals,
    orthogonalNeighbors,
    polypAt,
    PolypPlacement,
    Reef,
    type ReefSquare,
    Shrimp,
    shrimpAt
} from './reef.js'
import { LarvaCubesPerTurn, newTurnRecord, SupplyPolypsPerLarvaCube, TurnRecord } from './turn.js'
import type { BagSearchNeed, BagSearchResult } from '../actions/searchBag.js'
import type { LarvaCubeExchange } from '../actions/exchangeLarvaCube.js'
import { compareScores, coralValues, scoreBreakdown, type ScoreBreakdown } from './scoring.js'
import {
    HydratedReefEncounterPlayerState,
    ReefEncounterPlayerState,
    ShrimpsPerPlayer
} from './playerState.js'

export const LarvaCubesChosenAtSetup = 2

// What ended the game (rulebook p. 11). The first two give every other player a final turn.
export enum GameEndReason {
    AllTilesLocked = 'allTilesLocked',
    FourShrimpsEaten = 'fourShrimpsEaten',
    NoRockLeft = 'noRockLeft',
    Shortage = 'shortage'
}
// A player may never have more than two of their own shrimps on one board (rulebook p. 9).
export const ShrimpsPerPlayerPerBoard = 2
// A parrotfish eats only a coral of at least five polyps; the first four go back into the bag
// (rulebook p. 11).
export const SmallestEdibleCoral = 5
export const PolypsReturnedWhenEating = 4
// In the final turns, five go back instead (rulebook p. 11).
export const PolypsReturnedWhenEatingInFinalTurns = 5
// The Advanced game returns one more in both cases (rulebook p. 12).
export const ExtraPolypsReturnedWhenEatingInAdvancedGame = 1
export const AlgaCylindersPerColor = 5
// The last uncovered coral tile may be locked only by a player whose parrotfish holds at
// least two polyps, the one fed at setup included (rulebook p. 10).
export const ParrotfishPolypsToLockLastTile = 2

export type ReefEncounterGameState = Type.Static<typeof ReefEncounterGameState>
// Left unevaluated, like the player state, so hidden player fields stay optional when projected.
export const ReefEncounterGameState = Type.Intersect([
    Type.Omit(GameState, ['players', 'machineState']),
    Type.Object({
        players: Type.Array(ReefEncounterPlayerState),
        machineState: Type.Enum(MachineState),
        reefs: Type.Array(Reef),
        shrimps: Type.Array(Shrimp),
        // Players whose first eaten shrimp is on the open sea, in the order they were eaten:
        // each takes the next free shrimp silhouette.
        openSeaShrimps: Type.Array(Type.String()),
        turn: TurnRecord,
        coralTiles: Type.Array(CoralTileState),
        openSea: Type.Array(OpenSeaSpace),
        larvaCubeSupply: CoralCounts,
        bonusPolyps: CoralCounts,
        // Once the bag runs out, the bonus polyps join it for good (rulebook p. 11).
        bonusPolypsInBag: Type.Boolean(),
        // Colours a search of the bag failed to find, until one is returned to it.
        colorsMissingFromBag: Type.Array(Type.Enum(CoralColor)),
        // The Advanced game option (rulebook p. 12): no extra growth, and eating returns more.
        advanced: Type.Boolean(),
        algaSupply: AlgaCounts,
        endReason: Type.Optional(Type.Enum(GameEndReason)),
        endingPlayerId: Type.Optional(Type.String()),
        // The alga cylinder space on the open-sea board holds at most one cylinder.
        openSeaAlga: Type.Optional(Type.Enum(AlgaColor)),
        polypBag: PolypBag
    })
])

export const ReefEncounterGameStateValidator = Compile(ReefEncounterGameState)

// Players feed their parrotfish in turn order at the start of the game, so whether a player's
// parrotfish holds its hidden polyp yet is public.
export function isParrotfishFed(state: ReefEncounterProjectedState, playerId: string): boolean {
    if (state.machineState !== MachineState.ChoosingParrotfishPolyp) {
        return true
    }
    const order = state.turnManager.turnOrder
    return order.indexOf(playerId) < order.indexOf(state.activePlayerIds[0])
}

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
    declare openSeaShrimps: string[]
    declare turn: TurnRecord
    declare coralTiles: CoralTileState[]
    declare openSea: OpenSeaSpace[]
    declare larvaCubeSupply: CoralCounts
    declare bonusPolyps: CoralCounts
    declare bonusPolypsInBag: boolean
    declare colorsMissingFromBag: CoralColor[]
    declare advanced: boolean
    declare algaSupply: AlgaCounts
    declare endReason?: GameEndReason
    declare endingPlayerId?: string
    declare openSeaAlga?: AlgaColor
    declare polypBag: HydratedPolypBag

    constructor(data: ReefEncounterProjectedState) {
        super(data, ReefEncounterProjectedStateValidator)

        this.players = data.players.map((player) => new HydratedReefEncounterPlayerState(player))
        this.polypBag = new HydratedPolypBag(data.polypBag)
    }

    activateTurnPlayer() {
        const playerId =
            this.turnManager.currentTurn()?.playerId ??
            this.turnManager.startNextTurn(this.actionCount)
        this.activePlayerIds = [playerId]
    }

    finishTurn() {
        this.turnManager.endTurn(this.actionCount)
        this.turn = newTurnRecord()
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

    // A shrimp may not end the turn on bare rock (rulebook p. 5).
    canTakeOpenSeaSpace(playerId: string, larvaColor: CoralColor): boolean {
        return (
            this.openSeaSpace(larvaColor).hasLarvaCube &&
            !this.hasShrimpOnBareRock(playerId) &&
            this.turn.cubeToPlay === undefined
        )
    }

    // Action 10: the larva cube and every polyp on its space go into the player's supply.
    takeOpenSeaSpace(playerId: string, larvaColor: CoralColor): CoralColor[] {
        assert(
            this.canTakeOpenSeaSpace(playerId, larvaColor),
            `Player ${playerId} cannot take the ${larvaColor} space`
        )
        const space = this.openSeaSpace(larvaColor)
        const polyps = space.polyps
        const player = this.getPlayerState(playerId)
        player.addLarvaCube(larvaColor)
        player.addKnownSupplyPolyps(polyps)
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
            this.mayPlayCube(color) &&
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
        this.turn.acted = true
        this.turn.cubeToPlay = undefined
        this.turn.placing = { color, supplyPolypsLeft: SupplyPolypsPerLarvaCube }
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

    shrimpProtectedPolyps(boardId: ReefBoardId, color: CoralColor): OffsetCoordinates[] {
        const reef = this.reefOn(boardId)
        const shrimps = this.shrimpsOn(boardId)
        return reef.polyps
            .filter(
                (polyp) =>
                    polyp.color !== color &&
                    !shrimpAt(shrimps, polyp.coords) &&
                    isStronger(this.coralTiles, color, polyp.color) &&
                    isProtected(reef, shrimps, polyp.coords) &&
                    !joinsGuardedCorals(reef, shrimps, polyp.coords, color) &&
                    neighboringCorals(reef, polyp.coords, color).some((coral) => coral.length >= 2)
            )
            .map((polyp) => polyp.coords)
    }

    placementBlocker(
        boardId: ReefBoardId,
        coords: OffsetCoordinates,
        color: CoralColor
    ): string | undefined {
        const reef = this.findReef(boardId)
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
            player.spendSupplyPolyp(color)
            placing.supplyPolypsLeft -= 1
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

        if (this.canGrowExtraPolyp(reef, coords, color)) {
            if (this.bonusPolyps[color] > 0) {
                this.bonusPolyps[color] -= 1
                const square = ReefBoards[boardId].extraGrowth
                reef.polyps.push({ coords: structuredClone(square), color })
                placement.extraGrowth = structuredClone(square)
            } else if (this.bagMayHold(color)) {
                placement.extraGrowthSearchesBag = true
            }
        }
        return placement
    }

    // Action 6. The bought cube can always be played next: the polyp paid for it goes back
    // where action 8 can take it.
    canExchangeConsumedPolyp(playerId: string, color: CoralColor): boolean {
        return (
            this.turn.cubeToPlay === undefined &&
            this.getPlayerState(playerId).consumedPolyps[color] > 0 &&
            this.larvaCubeSupply[color] > 0
        )
    }

    // The consumed polyp goes into the bag, which is shaken (rulebook p. 5).
    exchangeConsumedPolyp(playerId: string, color: CoralColor) {
        assert(
            this.canExchangeConsumedPolyp(playerId, color),
            `Player ${playerId} cannot exchange a consumed ${color} polyp`
        )
        const player = this.getPlayerState(playerId)
        player.spendConsumedPolyp(color)
        this.returnPolyps(color, 1)
        this.larvaCubeSupply[color] -= 1
        player.addLarvaCube(color)
        this.turn.cubeToPlay = color
        this.endAction()
    }

    // Action 8. The polyp comes from the bag, or its bonus space when that holds one
    // (rulebook p. 6).
    canExchangeLarvaCube(playerId: string, color: CoralColor): boolean {
        return (
            this.mayPlayCube(color) &&
            this.getPlayerState(playerId).getLarvaCubes()[color] > 0 &&
            (this.bonusPolyps[color] > 0 || this.bagMayHold(color))
        )
    }

    exchangeLarvaCube(playerId: string, color: CoralColor): LarvaCubeExchange {
        assert(
            this.canExchangeLarvaCube(playerId, color),
            `Player ${playerId} cannot exchange a ${color} larva cube`
        )
        if (this.bonusPolyps[color] === 0) {
            return { searchesBag: true }
        }
        this.bonusPolyps[color] -= 1
        this.completeLarvaCubeExchange(playerId, color)
        return { searchesBag: false }
    }

    searchBag(color: CoralColor, need: BagSearchNeed): BagSearchResult {
        assert(this.bagMayHold(color), `A search of the bag cannot find a ${color} polyp`)
        if (!this.polypBag.takeColor(color)) {
            this.colorsMissingFromBag.push(color)
            return { found: false }
        }
        if (need.kind === 'exchange') {
            this.completeLarvaCubeExchange(need.playerId, color)
        } else {
            this.reefOn(need.boardId).polyps.push({
                coords: structuredClone(ReefBoards[need.boardId].extraGrowth),
                color
            })
        }
        return { found: true }
    }

    // Action 7: a consumed polyp buys an alga cylinder, played at once onto the open-sea space,
    // or onto the coral tile given, which it locks.
    canPlayAlgaCylinder(
        playerId: string,
        consumedColor: CoralColor,
        alga: AlgaColor,
        tileId?: number
    ): boolean {
        return (
            this.turn.cubeToPlay === undefined &&
            this.getPlayerState(playerId).consumedPolyps[consumedColor] > 0 &&
            this.algaSupply[alga] > 0 &&
            (tileId === undefined || this.lockBlocker(playerId, alga, tileId) === undefined)
        )
    }

    hasAlgaCylinderPlay(playerId: string): boolean {
        const consumed = this.getPlayerState(playerId).consumedPolyps
        return (
            this.turn.cubeToPlay === undefined &&
            totalCount(consumed) > 0 &&
            AlgaColors.some((alga) => this.algaSupply[alga] > 0)
        )
    }

    lockBlocker(playerId: string, alga: AlgaColor, tileId: number): string | undefined {
        const player = this.getPlayerState(playerId)
        if (!player.shrimpOnOpenSea) {
            return 'Only a player whose parrotfish has eaten a shrimp may lock coral tiles'
        }
        if (this.turn.tileLocked) {
            return 'Only one coral tile may be locked a turn'
        }
        const tile = this.coralTiles.find((candidate) => candidate.tileId === tileId)
        if (!tile) {
            return `There is no coral tile ${tileId}`
        }
        if (tile.cylinder) {
            return 'That coral tile is already locked'
        }
        if (faceUp(tile).largeAlga !== alga) {
            return `That coral tile's large alga is not ${alga}`
        }
        const uncovered = this.coralTiles.filter((candidate) => !candidate.cylinder)
        if (
            uncovered.length === 1 &&
            totalCount(player.getParrotfishPolyps()) < ParrotfishPolypsToLockLastTile
        ) {
            return `The last coral tile needs at least ${ParrotfishPolypsToLockLastTile} polyps in your parrotfish`
        }
        return undefined
    }

    // Every other uncovered tile showing the cylinder's colour as its large alga flips over
    // (rulebook p. 10). The consumed polyp goes into the bag, as in action 6.
    playAlgaCylinder(
        playerId: string,
        consumedColor: CoralColor,
        alga: AlgaColor,
        tileId?: number
    ): AlgaPlayed {
        assert(
            this.canPlayAlgaCylinder(playerId, consumedColor, alga, tileId),
            `Player ${playerId} cannot play that alga cylinder`
        )
        this.getPlayerState(playerId).spendConsumedPolyp(consumedColor)
        this.returnPolyps(consumedColor, 1)
        this.algaSupply[alga] -= 1

        const played: AlgaPlayed = { flippedTileIds: [] }
        if (tileId === undefined) {
            if (this.openSeaAlga) {
                played.replacedCylinder = this.openSeaAlga
                this.algaSupply[this.openSeaAlga] += 1
            }
            this.openSeaAlga = alga
        } else {
            const locked = this.coralTiles.find((tile) => tile.tileId === tileId)
            assertExists(locked, `There is no coral tile ${tileId}`)
            locked.cylinder = alga
            this.turn.tileLocked = true
        }

        for (const tile of this.coralTiles) {
            if (!tile.cylinder && faceUp(tile).largeAlga === alga) {
                tile.starfishSideUp = !tile.starfishSideUp
                played.flippedTileIds.push(tile.tileId)
            }
        }
        this.endAction()
        if (this.startsFinalTurns(playerId)) {
            played.startsFinalTurns = true
        }
        return played
    }

    canEatCoral(playerId: string, square: ReefSquare): boolean {
        return !this.turn.acted && this.edibleCoral(playerId, square) !== undefined
    }

    hasEdibleCoral(playerId: string): boolean {
        return (
            !this.turn.acted &&
            this.shrimps.some(
                (shrimp) =>
                    shrimp.playerId === playerId && this.edibleCoral(playerId, shrimp) !== undefined
            )
        )
    }

    // The first four polyps go back into the bag, which is shaken, and the rest into the
    // parrotfish with the guarding shrimp (rulebook p. 11).
    eatCoral(playerId: string, square: ReefSquare): CoralEaten {
        assert(this.canEatCoral(playerId, square), `Player ${playerId} cannot eat that coral`)
        const coral = this.edibleCoral(playerId, square)
        assertExists(coral, 'That coral cannot be eaten')
        const reef = this.reefOn(square.boardId)
        const color = coral[0].color
        reef.polyps = reef.polyps.filter((polyp) => !coral.includes(polyp))
        this.shrimps = this.shrimps.filter(
            (shrimp) =>
                shrimp.boardId !== square.boardId ||
                !coral.some((polyp) => sameCoordinates(polyp.coords, shrimp.coords))
        )

        const returnedToBag = Math.min(this.polypsReturnedWhenEating(), coral.length)
        this.returnPolyps(color, returnedToBag)

        const player = this.getPlayerState(playerId)
        const shrimpToOpenSea = !player.shrimpOnOpenSea
        player.eat(color, coral.length - returnedToBag)
        if (shrimpToOpenSea) {
            this.openSeaShrimps.push(playerId)
        }
        this.turn.acted = true
        const eaten: CoralEaten = { color, polyps: coral.length, returnedToBag, shrimpToOpenSea }
        if (this.startsFinalTurns(playerId)) {
            eaten.startsFinalTurns = true
        }
        return eaten
    }

    // Eating a fourth shrimp ends the game and starts the final turns (rulebook p. 11).
    eatingStartsFinalTurns(playerId: string): boolean {
        return (
            this.machineState === MachineState.TakingTurn &&
            this.getPlayerState(playerId).shrimpsEaten() + 1 >= ShrimpsPerPlayer
        )
    }

    // Locking the last coral tile ends the game and starts the final turns (rulebook p. 11).
    lockingStartsFinalTurns(tileId: number): boolean {
        const unlocked = this.coralTiles.filter((tile) => !tile.cylinder)
        return unlocked.length === 1 && unlocked[0].tileId === tileId
    }

    // The final turns run round the table and end with the player before the one who ended it.
    lastFinalTurnPlayerId(): string | undefined {
        if (this.endingPlayerId === undefined) return undefined
        const order = this.turnManager.turnOrder
        const ending = order.indexOf(this.endingPlayerId)
        return order[(ending + order.length - 1) % order.length]
    }

    // A coral of exactly that many may still be eaten, feeding the parrotfish nothing
    // (designer ruling, for the Advanced game).
    polypsReturnedWhenEating(): number {
        const returned =
            this.machineState === MachineState.FinalTurns
                ? PolypsReturnedWhenEatingInFinalTurns
                : PolypsReturnedWhenEating
        return this.advanced ? returned + ExtraPolypsReturnedWhenEatingInAdvancedGame : returned
    }

    canIntroduceShrimp(playerId: string, square: ReefSquare): boolean {
        return (
            this.mayIntroduceShrimp(playerId) && this.shrimpBlocker(playerId, square) === undefined
        )
    }

    hasShrimpIntroduction(playerId: string): boolean {
        return (
            this.mayIntroduceShrimp(playerId) &&
            this.reefs.some((reef) =>
                reef.polyps.some(
                    (polyp) =>
                        this.shrimpBlocker(playerId, {
                            boardId: reef.boardId,
                            coords: polyp.coords
                        }) === undefined
                )
            )
        )
    }

    // Action 4. Like every action but moving shrimps, it finishes the action before it,
    // so no more polyps of the cube being played may follow (rulebook p. 4).
    introduceShrimp(playerId: string, square: ReefSquare) {
        assert(
            this.canIntroduceShrimp(playerId, square),
            `Player ${playerId} cannot introduce a shrimp there`
        )
        this.getPlayerState(playerId).spendShrimp()
        this.shrimps.push({
            playerId,
            boardId: square.boardId,
            coords: structuredClone(square.coords)
        })
        this.turn.shrimpIntroduced = true
        this.endAction()
    }

    // Action 5: to another square, or back to the supply when no square is given.
    canMoveShrimp(playerId: string, from: ReefSquare, to?: ReefSquare): boolean {
        const shrimp = this.ownShrimpAt(playerId, from)
        return (
            shrimp !== undefined &&
            (to === undefined || this.shrimpBlocker(playerId, to, shrimp) === undefined)
        )
    }

    hasShrimpOnBoard(playerId: string): boolean {
        return this.shrimps.some((shrimp) => shrimp.playerId === playerId)
    }

    moveShrimp(playerId: string, from: ReefSquare, to?: ReefSquare) {
        assert(this.canMoveShrimp(playerId, from, to), `Player ${playerId} cannot move that shrimp`)
        const shrimp = this.ownShrimpAt(playerId, from)
        assertExists(shrimp, `Player ${playerId} has no shrimp there`)
        this.turn.acted = true
        if (to) {
            shrimp.boardId = to.boardId
            shrimp.coords = structuredClone(to.coords)
        } else {
            this.shrimps = this.shrimps.filter((candidate) => candidate !== shrimp)
            this.getPlayerState(playerId).returnShrimp()
        }
    }

    hasShrimpOnBareRock(playerId: string): boolean {
        return this.shrimpsOnBareRock(playerId).length > 0
    }

    shrimpsOnBareRock(playerId: string): Shrimp[] {
        return this.shrimps.filter(
            (shrimp) =>
                shrimp.playerId === playerId && !polypAt(this.reefOn(shrimp.boardId), shrimp.coords)
        )
    }

    // A moving shrimp may also go on bare rock; a new one must go onto a coral (rulebook p. 5).
    shrimpBlocker(playerId: string, square: ReefSquare, moving?: Shrimp): string | undefined {
        const reef = this.findReef(square.boardId)
        if (!reef) {
            return `Reef board ${square.boardId} is not in play`
        }
        if (!isRock(square.boardId, square.coords)) {
            return 'Shrimps stay on rock'
        }
        const others = this.shrimpsOn(square.boardId).filter((shrimp) => shrimp !== moving)
        if (shrimpAt(others, square.coords)) {
            return 'A shrimp is already there'
        }
        if (
            moving &&
            moving.boardId === square.boardId &&
            sameCoordinates(moving.coords, square.coords)
        ) {
            return 'The shrimp is already there'
        }
        const own = others.filter((shrimp) => shrimp.playerId === playerId)
        if (own.length >= ShrimpsPerPlayerPerBoard) {
            return `At most ${ShrimpsPerPlayerPerBoard} of your shrimps may be on one board`
        }
        if (!polypAt(reef, square.coords)) {
            return moving ? undefined : 'A new shrimp must go onto a coral'
        }
        if (isGuarded(coralAt(reef, square.coords), others)) {
            return 'That coral already has a shrimp'
        }
        return undefined
    }

    // An end condition the acting player's last action has met, if any (rulebook p. 11).
    gameEndReachedBy(playerId: string): GameEndReason | undefined {
        if (this.coralTiles.every((tile) => tile.cylinder !== undefined)) {
            return GameEndReason.AllTilesLocked
        }
        if (this.getPlayerState(playerId).shrimpsEaten() >= ShrimpsPerPlayer) {
            return GameEndReason.FourShrimpsEaten
        }
        const rockLeft = this.reefs.some((reef) =>
            ReefBoards[reef.boardId].rock.some((coords) => !polypAt(reef, coords))
        )
        return rockLeft ? undefined : GameEndReason.NoRockLeft
    }

    scores(): Record<string, ScoreBreakdown> {
        const values = coralValues(this.coralTiles)
        return Object.fromEntries(
            this.players.map((player) => [
                player.playerId,
                scoreBreakdown(player, values, this.guardedPolyps(player.playerId))
            ])
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

    hasPolypToPlace(playerId: string, fromConsumed: boolean): boolean {
        const placing = this.turn.placing
        if (!placing) {
            return false
        }
        const player = this.getPlayerState(playerId)
        return fromConsumed
            ? player.consumedPolyps[placing.color] > 0
            : placing.supplyPolypsLeft > 0 && player.hasSupplyPolyp(placing.color)
    }

    private startsFinalTurns(playerId: string): boolean {
        const reason =
            this.machineState === MachineState.TakingTurn
                ? this.gameEndReachedBy(playerId)
                : undefined
        return reason === GameEndReason.AllTilesLocked || reason === GameEndReason.FourShrimpsEaten
    }

    // A coral never has two shrimps, so no polyp is counted twice.
    private guardedPolyps(playerId: string): number {
        return this.shrimps
            .filter((shrimp) => shrimp.playerId === playerId)
            .reduce(
                (sum, shrimp) => sum + coralAt(this.reefOn(shrimp.boardId), shrimp.coords).length,
                0
            )
    }

    private edibleCoral(playerId: string, square: ReefSquare) {
        const reef = this.findReef(square.boardId)
        if (!reef) {
            return undefined
        }
        const coral = coralAt(reef, square.coords)
        const ownShrimps = this.shrimpsOn(square.boardId).filter(
            (shrimp) => shrimp.playerId === playerId
        )
        return coral.length >= SmallestEdibleCoral && isGuarded(coral, ownShrimps)
            ? coral
            : undefined
    }

    private mayIntroduceShrimp(playerId: string): boolean {
        return (
            !this.turn.shrimpIntroduced &&
            this.turn.cubeToPlay === undefined &&
            this.getPlayerState(playerId).getShrimpsInSupply() > 0
        )
    }

    private ownShrimpAt(playerId: string, square: ReefSquare): Shrimp | undefined {
        const shrimp = shrimpAt(this.shrimpsOn(square.boardId), square.coords)
        return shrimp?.playerId === playerId ? shrimp : undefined
    }

    reefOn(boardId: ReefBoardId): Reef {
        const reef = this.findReef(boardId)
        assertExists(reef, `Reef board ${boardId} is not in play`)
        return reef
    }

    private findReef(boardId: ReefBoardId): Reef | undefined {
        return this.reefs.find((candidate) => candidate.boardId === boardId)
    }

    private shrimpsOn(boardId: ReefBoardId): Shrimp[] {
        return this.shrimps.filter((shrimp) => shrimp.boardId === boardId)
    }

    // A polyp placed next to an empty extra-growth square grows a bonus polyp there at once
    // (rulebook p. 7), except in the Advanced game (p. 12). It does not count towards the
    // cube's four polyps.
    private canGrowExtraPolyp(reef: Reef, placedAt: OffsetCoordinates, color: CoralColor) {
        const square = ReefBoards[reef.boardId].extraGrowth
        const shrimps = this.shrimpsOn(reef.boardId)
        return (
            !this.advanced &&
            orthogonalNeighbors(placedAt).some((neighbor) => sameCoordinates(neighbor, square)) &&
            !polypAt(reef, square) &&
            !shrimpAt(shrimps, square) &&
            !joinsGuardedCorals(reef, shrimps, square, color)
        )
    }

    private completeLarvaCubeExchange(playerId: string, color: CoralColor) {
        const player = this.getPlayerState(playerId)
        player.spendLarvaCube(color)
        this.larvaCubeSupply[color] += 1
        player.addKnownSupplyPolyps([color])
        this.turn.cubeToPlay = undefined
        this.endAction()
    }

    private bagMayHold(color: CoralColor): boolean {
        return this.polypBag.remaining > 0 && !this.colorsMissingFromBag.includes(color)
    }

    // Every action but moving shrimps finishes the one before it (rulebook p. 4).
    private endAction() {
        this.turn.acted = true
        this.turn.placing = undefined
    }

    // While a bought cube waits to be played, no other cube may be.
    private mayPlayCube(color: CoralColor): boolean {
        return this.turn.cubeToPlay === undefined || this.turn.cubeToPlay === color
    }

    // Polyps returned to the bag first fill an empty bonus space of their colour (user ruling).
    private returnPolyps(color: CoralColor, count: number) {
        let toBag = count
        if (toBag > 0 && !this.bonusPolypsInBag && this.bonusPolyps[color] === 0) {
            this.bonusPolyps[color] = 1
            toBag -= 1
        }
        if (toBag > 0) {
            this.addToBag(Array.from({ length: toBag }, () => color))
        }
    }

    // When the bag runs out, the bonus polyps join it for ordinary play (rulebook p. 11).
    private returnBonusPolypsToBag() {
        this.bonusPolypsInBag = true
        this.addToBag(
            CoralColors.flatMap((color) =>
                Array.from({ length: this.bonusPolyps[color] }, () => color)
            )
        )
        for (const color of CoralColors) {
            this.bonusPolyps[color] = 0
        }
    }

    private addToBag(polyps: CoralColor[]) {
        this.polypBag.addPolyps(polyps)
        this.polypBag.shuffle(this.getProtectedPrng().random)
        this.colorsMissingFromBag = this.colorsMissingFromBag.filter(
            (color) => !polyps.includes(color)
        )
    }
}
