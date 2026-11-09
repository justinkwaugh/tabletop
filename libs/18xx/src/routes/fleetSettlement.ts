import { assertExists, distanceAxial } from '@tabletop/common'
import { homeStationId, sameCenter } from '../map/station.js'
import type { RailwayMap } from '../map/map.js'
import type {
    RevenueCenter,
    RouteBonus,
    RoutePayment,
    RouteResult,
    TrainRunningState
} from './route.js'
import type {
    FleetRejection,
    FleetRoute,
    FleetRules,
    FleetSettlement,
    FleetTrainPolicy,
    FreightChainPolicy
} from './fleetRules.js'
import type { RouteVisit } from './routeNetwork.js'
import { stopValue, type RouteRules } from './routeEvaluation.js'

export function fleetPaymentKey(fleet: FleetRules, center: RevenueCenter): string {
    const group =
        fleet.payOnce?.groups?.findIndex((stops) =>
            stops.some((stop) => sameCenter(stop, center))
        ) ?? -1
    return group >= 0 ? `group:${group}` : JSON.stringify([center.locationId, center.nodeId])
}

export function fleetRoot(
    state: TrainRunningState,
    companyId: string,
    fleet: FleetRules
): RevenueCenter | undefined {
    if (fleet.connectivity?.root !== 'home') return undefined
    const home = state.stations.find((station) => station.id === homeStationId(companyId))
    return home?.status === 'placed' ? home.position : undefined
}

export function fleetRouteReason(
    fleet: FleetRules,
    visits: readonly RouteVisit[]
): string | undefined {
    const shape = fleet.routeShape
    if (!shape) return undefined
    if (
        !shape.endKinds.includes(visits[0].node.kind) ||
        !shape.endKinds.includes(visits[visits.length - 1].node.kind)
    )
        return 'A run begins and ends at a large station or off the board.'
    if (visits.filter((visit) => visit.node.kind === 'city').length < (shape.minimumCities ?? 0))
        return 'The run does not visit enough large stations.'
    return undefined
}

export type FreightEnd = { locationId: string; offboard: boolean }
export function freightEnd(
    route: Pick<FleetRoute, 'locationIds'>,
    visit: RouteVisit,
    fleet: FleetRules
): FreightEnd {
    if (visit.node.kind !== 'offboard' || fleet.freightChains?.offboardDistance !== 'adjacent-hex')
        return { locationId: visit.locationId, offboard: false }
    const ids = route.locationIds
    const adjacent =
        ids[0] === visit.locationId
            ? ids.find((id) => id !== visit.locationId)
            : [...ids].reverse().find((id) => id !== visit.locationId)
    assertExists(adjacent, 'An off-board route end has an adjacent hex')
    return { locationId: adjacent, offboard: true }
}

export function freightHexes(map: RailwayMap, a: FreightEnd, b: FreightEnd): number {
    return Math.max(
        0,
        distanceAxial(
            map.location(a.locationId).coordinates,
            map.location(b.locationId).coordinates
        ) -
            1 +
            Number(a.offboard) +
            Number(b.offboard)
    )
}

type Candidate = { route: FleetRoute; index: number; policy: FleetTrainPolicy }
type ChainEnd = { owner: Candidate; visit: RouteVisit }
type Chain = { members: Candidate[]; ends: [ChainEnd, ChainEnd] }

function chain(runs: Candidate[]): Chain | undefined {
    const ends = runs.flatMap((owner) => [
        { owner, visit: owner.route.visits[0] },
        { owner, visit: owner.route.visits[owner.route.visits.length - 1] }
    ])
    const degree = (end: ChainEnd) =>
        ends.filter((other) => sameCenter(end.visit, other.visit)).length
    if (ends.some((end) => degree(end) > 2)) return undefined
    const outer = ends.filter((end) => degree(end) === 1)
    if (outer.length !== 2) return undefined
    const members: Candidate[] = []
    let at = outer[0]
    while (!members.includes(at.owner)) {
        members.push(at.owner)
        const opposite = ends.find((end) => end.owner === at.owner && end !== at)!
        const next = ends.find(
            (end) => end.owner !== at.owner && sameCenter(end.visit, opposite.visit)
        )
        if (!next) break
        at = next
    }
    return members.length === runs.length ? { members, ends: [outer[0], outer[1]] } : undefined
}

function partitions<T>(items: readonly T[]): T[][][] {
    if (!items.length) return [[]]
    const [first, ...rest] = items
    return partitions(rest).flatMap((blocks) => [
        [[first], ...blocks],
        ...blocks.map((_, index) =>
            blocks.map((block, at) => (at === index ? [first, ...block] : block))
        )
    ])
}

function freightGroups(runs: Candidate[]): Chain[][] {
    const required = runs.filter((entry) => entry.policy.freight === 'required')
    const optional = runs.filter((entry) => entry.policy.freight === 'optional')
    const anchors = required.length && optional.length ? optional : [undefined]
    const result: Chain[][] = []
    for (const anchor of anchors) {
        const main = required.length ? chain([...required, ...(anchor ? [anchor] : [])]) : undefined
        if (required.length && (!chain(required) || !main)) continue
        for (const blocks of partitions(optional.filter((entry) => entry !== anchor))) {
            const chains = blocks.map(chain)
            if (chains.some((entry) => !entry)) continue
            result.push([...(main ? [main] : []), ...chains.filter((entry) => entry !== undefined)])
        }
    }
    return result
}

