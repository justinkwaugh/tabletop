import { Coordinates } from '../components/gameBoard.js'
import { Cell, CellType, isStallCell, isTruckCell } from '../components/cells.js'
import { Record } from 'typebox'
import { GoodsType } from '../definition/goodsType.js'
import { FreshFishPlayerState } from '../model/playerState.js'
import { HydratedFreshFishGameState } from '../model/gameState.js'

export type Scores = Record<string, ScoringInfo>
export type ScoringInfo = {
    paths: Record<GoodsType, Coordinates[]>
    score: number
}
type Path = Node[]

export class Scorer {
    static MAXIMUM_DISTANCE_BY_PLAYER_COUNT: Record<number, number> = {
        2: 8,
        3: 10,
        4: 12,
        5: 14
    }

    nodes: Node[] = []

    constructor(private readonly gameState: HydratedFreshFishGameState) {
        this.createGraph()
    }

    calculateScores(): Scores {
        const scores: Scores = {}
        const playerStates: FreshFishPlayerState[] = this.gameState.players
        for (const playerState of playerStates) {
            const scoringInfo: ScoringInfo = {
                paths: {
                    [GoodsType.Fish]: [],
                    [GoodsType.Cheese]: [],
                    [GoodsType.IceCream]: [],
                    [GoodsType.Lemonade]: []
                },
                score: 0
            }
            scores[playerState.playerId] = scoringInfo

            let playerScore = playerState.money

            const playerId = playerState.playerId
            const goodsTypes = [
                GoodsType.Fish,
                GoodsType.Cheese,
                GoodsType.IceCream,
                GoodsType.Lemonade
            ]
            const truckNodesByGoodsType: Record<string, Node> = {}
            for (const goodsType of goodsTypes) {
                truckNodesByGoodsType[goodsType] = this.findTruck(goodsType)
            }

            for (const goodsType of goodsTypes) {
                const start = this.findPlayerStall(playerId, goodsType)
                if (start === undefined) {
                    playerScore -= Scorer.MAXIMUM_DISTANCE_BY_PLAYER_COUNT[playerStates.length]
                    continue
                }

                const path = this.findShortestPath(start, truckNodesByGoodsType[goodsType])
                if (path.length === 0) {
                    playerScore -= Scorer.MAXIMUM_DISTANCE_BY_PLAYER_COUNT[playerStates.length]
                    continue
                }

                scores[playerId].paths[goodsType] = path.map((node) => node.coords)
                playerScore -= Math.min(
                    path.length - 2,
                    Scorer.MAXIMUM_DISTANCE_BY_PLAYER_COUNT[playerStates.length]
                )
            }
            scores[playerId].score = playerScore
        }

        return scores
    }

    private findPlayerStall(playerId: string, goodsType: GoodsType): Node | undefined {
        return this.nodes.find(
            (node) =>
                isStallCell(node.cell) &&
                node.cell.playerId === playerId &&
                node.cell.goodsType === goodsType
        )
    }

    private findTruck(goodsType: GoodsType): Node {
        const truckNode = this.nodes.find(
            (node) => isTruckCell(node.cell) && node.cell.goodsType === goodsType
        )
        if (!truckNode) {
            throw new Error('Truck not found')
        }
        return truckNode
    }

    private findShortestPath(start: Node, end: Node): Path {
        const { distances, parents } = Scorer.bfsDistance(start)
        if (distances[end.id] === undefined) {
            return []
        }

        const path: Path = []

        let node = end
        while (node !== start) {
            path.push(node)
            node = parents[node.id]
        }
        path.push(start)
        return path.reverse()
    }

    static bfsDistance(start: Node) {
        const distances: Record<string, number> = {}
        const parents: Record<string, Node> = {}

        const queue = [start]
        queue.push(start)
        distances[start.id] = 0

        while (queue.length > 0) {
            const node = queue.shift()!
            for (const neighbor of node.getNeighbors()) {
                if (distances[neighbor.id] === undefined) {
                    parents[neighbor.id] = node
                    distances[neighbor.id] = distances[node.id] + 1
                    if (neighbor.isTraversable()) {
                        queue.push(neighbor)
                    }
                }
            }
        }

        return { distances, parents }
    }

    private createGraph(_testCoords?: Coordinates): void {
        const nodeIndex = new Map<string, Node>()
        for (const boardCell of this.gameState.board) {
            const node = new Node(boardCell.coords, boardCell.cell)
            if (node.isReachable()) {
                this.nodes.push(node)
                nodeIndex.set(node.id, node)
            }
        }

        for (const node of this.nodes) {
            for (const neighborId of node.neighborIds()) {
                const neighborNode = nodeIndex.get(neighborId)
                if (neighborNode !== undefined) {
                    node.addNeighbor(neighborNode)
                }
            }
        }
    }
}

class Node {
    id: string
    cell: Cell
    private neighbors: Node[] = []

    constructor(
        public readonly coords: Coordinates,
        cell: Cell
    ) {
        this.cell = cell
        this.id = Node.coordsToId(coords)
    }

    addNeighbor(node: Node): void {
        this.neighbors.push(node)
    }

    getNeighbors(): Node[] {
        // Trucks and stalls are never actually adjacent
        return this.neighbors.filter(
            (node) =>
                (this.isTraversable() && node.isTraversable()) ||
                (this.isTerminal() && node.isTraversable()) ||
                (this.isTraversable() && node.isTerminal())
        )
    }

    isTraversable(): boolean {
        return this.cell.type === CellType.Road
    }

    isTerminal(): boolean {
        return this.cell.type === CellType.Truck || this.cell.type === CellType.Stall
    }

    isReachable(): boolean {
        return this.isTraversable() || this.isTerminal()
    }

    isBlockable(): boolean {
        return this.cell.type === CellType.Empty || this.cell.type === CellType.Disk
    }

    neighborIds(): string[] {
        return [
            Node.coordsToId([this.coords[0] + 1, this.coords[1]]),
            Node.coordsToId([this.coords[0] - 1, this.coords[1]]),
            Node.coordsToId([this.coords[0], this.coords[1] + 1]),
            Node.coordsToId([this.coords[0], this.coords[1] - 1])
        ]
    }

    static coordsToId(coords: Coordinates): string {
        return `${coords[0]},${coords[1]}`
    }
}
