import type { RouteBonus, RoutePayment } from './route.js'

export interface RouteRevenueStop extends RoutePayment {
    bonus: number
    companyStation: boolean
}

export type PaidConnectionBonus = {
    from: Readonly<Record<string, number>>
    to: Readonly<Record<string, number>>
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
    return (policy.connectionBonuses ?? []).flatMap(({ from, to }) => {
        const best = (values: Readonly<Record<string, number>>) =>
            stops.reduce<RouteBonus | undefined>((selected, stop) => {
                const amount = values[stop.locationId]
                return amount !== undefined && (!selected || amount > selected.amount)
                    ? { locationId: stop.locationId, amount }
                    : selected
            }, undefined)
        const origin = best(from)
        const destination = best(to)
        return origin && destination
            ? [origin, destination].filter((bonus) => bonus.amount > 0)
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
