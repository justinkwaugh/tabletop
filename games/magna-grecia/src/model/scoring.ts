import type { HydratedBoard } from './board.js'
import { marketValue } from './marketRules.js'
import type { Network } from './network.js'
import type { MagnaGreciaPlayerState } from './playerState.js'

export const ORACLE_POINTS = 4

export type ScoreBreakdown = {
    points: number
    markets: number
    oracles: number
    total: number
}

export function scoreBreakdown(
    board: HydratedBoard,
    network: Network,
    player: MagnaGreciaPlayerState
): ScoreBreakdown {
    const markets = board.markets
        .filter((market) => market.playerId === player.playerId)
        .reduce((sum, market) => sum + marketValue(board, network, market), 0)
    const ownCityIds = new Set(
        board.cities.filter((city) => city.playerId === player.playerId).map((city) => city.id)
    )
    const oracles =
        board.oracles.filter(
            (oracle) => oracle.attentionCityId && ownCityIds.has(oracle.attentionCityId)
        ).length * ORACLE_POINTS
    return { points: player.points, markets, oracles, total: player.points + markets + oracles }
}
