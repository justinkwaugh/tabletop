import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import {
    AxialCoordinates,
    coordinatesToNumber,
    HexGrid,
    hexSpiralPattern,
    HexOrientation,
    Hydratable,
    sameCoordinates,
    patternTraverser,
    patternGenerator,
    defaultCoordinateGridFactory,
    hexRingPattern,
    FlatHexDirection,
    HexGridNode,
    breadthFirstTraverser,
    distanceAxial
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

    private internalGrid?: HexGrid

    constructor(data: KaivaiGameBoard) {
        super(data, KaivaiGameBoardValidator)
        this.internalGrid = undefined
    }

    containsCoords(coords: AxialCoordinates): boolean {
        return this.grid.hasAt(coords)
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
        this.cells[coordinatesToNumber(cell.coords)] = cell
    }

    getCellAt(coords: AxialCoordinates) {
        return this.cells[coordinatesToNumber(coords)]
    }

    isWaterCell(coords: AxialCoordinates) {
        const cell = this.getCellAt(coords)
        return !cell || cell.type === CellType.Water
    }

    isInBounds(coords: AxialCoordinates) {
        return this.grid.hasAt(coords)
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
        const ringPattern = hexRingPattern({
            center: coords,
            radius: 1,
            orientation: HexOrientation.FlatTop
        })
        return Array.from(this.grid.traversePattern(ringPattern)).reduce(
            (acc: string[], node: HexGridNode) => {
                const cell = this.getCellAt(node.coords)
                if (isIslandCell(cell) && (!withCellType || cell.type === withCellType)) {
                    if (!acc.includes(cell.islandId)) {
                        acc.push(cell.islandId)
                    }
                }
                return acc
            },
            []
        )
    }

    isNeighborTo(coords: AxialCoordinates, predicate: (coords: AxialCoordinates) => boolean) {
        const ringPattern = hexRingPattern({
            center: coords,
            radius: 1,
            orientation: HexOrientation.FlatTop
        })
        return Array.from(ringPattern()).some(predicate)
    }

    areNeighbors(coords1: AxialCoordinates, coords2: AxialCoordinates): boolean {
        return distanceAxial(coords1, coords2) === 1
    }

    getAllBoatCoordinates(skipBoatId?: string) {
        return Object.values(this.cells).reduce((acc: AxialCoordinates[], cell) => {
            if (isBoatCell(cell) && cell.boat && (!skipBoatId || skipBoatId !== cell.boat.id)) {
                acc.push(cell.coords)
            }
            return acc
        }, [])
    }

    getContiguousWaterHexes(
        coords: AxialCoordinates,
        blockedHex?: AxialCoordinates
    ): AxialCoordinates[] {
        const startNode = this.grid.nodeAt(coords)
        if (!startNode) {
            return []
        }

        const floodTraverser = breadthFirstTraverser({
            start: startNode,
            canTraverse: (_from: HexGridNode, to: HexGridNode) => {
                const nodeCoords = to.coords
                return this.isWaterCell(nodeCoords) && !sameCoordinates(nodeCoords, blockedHex)
            }
        })
        return Array.from(this.grid.traverse(floodTraverser)).map((node) => node.coords)
    }

    isTrappedWaterHex(coords: AxialCoordinates) {
        if (!this.isWaterCell(coords)) {
            return false
        }

        const water = this.getContiguousWaterHexes(coords)

        const checked = new Set<number>()
        let islandId: string | undefined
        return water.every((hex: AxialCoordinates) => {
            return this.getNeighbors(hex).every((neighbor) => {
                const numId = coordinatesToNumber(neighbor)
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

                return !this.grid.hasAt(neighbor) || this.isWaterCell(neighbor)
            })
        })
    }

    getCoordinatesReachableByBoat(
        boatCoords: AxialCoordinates,
        playerState: HydratedKaivaiPlayerState
    ): AxialCoordinates[] {
        const movement = playerState.movement()
        const startNode = this.grid.nodeAt(boatCoords)
        if (!startNode) {
            return []
        }
        const floodTraverser = breadthFirstTraverser({
            start: startNode,
            range: movement,
            canTraverse: (_from: HexGridNode, to: HexGridNode) => {
                const nodeCoords = to.coords
                return this.isWaterCell(nodeCoords)
            }
        })

        return Array.from(this.grid.traverse(floodTraverser)).map((node) => node.coords)
    }

    willTrapBoats(
        blockedHex: AxialCoordinates,
        movedBoat?: { from: AxialCoordinates; to: AxialCoordinates }
    ): boolean {
        // Find a water hex to start from
        const waterHex = Array.from(this.grid).find(
            (node) => this.isWaterCell(node.coords) && !sameCoordinates(node.coords, blockedHex)
        )?.coords

        // This is impossible
        if (!waterHex) {
            return false
        }

        const beforeReachableHexes = this.getContiguousWaterHexes(waterHex)
        const afterReachableHexes = this.getContiguousWaterHexes(waterHex, blockedHex)

        // Same reachability means graph is not split
        if (afterReachableHexes.length === beforeReachableHexes.length - 1) {
            return false
        }

        // Find a hex in the disconnected set
        const afterSet = new Set(afterReachableHexes.map(coordinatesToNumber))
        const disconnectedHex = beforeReachableHexes.find(
            (hex) => !afterSet.has(coordinatesToNumber(hex)) && !sameCoordinates(hex, blockedHex)
        )

        if (!disconnectedHex) {
            return false
        }

        // Get the hexes in the disconnected section of water
        const disconnectedReachableHexes = this.getContiguousWaterHexes(disconnectedHex, blockedHex)

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

    getNeighbors(coords: AxialCoordinates): AxialCoordinates[] {
        const ringPattern = hexRingPattern({
            center: coords,
            radius: 1,
            orientation: HexOrientation.FlatTop
        })
        return Array.from(this.grid.traversePattern(ringPattern)).map((node) => node.coords)
    }

    getNeighborCoords(coords: AxialCoordinates, direction: FlatHexDirection) {
        return this.grid.neighborCoords(coords, direction)
    }

    getDeliverableNeighbors(coords: AxialCoordinates, actingBoatId?: string) {
        return this.getNeighbors(coords)
            .map((hex) => this.getCellAt(hex))
            .filter((cell) => isDeliverableCell(cell, actingBoatId))
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

    isNeighborToCultSiteOfIsland(coords: AxialCoordinates, islandId: string) {
        const island = this.islands[islandId]
        if (!island) {
            return false
        }

        return island.coordList.some((islandCoords) => {
            const cell = this.getCellAt(islandCoords)
            if (!isCultCell(cell)) {
                return false
            }
            return this.isNeighborTo(coords, (hex) => sameCoordinates(hex, islandCoords))
        })
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

    isUncontestableForScoring(playerStates: HydratedKaivaiPlayerState[], islandId: string) {
        const island = this.islands[islandId]
        if (!island) {
            return false
        }

        const initialInfluencePerPlayer: Record<string, number> = {}
        playerStates.forEach((player) => {
            initialInfluencePerPlayer[player.playerId] = this.playerInfluenceOnIsland(
                player.playerId,
                islandId
            )
        })

        const maxValue = Math.max(...Object.values(initialInfluencePerPlayer))

        const initialWinners = Object.entries(initialInfluencePerPlayer)
            .filter(([, islandInfluence]) => islandInfluence === maxValue)
            .map(([playerId]) => playerId)

        if (initialWinners.length > 1) {
            return false
        }

        const initialWinner = initialWinners[0]
        // Add in influence
        playerStates.forEach((player) => {
            if (player.playerId !== initialWinner) {
                initialInfluencePerPlayer[player.playerId] += player.influence
            }
        })

        const newMaxValue = Math.max(...Object.values(initialInfluencePerPlayer))

        if (newMaxValue !== maxValue) {
            return false
        }

        const newWinners = Object.entries(initialInfluencePerPlayer)
            .filter(([, islandInfluence]) => islandInfluence === newMaxValue)
            .map(([playerId]) => playerId)

        if (newWinners.length > 1 || newWinners[0] !== initialWinner) {
            return false
        }

        return true
    }

    findUncontestableIsland(
        playerStates: HydratedKaivaiPlayerState[],
        islandIds: string[]
    ): string | undefined {
        return islandIds.find((islandId) => this.isUncontestableForScoring(playerStates, islandId))
    }

    get grid(): HexGrid {
        if (!this.internalGrid) {
            this.internalGrid = new HexGrid({
                hexDefinition: { orientation: HexOrientation.FlatTop }
            })
            const spiralPattern = hexSpiralPattern({
                radius: 6,
                orientation: HexOrientation.FlatTop
            })
            const spiralTraverser = patternGenerator(spiralPattern, defaultCoordinateGridFactory)
            this.internalGrid.addNodes(spiralTraverser)
        }
        return this.internalGrid
    }
}
