import type { HydratedBoard } from '@tabletop/magna-grecia'
import {
    marketViews,
    oracleViews,
    roadViews,
    type MarketView,
    type OracleView,
    type RoadView
} from './boardView.js'

export type Change<T> = { from: T; to: T }

// What a transition does to the roads, markets and oracles, by their view keys.
export type PieceChanges = {
    arrivingRoads: RoadView[]
    leavingRoads: RoadView[]
    arrivingMarkets: MarketView[]
    leavingMarkets: MarketView[]
    changedMarkets: Change<MarketView>[]
    turnedOracles: Change<OracleView>[]
}

export function pieceChanges(from: HydratedBoard, to: HydratedBoard): PieceChanges {
    const fromNetwork = from.network()
    const toNetwork = to.network()
    const roads = diff(roadViews(from), roadViews(to))
    const markets = diff(marketViews(from, fromNetwork), marketViews(to, toNetwork))
    const oracles = diff(oracleViews(from, fromNetwork), oracleViews(to, toNetwork))
    return {
        arrivingRoads: roads.added,
        leavingRoads: roads.removed,
        arrivingMarkets: markets.added,
        leavingMarkets: markets.removed,
        changedMarkets: markets.kept.filter(
            ({ from, to }) => from.active !== to.active || from.sold !== to.sold
        ),
        turnedOracles: oracles.kept.filter(
            ({ from, to }) =>
                from.attention?.playerId !== to.attention?.playerId ||
                (from.attention?.angle ?? -90) !== (to.attention?.angle ?? -90)
        )
    }
}

export function hasPieceChanges(changes: PieceChanges): boolean {
    return Object.values(changes).some((list) => list.length > 0)
}

function diff<T extends { key: string }>(before: T[], after: T[]) {
    const beforeByKey = new Map(before.map((view) => [view.key, view]))
    const afterKeys = new Set(after.map((view) => view.key))
    return {
        added: after.filter((view) => !beforeByKey.has(view.key)),
        removed: before.filter((view) => !afterKeys.has(view.key)),
        kept: after.flatMap((view) => {
            const previous = beforeByKey.get(view.key)
            return previous ? [{ from: previous, to: view }] : []
        })
    }
}
