import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    Visibility,
    HydratedTurnManager,
    Point,
    PrngState,
    assertExists,
    samePoint,
    type RectangleDimensions
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import {
    PALACE_COLORS,
    PALACE_TILE_POINTS,
    PalaceColor,
    SIDE_TOWERS,
    TEA_TILES_FOR_FIRST_PURPLE_CLAIM,
    TOWER_TILE_MERCHANTS,
    TOWER_TILE_POINTS,
    Tower,
    WALL_SIDES,
    WallSide,
    boardSize
} from '../components/pieces.js'
import {
    areOrthogonallyAdjacent,
    areTouching,
    citySpaces,
    distinctSpaces,
    isInsideCity,
    orthogonalNeighbors,
    spaceBesideWall,
    wallSideLength
} from './geometry.js'
import { HydratedMedinaPlayerState, MedinaPlayerState } from './playerState.js'

const TWO_PIECE_TURN = 2
export const WELL_BONUS_POINTS = 4

export type PalacePiece = Type.Static<typeof PalacePiece>
export const PalacePiece = Type.Object({
    coords: Point,
    palaceId: Type.String()
})

export type Rooftop = Type.Static<typeof Rooftop>
export const Rooftop = Type.Object({
    coords: Point,
    playerId: Type.Optional(Type.String())
})

export type Palace = Type.Static<typeof Palace>
export const Palace = Type.Object({
    id: Type.String(),
    color: Type.Enum(PalaceColor),
    rooftop: Type.Optional(Rooftop)
})

export type WallSection = Type.Static<typeof WallSection>
export const WallSection = Type.Object({
    side: Type.Enum(WallSide),
    position: Type.Number()
})

export type PalaceTile = Type.Static<typeof PalaceTile>
export const PalaceTile = Type.Object({
    color: Type.Enum(PalaceColor),
    palaceId: Type.Optional(Type.String())
})

export type TowerTile = Type.Static<typeof TowerTile>
export const TowerTile = Type.Object({
    tower: Type.Enum(Tower),
    palaceId: Type.Optional(Type.String())
})

export type TurnProgress = Type.Static<typeof TurnProgress>
export const TurnProgress = Type.Object({
    placementsMade: Type.Number(),
    placementsLeft: Type.Number()
})

export type TileAwards = Type.Static<typeof TileAwards>
export const TileAwards = Type.Object({
    palaceOwnerId: Type.Optional(Type.String()),
    palaceTile: Type.Optional(Type.Enum(PalaceColor)),
    towers: Type.Array(Type.Enum(Tower)),
    merchants: Type.Number()
})

export type PalaceScore = {
    palaceId: string
    color: PalaceColor
    buildings: number
    stables: number
    walls: number
    merchants: number
    well: number
    total: number
}

export type PlayerScore = {
    total: number
    palaces: PalaceScore[]
    palaceTiles: number
    towerTiles: number
}

export type MedinaGameState = Type.Static<typeof MedinaGameState>
export const MedinaGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(MedinaPlayerState),
    machineState: Type.Enum(MachineState),
    hiddenPieces: Type.Boolean(),
    well: Point,
    palaces: Type.Array(Palace),
    buildings: Type.Array(PalacePiece),
    stables: Type.Array(PalacePiece),
    marketStreets: Type.Array(Type.Array(Point)),
    walls: Type.Array(WallSection),
    palaceTiles: Type.Array(PalaceTile),
    towerTiles: Type.Array(TowerTile),
    singlePlacementTurnsLeft: Type.Number(),
    turn: Type.Optional(TurnProgress)
})

export const MedinaGameStateValidator = Compile(MedinaGameState)

export const MedinaProjectedState = Visibility.createProjectionSchema(MedinaGameState)
export type MedinaProjectedState = Type.Static<typeof MedinaProjectedState>
const MedinaProjectedStateValidator = Compile(MedinaProjectedState)

