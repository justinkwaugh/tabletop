import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import {
    AxialCoordinates,
    axialCoordinatesToNumber,
    flood,
    Hydratable,
    sameCoordinates
} from '@tabletop/common'
import { Island } from './island.js'
import {
    BoatBuildingCell,
    Cell,
    CellType,
    isBoatBuildingCell,
    isBoatCell,
    isCelebratableCell,
    isCultCell,
    isDeliverableCell,
    isIslandCell,
    isPlayerCell,
    MeetingCell
} from '../definition/cells.js'
import {
    defineHex,
    Direction,
    distance,
    Grid,
    Hex,
    Orientation,
    ring,
    spiral
} from 'honeycomb-grid'
import { HydratedKaivaiPlayerState } from '../model/playerState.js'
import { Boat } from './boat.js'
import { HutType } from '../definition/huts.js'

export type KaivaiGameBoard = Static<typeof KaivaiGameBoard>
export const KaivaiGameBoard = Type.Object({
    cells: Type.Record(Type.Number(), Cell),
    islands: Type.Record(Type.String(), Island)
})

export const KaivaiGameBoardValidator = TypeCompiler.Compile(KaivaiGameBoard)

export class HydratedKaivaiGameBoard
    extends Hydratable<typeof KaivaiGameBoard>
    implements KaivaiGameBoard
{
    declare cells: Record<number, Cell>
    declare islands: Record<string, Island>

    private internalGrid?: Grid<Hex>

    constructor(data: KaivaiGameBoard) {
        super(data, KaivaiGameBoardValidator)
        this.internalGrid = undefined
    }

    addCell(cell: Cell) {
        if (cell.type !== CellType.Water) {
            const island = this.islands[cell.islandId]
            if (island) {
                island.coordList.push(cell.coords)
            } else {
                this.islands[cell.islandId] = { id: cell.islandId, coordList: [cell.coords] }
            }
        }
        this.cells[axialCoordinatesToNumber(cell.coords)] = cell
    }

    getCellAt(coords: AxialCoordinates) {
        return this.cells[axialCoordinatesToNumber(coords)]
    }

    isWaterCell(coords: AxialCoordinates) {
        const cell = this.getCellAt(coords)
        return !cell || cell.type === CellType.Water
    }

    isInBounds(coords: AxialCoordinates) {
        return this.grid.hasHex(new Hex(coords))
    }

    isNeighborToCultSite(coords: AxialCoordinates) {
        return this.isNeighborTo(coords, (hex) => {
            return this.getCellAt(hex)?.type === CellType.Cult
        })
    }

    isNeighborToBoat(coords: AxialCoordinates, boatId: string) {
        return this.isNeighborTo(coords, (hex) => {
            const cell = this.getCellAt(hex)
            return cell?.type === CellType.Water && cell?.boat?.id === boatId
        })
    }

    isNeighborToIsland(coords: AxialCoordinates) {
        return this.isNeighborTo(coords, (hex) => {
            const cell = this.getCellAt(hex)
            return cell && cell.type !== CellType.Water
        })
    }

    getNeighboringIslands(coords: AxialCoordinates, withCellType?: CellType) {
        const ringTraverser = ring({ center: coords, radius: 1 })
        return this.grid.traverse(ringTraverser).reduce((acc: string[], hex: Hex) => {
            const cell = this.getCellAt(hex)
            if (isIslandCell(cell) && (!withCellType || cell.type === withCellType)) {
                if (!acc.includes(cell.islandId)) {
                    acc.push(cell.islandId)
                }
            }
            return acc
        }, [])
    }

    isNeighborTo(coords: AxialCoordinates, predicate: (hex: Hex) => boolean) {
        const ringTraverser = ring({ center: coords, radius: 1 })
        return this.grid.traverse(ringTraverser).toArray().some(predicate)
    }

    areNeighbors(coords1: AxialCoordinates, coords2: AxialCoordinates): boolean {
        return distance({ offset: -1, orientation: Orientation.FLAT }, coords1, coords2) === 1
    }

    getAllBoatCoordinates(skipBoatId?: string) {
        return Object.values(this.cells).reduce((acc: AxialCoordinates[], cell) => {
            if (isBoatCell(cell) && cell.boat && (!skipBoatId || skipBoatId !== cell.boat.id)) {
                acc.push(cell.coords)
            }
            return acc
        }, [])
    }

    getContiguousWaterHexes(coords: AxialCoordinates, blockedHex?: AxialCoordinates) {
        const floodTraverser = flood({
            start: coords,
            canTraverse: (hex) => {
                return (
                    this.grid.hasHex(hex) &&
                    this.isWaterCell(hex) &&
                    !sameCoordinates(hex, blockedHex)
                )
            }
        })
        return this.grid.traverse(floodTraverser).toArray()
    }

    isTrappedWaterHex(coords: AxialCoordinates) {
        if (!this.isWaterCell(coords)) {
            return false
        }

        const water = this.getContiguousWaterHexes(coords)

        const checked = new Set<number>()
        let islandId: string | undefined
        return water.every((hex) => {
            return this.getNeighbors(hex).every((neighbor) => {
                const numId = axialCoordinatesToNumber(neighbor)
                if (checked.has(numId)) {
                    return true
                }

                const cell = this.getCellAt(neighbor)
                if (isIslandCell(cell)) {
                    if (!islandId) {
                        islandId = cell.islandId
                    }

                    return islandId === cell.islandId
                }

                return !this.grid.hasHex(neighbor) || this.isWaterCell(neighbor)
            })
        })
    }

    getCoordinatesReachableByBoat(
        boatCoords: AxialCoordinates,
        playerState: HydratedKaivaiPlayerState
    ) {
        const movement = playerState.movement()
        const floodTraverser = flood({
            start: boatCoords,
            range: movement,
            canTraverse: (hex) => {
                return this.grid.hasHex(hex) && this.isWaterCell(hex)
            }
        })

        const reachableHexes = this.grid.traverse(floodTraverser).toArray()
        return reachableHexes
    }

    willTrapBoats(
        blockedHex: AxialCoordinates,
        movedBoat?: { from: AxialCoordinates; to: AxialCoordinates }
    ): boolean {
        // Find a water hex to start from
        const waterHex = this.grid
            .toArray()
            .find((hex) => this.isWaterCell(hex) && !sameCoordinates(hex, blockedHex))
        console.log('Checking if hex ', blockedHex, 'will trap boats, checking from ', waterHex)
        // This is impossible
        if (!waterHex) {
            return false
        }

        const beforeReachableHexes = this.getContiguousWaterHexes(waterHex)
        const afterReachableHexes = this.getContiguousWaterHexes(waterHex, blockedHex)

        // Same reachability means graph is not split
        if (afterReachableHexes.length === beforeReachableHexes.length - 1) {
            console.log('Same reachability... ok')
            return false
        }

        // Find a hex in the disconnected set
        const afterSet = new Set(afterReachableHexes.map(axialCoordinatesToNumber))
        const disconnectedHex = beforeReachableHexes.find(
            (hex) =>
                !afterSet.has(axialCoordinatesToNumber(hex)) && !sameCoordinates(hex, blockedHex)
        )
        console.log(
            'Discontinuity found, before: ',
            beforeReachableHexes.length,
            'after: ',
            afterReachableHexes.length
        )
        if (!disconnectedHex) {
            return false
        }

        console.log('Disconnected hex: ', disconnectedHex)
        // Get the hexes in the disconnected section of water
        const disconnectedReachableHexes = this.getContiguousWaterHexes(disconnectedHex, blockedHex)
        console.log(
            'Section sizes: ',
            disconnectedReachableHexes.length,
            afterReachableHexes.length
        )
        // Check the smaller section for boats
        const smallerSection =
            disconnectedReachableHexes.length < afterReachableHexes.length
                ? disconnectedReachableHexes
                : afterReachableHexes
        return smallerSection.some((hex) => {
            if (movedBoat && !sameCoordinates(movedBoat.from, movedBoat.to)) {
                if (sameCoordinates(hex, movedBoat.from)) {
                    return false
                } else if (sameCoordinates(hex, movedBoat.to)) {
                    return true
                }
            }

            return this.getBoatAt(hex)
        })
    }

    getNeighbors(coords: AxialCoordinates) {
        const ringTraverser = ring({ center: coords, radius: 1 })
        return this.grid.traverse(ringTraverser).toArray()
    }

    getNeighborForDirection(coords: AxialCoordinates, direction: Direction) {
        return this.grid.neighborOf(coords, direction)
    }

    getDeliverableNeighbors(coords: AxialCoordinates) {
        return this.getNeighbors(coords)
            .map((hex) => this.getCellAt(hex))
            .filter((cell) => isDeliverableCell(cell))
    }

    getCelebratableCells(): (MeetingCell | BoatBuildingCell)[] {
        return Object.values(this.cells).filter(isCelebratableCell)
    }

    hasOtherBoat(coords: AxialCoordinates, boatId: string) {
        const cell = this.getCellAt(coords)
        return cell && cell.type === CellType.Water && cell.boat && cell.boat.id !== boatId
    }

    getBoatAt(coords: AxialCoordinates) {
        const cell = this.getCellAt(coords)
        return isBoatCell(cell) ? cell.boat : undefined
    }

    removeBoatFrom(coords: AxialCoordinates): Boat | undefined {
        const cell = this.getCellAt(coords)
        if (isBoatCell(cell)) {
            const boat = cell.boat
            cell.boat = undefined
            return boat
        }
        return undefined
    }

    addBoatTo(coords: AxialCoordinates, boat: Boat) {
        const cell = this.getCellAt(coords)
        if (isBoatCell(cell)) {
            cell.boat = boat
        } else {
            this.addCell({
                type: CellType.Water,
                coords,
                boat
            })
        }
    }

    numHutsOnIsland(islandId: string, playerId: string, hutType?: HutType) {
        const island = this.islands[islandId]
        if (!island) {
            return 0
        }

        return island.coordList.reduce((acc, coords) => {
            const cell = this.getCellAt(coords)
            if (
                isPlayerCell(cell) &&
                (!hutType || cell.hutType === hutType) &&
                cell.owner === playerId
            ) {
                acc++
            }
            return acc
        }, 0)
    }

    numCultSitesOnIsland(islandId: string) {
        const island = this.islands[islandId]
        if (!island) {
            return 0
        }

        return island.coordList.reduce((acc, coords) => {
            const cell = this.getCellAt(coords)
            if (isCultCell(cell)) {
                acc++
            }
            return acc
        }, 0)
    }

    numBoatsAtIslandCultSites(islandId: string, playerId: string) {
        const island = this.islands[islandId]
        if (!island) {
            return 0
        }

        const seenBoats = new Set<string>()

        return island.coordList.reduce((acc, coords) => {
            const cell = this.getCellAt(coords)
            if (!isCultCell(cell)) {
                return acc
            }

            for (const neighbor of this.getNeighbors(coords)) {
                const neighborCell = this.getCellAt(neighbor)
                if (
                    isBoatCell(neighborCell) &&
                    !isBoatBuildingCell(cell) &&
                    neighborCell.boat &&
                    neighborCell.boat.owner === playerId &&
                    !seenBoats.has(neighborCell.boat.id)
                ) {
                    seenBoats.add(neighborCell.boat.id)
                    acc++
                }
            }

            return acc
        }, 0)
    }

    numHutsForPlayer(playerId: string) {
        return Object.values(this.cells).reduce((acc, cell) => {
            if (isPlayerCell(cell) && cell.owner === playerId) {
                acc++
            }
            return acc
        }, 0)
    }

    playerInfluenceOnIsland(playerId: string, islandId: string) {
        const island = this.islands[islandId]
        if (!island) {
            return 0
        }

        const huts = this.numHutsOnIsland(islandId, playerId)
        const boats = this.numBoatsAtIslandCultSites(islandId, playerId)

        return huts + boats
    }

    get grid(): Grid<Hex> {
        if (!this.internalGrid) {
            const DefaultHex = defineHex({ orientation: Orientation.FLAT })
            const spiralTraverser = spiral({ radius: 6 })
            this.internalGrid = new Grid(DefaultHex, spiralTraverser)
        }
        return this.internalGrid
    }
}