function joined(
    routes: readonly FleetRoute[],
    state: TrainRunningState,
    companyId: string,
    fleet: FleetRules
): string | undefined {
    if (!fleet.connectivity) return undefined
    const root = fleetRoot(state, companyId, fleet)
    const start = root
        ? routes.findIndex((route) => route.visits.some((visit) => sameCenter(visit, root)))
        : 0
    if (start < 0) return 'One run must include the company’s home station.'
    const reached = new Set([start])
    for (let grew = true; grew;) {
        grew = false
        for (const [index, route] of routes.entries()) {
            if (reached.has(index)) continue
            if (
                [...reached].some((other) =>
                    route.visits.some(
                        (visit) =>
                            visit.node.kind === fleet.connectivity?.at &&
                            routes[other].visits.some((v) => sameCenter(v, visit))
                    )
                )
            ) {
                reached.add(index)
                grew = true
            }
        }
    }
    return reached.size === routes.length
        ? undefined
        : 'Every run must meet another at a large station.'
}

function paidChoices(entry: Candidate): RouteVisit[][] {
    const { payingKinds, payingStopLimit: limit } = entry.policy
    const payable = entry.route.visits.filter(
        (visit) => !payingKinds || payingKinds.includes(visit.node.kind)
    )
    if (!limit) return [payable]
    const limited = payable.filter((visit) => limit.kinds.includes(visit.node.kind))
    if (limited.length <= limit.count) return [payable]
    const unlimited = payable.filter((visit) => !limit.kinds.includes(visit.node.kind))
    const choices: RouteVisit[][] = []
    const choose = (start: number, selected: RouteVisit[]) => {
        if (selected.length === limit.count) return void choices.push([...unlimited, ...selected])
        for (let index = start; index <= limited.length - (limit.count - selected.length); index++)
            choose(index + 1, [...selected, limited[index]])
    }
    choose(0, [])
    return choices
}

export function settleFleetRoutes(
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string,
    routes: readonly FleetRoute[]
): FleetSettlement | FleetRejection {
    const fleet = rules.fleet
    assertExists(fleet, 'Fleet settlement requires a declared policy')
    const reason = joined(routes, state, companyId, fleet)
    if (reason) return { reason }
    const candidates = routes.map((route, index): Candidate => ({
        route,
        index,
        policy: fleet.trains?.[route.train.id] ?? {}
    }))
    const freight = candidates.filter((entry) => entry.policy.freight)
    const groupings = freightGroups(freight)
    if (!groupings.length)
        return { reason: 'Freight trains must join end to end without closing a loop.' }
    const others = candidates.filter((entry) => !entry.policy.freight)
    const choices = others.map(paidChoices)
    let best: { routes: RouteResult[]; revenue: number } | undefined
    const pay = (visits: RouteVisit[][], chains: Chain[]) => {
        const payments = candidates.map((): RoutePayment[] => [])
        const bonuses = candidates.map((): RouteBonus[] => [])
        const paid = new Map<string, { index: number; payment: RoutePayment }>()
        const stop = (owner: Candidate, visit: RouteVisit) => {
            const amount = stopValue(state, rules, companyId, visit, visit.node, owner.route.train)
            const payment = { locationId: visit.locationId, nodeId: visit.nodeId, amount }
            const key = fleet.payOnce
                ? fleetPaymentKey(fleet, visit)
                : `${owner.index}:${fleetPaymentKey(fleet, visit)}`
            const previous = paid.get(key)
            if (previous && previous.payment.amount >= amount) return
            if (previous)
                payments[previous.index].splice(
                    payments[previous.index].indexOf(previous.payment),
                    1
                )
            paid.set(key, { index: owner.index, payment })
            payments[owner.index].push(payment)
        }
        others.forEach((entry, index) => visits[index].forEach((visit) => stop(entry, visit)))
        for (const group of chains) {
            const policy: FreightChainPolicy | undefined = fleet.freightChains
            assertExists(policy, 'Freight trains require a chain policy')
            for (const end of group.ends) stop(end.owner, end.visit)
            const [a, b] = group.ends.map(({ owner, visit }) =>
                freightEnd(owner.route, visit, fleet)
            )
            const rate = Math.max(
                policy.bonusPerHex,
                ...(policy.endRates ?? [])
                    .filter((rate) =>
                        group.ends.some((end) =>
                            rate.stops.some((stop) => sameCenter(stop, end.visit))
                        )
                    )
                    .map((rate) => rate.bonusPerHex)
            )
            const amount = freightHexes(rules.map, a, b) * rate
            if (amount)
                bonuses[group.members[0].index].push({
                    locationId: group.ends[0].visit.locationId,
                    amount
                })
        }
        const settled = candidates.map((entry): RouteResult => {
            const { bonuses: _bonuses, ...base } = entry.route.result
            const own = payments[entry.index].filter((payment) => payment.amount > 0)
            const extra = bonuses[entry.index]
            return {
                ...base,
                payments: own,
                ...(extra.length ? { bonuses: extra } : {}),
                revenue: [...own, ...extra].reduce((sum, payment) => sum + payment.amount, 0)
            }
        })
        const revenue = settled.reduce((sum, route) => sum + route.revenue, 0)
        if (!best || revenue > best.revenue) best = { routes: settled, revenue }
    }
    const choose = (position: number, visits: RouteVisit[][]) => {
        if (position === others.length)
            return void groupings.forEach((chains) => pay(visits, chains))
        for (const selected of choices[position]) choose(position + 1, [...visits, selected])
    }
    choose(0, [])
    assertExists(best, 'A legal fleet has a settlement')
    const subsidies = new Map<string, number>()
    for (const { route, policy } of candidates)
        for (const hex of route.locationIds)
            subsidies.set(hex, Math.max(subsidies.get(hex) ?? 0, policy.hexSubsidy ?? 0))
    const subsidy = [...subsidies.values()].reduce((sum, amount) => sum + amount, 0)
    return { routes: best.routes, ...(subsidy ? { subsidy } : {}) }
}