export class HydratedMedinaGameState
    extends HydratableGameState<typeof MedinaProjectedState, HydratedMedinaPlayerState>
    implements MedinaProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedMedinaPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare hiddenPieces: boolean
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare well: Point
    declare palaces: Palace[]
    declare buildings: PalacePiece[]
    declare stables: PalacePiece[]
    declare marketStreets: Point[][]
    declare walls: WallSection[]
    declare palaceTiles: PalaceTile[]
    declare towerTiles: TowerTile[]
    declare singlePlacementTurnsLeft: number
    declare turn?: TurnProgress

    constructor(data: MedinaProjectedState) {
        super(data, MedinaProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedMedinaPlayerState(player))
    }

    size(): RectangleDimensions {
        return boardSize(this.players.length)
    }

    palace(palaceId: string): Palace {
        const palace = this.palaces.find((candidate) => candidate.id === palaceId)
        assertExists(palace, `No palace ${palaceId}`)
        return palace
    }

    palaceBuildings(palaceId: string): Point[] {
        return this.buildings
            .filter((building) => building.palaceId === palaceId)
            .map((building) => building.coords)
    }

    palaceStables(palaceId: string): Point[] {
        return this.stables
            .filter((stable) => stable.palaceId === palaceId)
            .map((stable) => stable.coords)
    }

    palaceSize(palaceId: string): number {
        return this.palaceBuildings(palaceId).length + this.palaceStables(palaceId).length
    }

    palaceAt(space: Point): Palace | undefined {
        const piece = [...this.buildings, ...this.stables].find((candidate) =>
            samePoint(candidate.coords, space)
        )
        return piece && this.palace(piece.palaceId)
    }

    merchants(): Point[] {
        return this.marketStreets.flat()
    }

    private isOccupied(space: Point): boolean {
        return (
            samePoint(space, this.well) ||
            [...this.buildings, ...this.stables].some((piece) => samePoint(piece.coords, space)) ||
            this.merchants().some((merchant) => samePoint(merchant, space))
        )
    }

    private isFree(space: Point): boolean {
        return isInsideCity(space, this.size()) && !this.isOccupied(space)
    }

    private touchesWell(space: Point): boolean {
        return areTouching(space, this.well)
    }

    private touchesAnotherPalace(space: Point, palaceId?: string): boolean {
        return [...this.buildings, ...this.stables].some(
            (piece) => piece.palaceId !== palaceId && areTouching(piece.coords, space)
        )
    }

    private isBuildableFor(space: Point, palaceId?: string): boolean {
        return (
            this.isFree(space) &&
            !this.touchesWell(space) &&
            !this.touchesAnotherPalace(space, palaceId)
        )
    }

    private spacesBesideBuildings(palaceId: string): Point[] {
        return distinctSpaces(
            this.palaceBuildings(palaceId)
                .flatMap(orthogonalNeighbors)
                .filter((space) => this.isBuildableFor(space, palaceId))
        )
    }

    unfinishedPalaces(color: PalaceColor): Palace[] {
        return this.palaces.filter((palace) => palace.color === color && !palace.rooftop)
    }

    buildingSpaces(color: PalaceColor): Point[] {
        const extensions = this.unfinishedPalaces(color).flatMap((palace) =>
            this.spacesBesideBuildings(palace.id)
        )
        if (extensions.length > 0) {
            return extensions
        }
        return citySpaces(this.size()).filter((space) => this.isBuildableFor(space))
    }

    palaceJoinedBy(space: Point, color: PalaceColor): Palace | undefined {
        return this.unfinishedPalaces(color).find((palace) =>
            this.palaceBuildings(palace.id).some((building) =>
                areOrthogonallyAdjacent(building, space)
            )
        )
    }

    stableSpaces(): { coords: Point; palaceId: string }[] {
        return this.palaces.flatMap((palace) =>
            this.spacesBesideBuildings(palace.id).map((coords) => ({
                coords,
                palaceId: palace.id
            }))
        )
    }

    private merchantNeighbors(space: Point): number {
        return this.merchants().filter((merchant) => areOrthogonallyAdjacent(merchant, space))
            .length
    }

    private streetExtensions(): Point[] {
        const street = this.marketStreets.at(-1)
        assertExists(street, 'The market always has a street')
        return distinctSpaces(
            [street[0], street[street.length - 1]]
                .flatMap(orthogonalNeighbors)
                .filter((space) => this.isFree(space) && this.merchantNeighbors(space) === 1)
        )
    }

    merchantSpaces(): Point[] {
        const extensions = this.streetExtensions()
        if (extensions.length > 0) {
            return extensions
        }
        return citySpaces(this.size()).filter(
            (space) => this.isFree(space) && this.merchantNeighbors(space) === 0
        )
    }

    addMerchant(space: Point) {
        const street = this.marketStreets.at(-1)
        assertExists(street, 'The market always has a street')
        if (!this.streetExtensions().some((extension) => samePoint(extension, space))) {
            this.marketStreets.push([space])
        } else if (areOrthogonallyAdjacent(street[street.length - 1], space)) {
            street.push(space)
        } else {
            street.unshift(space)
        }
    }

    hasWall(side: WallSide, position: number): boolean {
        return this.walls.some((wall) => wall.side === side && wall.position === position)
    }

    wallSections(): WallSection[] {
        const size = this.size()
        return WALL_SIDES.flatMap((side) => {
            const length = wallSideLength(side, size)
            return Array.from({ length }, (_, position) => ({ side, position })).filter(
                ({ position }) => {
                    if (this.hasWall(side, position)) {
                        return false
                    }
                    const reachesFirstTower = position === 0 || this.hasWall(side, position - 1)
                    const reachesSecondTower =
                        position === length - 1 || this.hasWall(side, position + 1)
                    return reachesFirstTower !== reachesSecondTower
                }
            )
        })
    }

    towerOfWall(section: WallSection): Tower {
        let position = section.position
        while (position > 0 && this.hasWall(section.side, position - 1)) {
            position -= 1
        }
        const [first, second] = SIDE_TOWERS[section.side]
        return position === 0 ? first : second
    }

    palaceMerchants(palaceId: string): Point[] {
        const members = [...this.palaceBuildings(palaceId), ...this.palaceStables(palaceId)]
        return this.merchants().filter((merchant) =>
            members.some((member) => areOrthogonallyAdjacent(member, merchant))
        )
    }

    wallsBeside(palaceId: string): WallSection[] {
        const size = this.size()
        const members = [...this.palaceBuildings(palaceId), ...this.palaceStables(palaceId)]
        return this.walls.filter((wall) =>
            members.some((member) =>
                samePoint(member, spaceBesideWall(wall.side, wall.position, size))
            )
        )
    }

    canClaimOwn(playerId: string, color: PalaceColor): boolean {
        return (
            this.getPlayerState(playerId).rooftops > 0 &&
            !this.palaces.some(
                (palace) => palace.color === color && palace.rooftop?.playerId === playerId
            )
        )
    }

    claimablePalaces(playerId: string, neutral: boolean): Palace[] {
        const player = this.getPlayerState(playerId)
        if (neutral && player.neutralRooftops === 0) {
            return []
        }
        return this.palaces.filter(
            (palace) => !palace.rooftop && (neutral || this.canClaimOwn(playerId, palace.color))
        )
    }

    canPlaceBuilding(playerId: string): boolean {
        const stock = this.getPlayerState(playerId).buildingStock()
        return PALACE_COLORS.some(
            (color) => stock[color] > 0 && this.buildingSpaces(color).length > 0
        )
    }

    canPlaceRooftop(playerId: string): boolean {
        return (
            this.claimablePalaces(playerId, false).length > 0 ||
            this.claimablePalaces(playerId, true).length > 0
        )
    }

    canPlaceStable(playerId: string): boolean {
        return this.getPlayerState(playerId).stablesLeft() > 0 && this.stableSpaces().length > 0
    }

    canPlaceMerchant(playerId: string): boolean {
        return this.getPlayerState(playerId).merchantsLeft() > 0 && this.merchantSpaces().length > 0
    }

    canPlaceWall(playerId: string): boolean {
        return this.getPlayerState(playerId).wallsLeft() > 0 && this.wallSections().length > 0
    }

    isPlaceable(playerId: string): boolean {
        return (
            this.canPlaceBuilding(playerId) ||
            this.canPlaceRooftop(playerId) ||
            this.canPlaceStable(playerId) ||
            this.canPlaceMerchant(playerId) ||
            this.canPlaceWall(playerId)
        )
    }

    piecesOnBoard(): number {
        return (
            this.buildings.length +
            this.palaces.filter((palace) => palace.rooftop).length +
            this.stables.length +
            this.merchants().length +
            this.walls.length
        )
    }

    anyPlayerCanPlace(): boolean {
        return this.players.some((player) => this.isPlaceable(player.playerId))
    }

    beginTurn(playerId: string) {
        const single = this.singlePlacementTurnsLeft > 0
        if (single) {
            this.singlePlacementTurnsLeft -= 1
        }
        this.turn = { placementsMade: 0, placementsLeft: single ? 1 : 2 }
        this.getPlayerState(playerId).tookTeaBreak = false
    }

    activeTurn(): TurnProgress {
        assertExists(this.turn, 'No turn in progress')
        return this.turn
    }

    canTakeTeaBreak(playerId: string): boolean {
        const turn = this.turn
        return (
            !!turn &&
            this.turnManager.currentTurn()?.playerId === playerId &&
            turn.placementsMade + turn.placementsLeft === TWO_PIECE_TURN &&
            turn.placementsLeft > 0 &&
            this.getPlayerState(playerId).teaTiles > 0
        )
    }

    private applyPalaceTile(palace: Palace): PalaceColor | undefined {
        const tile = this.palaceTiles.find((candidate) => candidate.color === palace.color)
        assertExists(tile, `No palace tile for ${palace.color}`)
        if (tile.palaceId === palace.id) {
            return undefined
        }
        if (tile.palaceId && this.palaceSize(palace.id) <= this.palaceSize(tile.palaceId)) {
            return undefined
        }
        tile.palaceId = palace.id
        return palace.color
    }

    towerTileMerchants(tile: TowerTile): number {
        return tile.palaceId ? 0 : TOWER_TILE_MERCHANTS[tile.tower]
    }

    private applyTowerTile(tower: Tower, palace: Palace): number {
        const tile = this.towerTiles.find((candidate) => candidate.tower === tower)
        assertExists(tile, `No tower tile ${tower}`)
        const merchants = this.towerTileMerchants(tile)
        tile.palaceId = palace.id
        const owner = palace.rooftop?.playerId
        if (owner) {
            const player = this.getPlayerState(owner)
            player.merchants = player.merchantsLeft() + merchants
            return merchants
        }
        return 0
    }

    private applyTowerTiles(towers: Tower[], palace: Palace): number {
        return towers.reduce((sum, tower) => sum + this.applyTowerTile(tower, palace), 0)
    }

    private towersBeside(palaceId: string): Tower[] {
        return [...new Set(this.wallsBeside(palaceId).map((wall) => this.towerOfWall(wall)))]
    }

    claimPalace(palace: Palace, coords: Point, playerId: string | undefined): TileAwards {
        palace.rooftop = playerId ? { coords, playerId } : { coords }
        const towers = this.towersBeside(palace.id)
        return {
            palaceOwnerId: playerId,
            palaceTile: this.applyPalaceTile(palace),
            towers,
            merchants: this.applyTowerTiles(towers, palace)
        }
    }

    extendClaimedPalace(palace: Palace, stable: Point): TileAwards {
        const size = this.size()
        const towers = [
            ...new Set(
                this.walls
                    .filter((wall) =>
                        samePoint(stable, spaceBesideWall(wall.side, wall.position, size))
                    )
                    .map((wall) => this.towerOfWall(wall))
            )
        ]
        return {
            palaceOwnerId: palace.rooftop?.playerId,
            palaceTile: this.applyPalaceTile(palace),
            towers,
            merchants: this.applyTowerTiles(towers, palace)
        }
    }

    wallReachesPalace(section: WallSection): TileAwards | undefined {
        const palace = this.palaceAt(spaceBesideWall(section.side, section.position, this.size()))
        if (!palace?.rooftop) {
            return undefined
        }
        const towers = [this.towerOfWall(section)]
        return {
            palaceOwnerId: palace.rooftop.playerId,
            towers,
            merchants: this.applyTowerTiles(towers, palace)
        }
    }

    teaTilesForNextPurpleClaim(): number {
        const claimed = this.palaces.filter(
            (palace) => palace.color === PalaceColor.Purple && palace.rooftop
        ).length
        return Math.max(0, TEA_TILES_FOR_FIRST_PURPLE_CLAIM - claimed)
    }

    returnBuildingsOnceEveryoneClaimed(color: PalaceColor): boolean {
        const everyoneClaimed = this.players.every((player) =>
            this.palaces.some(
                (palace) => palace.color === color && palace.rooftop?.playerId === player.playerId
            )
        )
        if (!everyoneClaimed) {
            return false
        }
        for (const player of this.players) {
            player.buildingStock()[color] = 0
        }
        return true
    }

    wellBonusSpaces(): Point[] {
        const size = this.size()
        return orthogonalNeighbors(this.well)
            .map((step) => ({
                x: 2 * step.x - this.well.x,
                y: 2 * step.y - this.well.y
            }))
            .filter((space) => isInsideCity(space, size))
    }

    palaceScore(palace: Palace): PalaceScore {
        const buildings = this.palaceBuildings(palace.id)
        const stables = this.palaceStables(palace.id)
        const members = [...buildings, ...stables]
        const walls = this.wallsBeside(palace.id).length
        const merchants = this.palaceMerchants(palace.id).length
        const bonusSpaces = this.wellBonusSpaces()
        const well =
            members.filter((member) => bonusSpaces.some((space) => samePoint(member, space)))
                .length * WELL_BONUS_POINTS
        return {
            palaceId: palace.id,
            color: palace.color,
            buildings: buildings.length,
            stables: stables.length,
            walls,
            merchants,
            well,
            total: members.length + walls + merchants + well
        }
    }

    ownerOf(palaceId: string | undefined): string | undefined {
        return palaceId === undefined ? undefined : this.palace(palaceId).rooftop?.playerId
    }

    scores(): Record<string, PlayerScore> {
        return Object.fromEntries(
            this.players.map((player) => {
                const palaces = this.palaces
                    .filter((palace) => palace.rooftop?.playerId === player.playerId)
                    .map((palace) => this.palaceScore(palace))
                const palaceTiles = this.palaceTiles
                    .filter((tile) => this.ownerOf(tile.palaceId) === player.playerId)
                    .reduce((sum, tile) => sum + PALACE_TILE_POINTS[tile.color], 0)
                const towerTiles = this.towerTiles
                    .filter((tile) => this.ownerOf(tile.palaceId) === player.playerId)
                    .reduce((sum, tile) => sum + TOWER_TILE_POINTS[tile.tower], 0)
                const total =
                    palaces.reduce((sum, palace) => sum + palace.total, 0) +
                    palaceTiles +
                    towerTiles
                return [player.playerId, { total, palaces, palaceTiles, towerTiles }]
            })
        )
    }
}
