import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { AxialCoordinates, axialCoordinatesToNumber, flood, Hydratable } from '@tabletop/common'
import { Island } from './island.js'
import { Cell, CellType, isPlayerCell } from '../definition/cells.js'
import { defineHex, distance, Grid, Hex, Orientation, ring, spiral } from 'honeycomb-grid'
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
            if (
                cell &&
                cell.type &&
                cell.type !== CellType.Water &&
                (!withCellType || cell.type === withCellType)
            ) {
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

    areNeighbors(coords1: AxialCoordinates, coords2: AxialCoordinates) {
        return distance({ offset: -1, orientation: Orientation.FLAT }, coords1, coords2)
    }

    getBoatCoordinates(playerId?: string) {
        return Object.values(this.cells).reduce((acc: AxialCoordinates[], cell) => {
            if (
                (cell.type === CellType.Water || cell.type === CellType.BoatBuilding) &&
                cell.boat &&
                (!playerId || cell.boat.owner === playerId)
            ) {
                acc.push(cell.coords)
            }
            return acc
        }, [])
    }

    willSurroundAnyBoats(hutCoords: AxialCoordinates) {
        const allBoatCoords = this.getBoatCoordinates()
        for (const boatCoords of allBoatCoords) {
            if (this.willSurroundBoat(boatCoords, hutCoords)) {
                return true
            }
        }
        return false
    }

    willSurroundBoat(boatCoords: AxialCoordinates, hutCoords: AxialCoordinates) {
        const ringTraverser = ring({ center: boatCoords, radius: 1 })
        const neighboringWaterHexes = this.grid
            .traverse(ringTraverser)
            .toArray()
            .filter((hex) => {
                const cell = this.getCellAt(hex)
                return !cell || cell.type === CellType.Water // we don't store all water cells
            })

        return (
            neighboringWaterHexes.length === 1 &&
            neighboringWaterHexes[0].q === hutCoords.q &&
            neighboringWaterHexes[0].r === hutCoords.r
        )
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
                const cell = this.getCellAt(hex)
                return !cell || cell.type === CellType.Water
            }
        })

        const reachableHexes = this.grid.traverse(floodTraverser).toArray()
        return reachableHexes
    }

    getNeighbors(coords: AxialCoordinates) {
        const ringTraverser = ring({ center: coords, radius: 1 })
        return this.grid.traverse(ringTraverser).toArray()
    }

    hasOtherBoat(coords: AxialCoordinates, boatId: string) {
        const cell = this.getCellAt(coords)
        return cell && cell.type === CellType.Water && cell.boat && cell.boat.id !== boatId
    }

    getBoatAt(coords: AxialCoordinates) {
        const cell = this.getCellAt(coords)
        return cell?.type === CellType.Water || cell?.type === CellType.BoatBuilding
            ? cell.boat
            : undefined
    }

    removeBoatFrom(coords: AxialCoordinates): Boat | undefined {
        const cell = this.getCellAt(coords)
        if (cell && (cell.type === CellType.Water || cell.type === CellType.BoatBuilding)) {
            const boat = cell.boat
            cell.boat = undefined
            return boat
        }
        return undefined
    }

    addBoatTo(coords: AxialCoordinates, boat: Boat) {
        const cell = this.getCellAt(coords)
        if (cell && (cell.type === CellType.Water || cell.type === CellType.BoatBuilding)) {
            cell.boat = boat
        } else {
            this.addCell({
                type: CellType.Water,
                coords,
                boat
            })
        }
    }

    numHutsOnIsland(islandId: string, hutType: HutType, playerId: string) {
        const island = this.islands[islandId]
        if (!island) {
            return 0
        }

        return island.coordList.reduce((acc, coords) => {
            const cell = this.getCellAt(coords)
            if (isPlayerCell(cell) && cell.hutType === hutType && cell.owner === playerId) {
                acc++
            }
            return acc
        }, 0)
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
