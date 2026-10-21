import type { RouteBonus, RoutePayment } from './route.js'

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
}

/**
 * A stop worth more by the best value among the route's other paying stops, such as a location
 * equal to the largest revenue on its route. ``ignoredLocationIds`` never count as that best value.
 */
export type BestStopBonus = {
    locationIds: readonly string[]
    ignoredLocationIds?: readonly string[]
    sourceId?: string
}

export type RouteRevenuePolicy = {
    payingStopLimit?: number
    requirePayingStation?: true
    connectionBonuses?: readonly PaidConnectionBonus[]
}

export function routeConnectionBonuses(
    stops: readonly RouteRevenueStop[],
    policy: RouteRevenuePolicy
): RouteBonus[] {
    return (policy.connectionBonuses ?? []).flatMap(({ from, to, sourceId }) => {
        const best = (values: Readonly<Record<string, number>>) =>
            stops.reduce<RouteBonus | undefined>((selected, stop) => {
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
        const destination = best(to)
        return origin && destination
            ? [origin, destination].filter((bonus) => bonus.amount > 0)
            : []
    })
}

export function routeBestStopBonuses(
    stops: readonly RouteRevenueStop[],
    bonuses: readonly BestStopBonus[]
): RouteBonus[] {
    return bonuses.flatMap(({ locationIds, ignoredLocationIds = [], sourceId }) => {
        const stop = stops.find((stop) => locationIds.includes(stop.locationId))
        if (!stop) return []
        const amount = Math.max(
            0,
            ...stops
                .filter(
                    (other) =>
                        !locationIds.includes(other.locationId) &&
                        !ignoredLocationIds.includes(other.locationId)
                )
                .map((other) => other.amount)
        )
        return amount > 0
            ? [
                  {
                      locationId: stop.locationId,
                      amount,
                      ...(sourceId ? { sourceIds: [sourceId] } : {})
                  }
              ]
            : []
    })
}

export function payingRouteStops(
    visits: readonly RouteRevenueStop[],
    policy: RouteRevenuePolicy
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
                routeConnectionBonuses(stops, policy).reduce((sum, bonus) => sum + bonus.amount, 0)
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
