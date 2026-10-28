import type { RevenueCenter, RouteBonus, RoutePayment } from './route.js'

export interface RouteRevenueStop extends RoutePayment {
    bonus: number
    /** What earned the stop's bonus, by the ids the title names. */
    bonusSourceIds?: readonly string[]
    companyStation: boolean
}

export type PaidConnectionBonus = {
    from: Readonly<Record<string, number>>
    to: Readonly<Record<string, number>>
    sourceId?: string
    /** The destination counts only as a paid end of the route, such as a port it ends in. */
    destinationAtEnd?: true
}

/**
 * A bonus for running from a paid stop at one of `from` and extending the route, beyond its
 * counted stops, along track of its own to one of `to` (1833NE's interconnections).
 */
export type Interconnection = {
    from: readonly string[]
    to: readonly string[]
    amount: number
    sourceId?: string
}

export type RouteRevenuePolicy = {
    payingStopLimit?: number
    requirePayingStation?: true
    connectionBonuses?: readonly PaidConnectionBonus[]
    interconnections?: readonly Interconnection[]
}

/** Where a route ends, and where its extension reaches, for bonuses that depend on them. */
export type RouteShape = {
    ends: readonly RevenueCenter[]
    extensionLocationId?: string
}

function isEnd(stop: RevenueCenter, shape: RouteShape | undefined): boolean {
    return (
        !shape ||
        shape.ends.some((end) => end.locationId === stop.locationId && end.nodeId === stop.nodeId)
    )
}

/** The best interconnection a route's paid stops and extension earn; one per route. */
export function routeInterconnectionBonus(
    stops: readonly RouteRevenueStop[],
    policy: RouteRevenuePolicy,
    shape: RouteShape | undefined
): RouteBonus | undefined {
    const destination = shape?.extensionLocationId
    if (!destination) return undefined
    return (policy.interconnections ?? []).reduce<RouteBonus | undefined>(
        (best, interconnection) =>
            interconnection.amount > 0 &&
            interconnection.to.includes(destination) &&
            stops.some((stop) => interconnection.from.includes(stop.locationId)) &&
            (!best || interconnection.amount > best.amount)
                ? {
                      locationId: destination,
                      amount: interconnection.amount,
                      ...(interconnection.sourceId ? { sourceIds: [interconnection.sourceId] } : {})
                  }
                : best,
        undefined
    )
}

export function routeConnectionBonuses(
    stops: readonly RouteRevenueStop[],
    policy: RouteRevenuePolicy,
    shape?: RouteShape
): RouteBonus[] {
    return (policy.connectionBonuses ?? []).flatMap(({ from, to, sourceId, destinationAtEnd }) => {
        const best = (values: Readonly<Record<string, number>>, atEnd?: true) =>
            stops.reduce<RouteBonus | undefined>((selected, stop) => {
                if (atEnd && !isEnd(stop, shape)) return selected
                const amount = values[stop.locationId]
                return amount !== undefined && (!selected || amount > selected.amount)
                    ? {
                          locationId: stop.locationId,
                          amount,
                          ...(sourceId ? { sourceIds: [sourceId] } : {})
                      }
                    : selected
            }, undefined)
        const origin = best(from)
        const destination = best(to, destinationAtEnd)
        return origin && destination
            ? [origin, destination].filter((bonus) => bonus.amount > 0)
            : []
    })
}

/** Every bonus a route's paid stops earn: its connection bonuses and its interconnection. */
export function routeStopBonuses(
    stops: readonly RouteRevenueStop[],
    policy: RouteRevenuePolicy,
    shape?: RouteShape
): RouteBonus[] {
    const interconnection = routeInterconnectionBonus(stops, policy, shape)
    return [
        ...routeConnectionBonuses(stops, policy, shape),
        ...(interconnection ? [interconnection] : [])
    ]
}

export function payingRouteStops(
    visits: readonly RouteRevenueStop[],
    policy: RouteRevenuePolicy,
    shape?: RouteShape
): readonly RouteRevenueStop[] {
    const count = policy.payingStopLimit ?? visits.length
    if (visits.length <= count) return visits
    let best: readonly RouteRevenueStop[] = []
    let revenue = -1
    const requiresStation =
        policy.requirePayingStation && visits.some((stop) => stop.companyStation)
    function select(stops: RouteRevenueStop[], start: number): void {
        if (stops.length === count) {
            if (requiresStation && !stops.some((stop) => stop.companyStation)) return
            const value =
                stops.reduce((sum, stop) => sum + stop.amount + stop.bonus, 0) +
                routeStopBonuses(stops, policy, shape).reduce((sum, bonus) => sum + bonus.amount, 0)
            if (value > revenue) {
                best = stops
                revenue = value
            }
            return
        }
        for (let i = start; i <= visits.length - (count - stops.length); i++)
            select([...stops, visits[i]], i + 1)
    }
    select([], 0)
    return best
}
