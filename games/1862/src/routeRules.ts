import {
    homeStationId,
    revenueStagesByPhase,
    stopValue,
    type FleetRoute,
    type FleetRules,
    type RouteBonus,
    type RoutePayment,
    type RouteResult,
    type RouteRules,
    type RouteVisit,
    type TrainDefinition,
    type TrainRunningState
} from '@tabletop/18xx'
import { distanceAxial } from '@tabletop/common'
import { LondonSpacesLocationId, Map1862, OffboardAreas, offboardArea } from './map.js'
import { permitsOf } from './operating.js'
import { TileSet1862 } from './tiles.js'
import { Phases1862, TrainDepot1862, paidStops, permanentFreight, trainFace } from './trains.js'

// Off-boards pay the first figure in phases A–B, the middle in C–D, the last from E (§9).
export const revenueStages = revenueStagesByPhase(Phases1862, 'A-B', [
    ['C-D', 'C'],
    ['E-H', 'E']
])

/** Freight earns £20 for each hex between its ends as the crow flies, £30 from a port (§7.8.1). */
export const FreightBonus = 20
export const PortFreightBonus = 30
/** Local trains earn £10 for each hex they visit, to the treasury (§7.8.2). */
export const LocalSubsidy = 10

const kindOf = (train: TrainDefinition) => trainFace(train.id).kind

/** A stop's identity for paying once: an off-board area across its hexes, else its node. */
export function stopKey(locationId: string, nodeId: string): string {
    return offboardArea(locationId, nodeId) ?? `${locationId}:${nodeId}`
}

function areaKind(visit: RouteVisit): 'red' | 'port' | undefined {
    const area = offboardArea(visit.locationId, visit.nodeId)
    return area ? OffboardAreas[area].kind : undefined
}

function hasLondonStation(state: TrainRunningState, companyId: string): boolean {
    return state.stations.some(
        (station) =>
            station.companyId === companyId &&
            station.status === 'placed' &&
            station.position.locationId === LondonSpacesLocationId
    )
}

/** The city holding the company's home station, which one run must include (§7.8). */
function homeCity(state: TrainRunningState, companyId: string): string | undefined {
    const home = state.stations.find((station) => station.id === homeStationId(companyId))
    return home?.status === 'placed'
        ? `${home.position.locationId}:${home.position.nodeId}`
        : undefined
}

const visitKey = (visit: RouteVisit) => `${visit.locationId}:${visit.nodeId}`

/** Stops a train is paid for: large stations and off-boards, and small stations for Locals. */
function payable(train: TrainDefinition, visit: RouteVisit): boolean {
    if (visit.node.kind === 'town') return kindOf(train) === 'local'
    return visit.node.kind === 'city' || visit.node.kind === 'offboard'
}

type Candidate = { route: FleetRoute; index: number }

/** Each choice of the large stops an N/M train leaves unpaid, or one choice of none. */
function skipChoices(route: FleetRoute): string[][] {
    const paid = paidStops(route.train.id)
    if (paid === undefined) return [[]]
    const large = route.visits.filter((visit) => visit.node.kind !== 'town').map(visitKey)
    const skip = large.length - paid
    if (skip <= 0) return [[]]
    const choices: string[][] = []
    const choose = (start: number, picked: string[]) => {
        if (picked.length === skip) return void choices.push(picked)
        for (let index = start; index < large.length; index++)
            choose(index + 1, [...picked, large[index]])
    }
    choose(0, [])
    return choices
}

/** The hex to measure a freight end from: an off-board end from the hex the route left. */
function endHex(
    route: Pick<FleetRoute, 'locationIds'>,
    visit: RouteVisit
): { locationId: string; offboard: boolean } {
    if (visit.node.kind !== 'offboard') return { locationId: visit.locationId, offboard: false }
    const ids = route.locationIds
    const first = ids[0] === visit.locationId
    const neighbour = first
        ? ids.find((id) => id !== visit.locationId)
        : [...ids].reverse().find((id) => id !== visit.locationId)
    return { locationId: neighbour ?? visit.locationId, offboard: true }
}

/** Hexes between two freight ends as the crow flies, barriers aside (§7.8.1). */
export function crowHexes(
    a: { locationId: string; offboard: boolean },
    b: { locationId: string; offboard: boolean }
): number {
    const distance = distanceAxial(
        Map1862.location(a.locationId).coordinates,
        Map1862.location(b.locationId).coordinates
    )
    // Ends in one hex have none between them, less than adjacent ones; an off-board end adds the
    // hex it lies beyond.
    return Math.max(0, distance - 1 + (a.offboard ? 1 : 0) + (b.offboard ? 1 : 0))
}

