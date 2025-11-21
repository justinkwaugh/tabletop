import { Record } from 'typebox'
import { isStallCell, isTraversable, isTruckCell } from '../components/cells.js'
import { GoodsType } from '../definition/goodsType.js'
import { FreshFishPlayerState } from '../model/playerState.js'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import {
    areOrthogonal,
    OffsetCoordinates,
    offsetToOffsetTuple,
    OffsetTupleCoordinates,
    RectilinearGridNode,
    sameCoordinates,
    shortestPathPathfinder
} from '@tabletop/common'
import { FreshFishGraph } from './freshFishGraph.js'
import { HydratedGameBoard } from 'src/components/gameBoard.js'

export type Scores = Record<string, ScoringInfo>
export type ScoringInfo = {
    paths: Record<GoodsType, OffsetTupleCoordinates[]>
    score: number
}
type Path = OffsetCoordinates[]

export class Scorer {
    static MAXIMUM_DISTANCE_BY_PLAYER_COUNT: Record<number, number> = {
        2: 8,
        3: 10,
        4: 12,
        5: 14
    }

    private board: HydratedGameBoard
    private graph: FreshFishGraph

    nodes: Node[] = []

    constructor(private readonly gameState: HydratedFreshFishGameState) {
        this.board = gameState.board
        this.graph = gameState.board.graph
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
            const truckCoordsByGoodsType: Record<string, OffsetCoordinates> = {}
            for (const goodsType of goodsTypes) {
                truckCoordsByGoodsType[goodsType] = this.findTruck(goodsType)
            }

            for (const goodsType of goodsTypes) {
                const start = this.findPlayerStall(playerId, goodsType)
                if (start === undefined) {
                    playerScore -= Scorer.MAXIMUM_DISTANCE_BY_PLAYER_COUNT[playerStates.length]
                    continue
                }

                const path = this.findShortestPath(start, truckCoordsByGoodsType[goodsType])
                if (path.length === 0) {
                    playerScore -= Scorer.MAXIMUM_DISTANCE_BY_PLAYER_COUNT[playerStates.length]
                    continue
                }

                scores[playerId].paths[goodsType] = path.map((coords) =>
                    offsetToOffsetTuple(coords)
                )
                playerScore -= Math.min(
                    path.length - 2,
                    Scorer.MAXIMUM_DISTANCE_BY_PLAYER_COUNT[playerStates.length]
                )
            }
            scores[playerId].score = playerScore
        }

        return scores
    }

    private findPlayerStall(playerId: string, goodsType: GoodsType): OffsetCoordinates | undefined {
        return Iterator.from(this.graph).find((node) => {
            const cell = this.board.cellAt(node.coords)
            return (
                cell &&
                isStallCell(cell) &&
                cell.playerId === playerId &&
                cell.goodsType === goodsType
            )
        })?.coords
    }

    private findTruck(goodsType: GoodsType): OffsetCoordinates {
        const truckCoords = Iterator.from(this.graph).find((node) => {
            const cell = this.board.cellAt(node.coords)
            return cell && isTruckCell(cell) && cell.goodsType === goodsType
        })?.coords

        if (!truckCoords) {
            throw new Error('Truck not found')
        }

        return truckCoords
    }

    private findShortestPath(start: OffsetCoordinates, end: OffsetCoordinates): Path {
        const startNode = this.graph.nodeAt(start)
        const endNode = this.graph.nodeAt(end)
        if (!startNode || !endNode) {
            return []
        }

        const pathfinder = shortestPathPathfinder({
            start: startNode,
            end: endNode,
            canTraverse: this.canTraverse.bind(this, endNode.coords)
        })
        return (this.graph.findFirstPath(pathfinder) ?? []).map((node) => node.coords)
    }

    private canTraverse(
        end: OffsetCoordinates,
        from: RectilinearGridNode,
        to: RectilinearGridNode
    ) {
        if (!areOrthogonal(from.coords, to.coords)) {
            return false
        }
        const fromCell = this.board.cellAt(from.coords)
        const toCell = this.board.cellAt(to.coords)
        if (!fromCell || !toCell) {
            return false
        }
        const traversable =
            isTraversable(toCell) || (sameCoordinates(to.coords, end) && isTraversable(fromCell))
        return traversable
    }
}