type FreightSet = {
    members: Candidate[]
    ends: [RouteVisit, RouteVisit]
    endHexes: ReturnType<typeof endHex>[]
}

/**
 * Joins freight runs end to end into the runs scored as one: every non-permanent freight train
 * in one chain, with a permanent one if the company has any; permanent ones otherwise alone
 * (§7.8.1). Returns the reason when they do not join so.
 */
function freightSets(freight: Candidate[]): FreightSet[][] | string {
    const ends = (candidate: Candidate) => {
        const visits = candidate.route.visits
        return [visits[0], visits[visits.length - 1]] as const
    }
    const temporary = freight.filter((entry) => !permanentFreight(entry.route.train.id))
    const permanent = freight.filter((entry) => permanentFreight(entry.route.train.id))
    const sets: FreightSet[] = []
    let rest = permanent
    if (temporary.length) {
        // Order the temporary runs into one chain, then extend it by a permanent run if any.
        const chain = orderChain(temporary, ends)
        if (!chain) return 'Freight trains must join end to end.'
        let members = chain.members
        let [start, finish] = chain.ends
        let anchor: Candidate | undefined
        if (permanent.length) {
            anchor = permanent.find((entry) => {
                const [a, b] = ends(entry)
                return [a, b].some(
                    (end) => visitKey(end) === visitKey(start) || visitKey(end) === visitKey(finish)
                )
            })
            if (!anchor) return 'Freight trains must join a permanent freight train.'
            const [a, b] = ends(anchor)
            if (visitKey(a) === visitKey(start)) {
                members = [anchor, ...members]
                start = b
            } else if (visitKey(b) === visitKey(start)) {
                members = [anchor, ...members]
                start = a
            } else if (visitKey(a) === visitKey(finish)) {
                members = [...members, anchor]
                finish = b
            } else {
                members = [...members, anchor]
                finish = a
            }
        }
        if (visitKey(start) === visitKey(finish)) return 'A freight chain may not close a loop.'
        sets.push(withHexes({ members, ends: [start, finish] }))
        rest = permanent.filter((entry) => entry !== anchor)
    }
    // Permanent runs may run separately or join end to end: each grouping is an alternative.
    return partitions(rest).flatMap((blocks) => {
        const grouped: FreightSet[] = []
        for (const block of blocks) {
            const chain = block.length === 1 ? undefined : orderChain(block, ends)
            if (block.length > 1 && (!chain || visitKey(chain.ends[0]) === visitKey(chain.ends[1])))
                return []
            grouped.push(chain ? withHexes(chain) : single(block[0]))
        }
        return [[...sets, ...grouped]]
    })

    function single(entry: Candidate): FreightSet {
        const [a, b] = ends(entry)
        return withHexes({ members: [entry], ends: [a, b] })
    }
    function withHexes(set: { members: Candidate[]; ends: [RouteVisit, RouteVisit] }): FreightSet {
        const routeAt = (visit: RouteVisit) =>
            set.members.find((entry) =>
                ends(entry).some((end) => visitKey(end) === visitKey(visit))
            )?.route
        return {
            ...set,
            endHexes: set.ends.map((visit) => {
                const route = routeAt(visit)
                return route
                    ? endHex(route, visit)
                    : { locationId: visit.locationId, offboard: false }
            })
        }
    }
}

/** Every way of splitting runs into groups. */
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

/** Orders runs into one path joined at shared ends, or none if they do not form one. */
function orderChain(
    runs: Candidate[],
    ends: (candidate: Candidate) => readonly [RouteVisit, RouteVisit]
): { members: Candidate[]; ends: [RouteVisit, RouteVisit] } | undefined {
    const [first, ...rest] = runs
    let members = [first]
    let [start, finish] = ends(first)
    const left = [...rest]
    while (left.length) {
        const index = left.findIndex((entry) => {
            const [a, b] = ends(entry)
            return [a, b].some(
                (end) => visitKey(end) === visitKey(start) || visitKey(end) === visitKey(finish)
            )
        })
        if (index < 0) return undefined
        const [entry] = left.splice(index, 1)
        const [a, b] = ends(entry)
        if (visitKey(a) === visitKey(finish)) [members, finish] = [[...members, entry], b]
        else if (visitKey(b) === visitKey(finish)) [members, finish] = [[...members, entry], a]
        else if (visitKey(a) === visitKey(start)) [members, start] = [[entry, ...members], b]
        else [members, start] = [[entry, ...members], a]
    }
    return { members, ends: [start, finish] }
}

/** Whether every run meets an earlier one at a large station, from the run through home (§7.8). */
function joined(routes: readonly FleetRoute[], home: string | undefined): string | undefined {
    if (home && !routes.some((route) => route.visits.some((visit) => visitKey(visit) === home)))
        return 'One run must include the company’s home station.'
    const cities = routes.map(
        (route) => new Set(route.visits.filter((visit) => visit.node.kind === 'city').map(visitKey))
    )
    const start = home
        ? routes.findIndex((route) => route.visits.some((v) => visitKey(v) === home))
        : 0
    const reached = new Set([start])
    for (let grew = true; grew;) {
        grew = false
        for (let index = 0; index < routes.length; index++) {
            if (reached.has(index)) continue
            if (
                [...reached].some((other) =>
                    [...cities[index]].some((city) => cities[other].has(city))
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

function value(
    state: TrainRunningState,
    companyId: string,
    route: FleetRoute,
    visit: RouteVisit
): number {
    return stopValue(state, RouteRules1862, companyId, visit, visit.node, route.train)
}

/**
 * Settles the company's runs together: each stop paid once, the best stops of N/M trains, Freight
 * chains paid at their ends with their crow-flies bonus, and the Local subsidy (§7.8).
 */
function settle(
    state: TrainRunningState,
    companyId: string,
    routes: readonly FleetRoute[]
): ReturnType<FleetRules['settle']> {
    const reason = joined(routes, homeCity(state, companyId))
    if (reason) return { reason }
    const candidates = routes.map((route, index) => ({ route, index }))
    const freight = candidates.filter((entry) => kindOf(entry.route.train) === 'freight')
    const sets = freightSets(freight)
    if (typeof sets === 'string') return { reason: sets }
    const others = candidates.filter((entry) => kindOf(entry.route.train) !== 'freight')
    // Try every choice of the stops N/M trains leave unpaid and keep the best total.
    const choices = others.map((entry) => skipChoices(entry.route))
    let best: { routes: RouteResult[]; total: number } | undefined
    const combine = (position: number, skipped: string[][]) => {
        if (position === others.length) {
            for (const grouping of sets) {
                const settled = payRoutes(state, companyId, candidates, grouping, others, skipped)
                const total = settled.reduce((sum, route) => sum + route.revenue, 0)
                if (!best || total > best.total) best = { routes: settled, total }
            }
            return
        }
        for (const choice of choices[position]) combine(position + 1, [...skipped, choice])
    }
    combine(0, [])
    const locals = new Set(
        candidates
            .filter((entry) => kindOf(entry.route.train) === 'local')
            .flatMap((entry) => entry.route.locationIds)
    )
    const subsidy = locals.size * LocalSubsidy
    return { routes: best?.routes ?? [], ...(subsidy ? { subsidy } : {}) }
}

function payRoutes(
    state: TrainRunningState,
    companyId: string,
    candidates: Candidate[],
    sets: FreightSet[],
    others: Candidate[],
    skipped: string[][]
): RouteResult[] {
    const paid = new Set<string>()
    const payments = candidates.map((): RoutePayment[] => [])
    const bonuses = candidates.map((): RouteBonus[] => [])
    const pay = (entry: Candidate, visit: RouteVisit) => {
        const key = stopKey(visit.locationId, visit.nodeId)
        if (paid.has(key)) return
        paid.add(key)
        const amount = value(state, companyId, entry.route, visit)
        if (amount)
            payments[entry.index].push({
                locationId: visit.locationId,
                nodeId: visit.nodeId,
                amount
            })
    }
    others.forEach((entry, position) => {
        for (const visit of entry.route.visits)
            if (payable(entry.route.train, visit) && !skipped[position].includes(visitKey(visit)))
                pay(entry, visit)
    })
    for (const set of sets) {
        const owner = (visit: RouteVisit) =>
            set.members.find((entry) =>
                [entry.route.visits[0], entry.route.visits.at(-1)].some(
                    (end) => end && visitKey(end) === visitKey(visit)
                )
            ) ?? set.members[0]
        for (const end of set.ends) pay(owner(end), end)
        const port = set.ends.some((end) => areaKind(end) === 'port')
        const hexes = crowHexes(set.endHexes[0], set.endHexes[1])
        const amount = hexes * (port ? PortFreightBonus : FreightBonus)
        if (amount)
            bonuses[set.members[0].index].push({ locationId: set.ends[0].locationId, amount })
    }
    return candidates
        .map((entry) => {
            const own = payments[entry.index]
            const extra = bonuses[entry.index]
            const revenue = [...own, ...extra].reduce((sum, item) => sum + item.amount, 0)
            return {
                ...entry.route.result,
                payments: own,
                ...(extra.length ? { bonuses: extra } : { bonuses: undefined }),
                revenue
            }
        })
        .map(({ bonuses, ...route }) => (bonuses ? { ...route, bonuses } : route))
}

/**
 * At most what a run can add beside runs already chosen: its payable stops not paid in full by
 * them, a Freight run's ends and a bonus for every hex it crosses at the port rate, and the
 * subsidy for hexes no chosen Local visits.
 */
function bound(
    state: TrainRunningState,
    companyId: string,
    route: FleetRoute,
    chosen: readonly FleetRoute[]
): number {
    const settled = new Set(
        chosen
            .filter((other) => kindOf(other.train) !== 'freight' && skipChoices(other).length === 1)
            .flatMap((other) =>
                other.visits
                    .filter((visit) => payable(other.train, visit))
                    .map((v) => stopKey(v.locationId, v.nodeId))
            )
    )
    const unpaid = (visit: RouteVisit) => !settled.has(stopKey(visit.locationId, visit.nodeId))
    if (kindOf(route.train) === 'freight') {
        const ends = [route.visits[0], route.visits[route.visits.length - 1]]
        return (
            ends
                .filter(unpaid)
                .reduce((sum, visit) => sum + value(state, companyId, route, visit), 0) +
            route.result.distance * PortFreightBonus
        )
    }
    const stops = route.visits
        .filter((visit) => payable(route.train, visit) && unpaid(visit))
        .reduce((sum, visit) => sum + value(state, companyId, route, visit), 0)
    if (kindOf(route.train) !== 'local') return stops
    const visited = new Set(
        chosen
            .filter((other) => kindOf(other.train) === 'local')
            .flatMap((other) => other.locationIds)
    )
    return stops + new Set(route.locationIds.filter((id) => !visited.has(id))).size * LocalSubsidy
}

/** What settlement reads of a run: Express its stops, Freight its ends too, Local its hexes too. */
function routeKey(
    train: TrainDefinition,
    visits: readonly RouteVisit[],
    locationIds: readonly string[]
) {
    const stops = visits.map(visitKey).join(' ')
    switch (kindOf(train)) {
        case 'express':
            return stops
        case 'freight': {
            const ends = [visits[0], visits[visits.length - 1]].map(
                (visit) => endHex({ locationIds }, visit).locationId
            )
            return `${stops} | ${ends.join(' ')}`
        }
        case 'local':
            return `${stops} | ${[...new Set(locationIds)].sort().join(' ')}`
    }
}

export const FleetRules1862: FleetRules = { sharedTrack: true, settle, bound, routeKey }

/**
 * Runs begin and end at large stations or off-boards, with two large stations or one and an
 * off-board (§7.8).
 */
function routeAllowed(
    _state: TrainRunningState,
    _companyId: string,
    _train: TrainDefinition,
    visits: readonly RouteVisit[]
): string | undefined {
    const first = visits[0]
    const last = visits[visits.length - 1]
    if (first.node.kind === 'town' || last.node.kind === 'town')
        return 'A run begins and ends at a large station or off the board.'
    const cities = visits.filter((visit) => visit.node.kind === 'city').length
    const offboards = visits.filter((visit) => visit.node.kind === 'offboard').length
    if (cities < 2 && !(cities === 1 && offboards >= 1))
        return 'A run needs two large stations, or one and an off-board area.'
    return undefined
}

export const RouteRules1862: RouteRules = {
    map: Map1862,
    tileSet: TileSet1862,
    depot: TrainDepot1862,
    revenueStage: (state) => revenueStages(state.phaseId),
    requiresCity: () => false,
    // A company runs only the kinds of train it holds a permit for (§6.5.4.3).
    canRunTrain: (state, train) =>
        train.status === 'owned' &&
        train.owner.kind === 'company' &&
        permitsOf(state, train.owner.companyId).includes(trainFace(train.definitionId).kind),
    // London only with a London station; Local trains no off-boards (§7.4, §7.8.2).
    stopAllowed(state, companyId, center, train) {
        const area = offboardArea(center.locationId, center.nodeId)
        if (area === 'london' && !hasLondonStation(state, companyId)) return false
        if (area && train && kindOf(train) === 'local') return false
        return true
    },
    routeAllowed,
    fleet: FleetRules1862
}
