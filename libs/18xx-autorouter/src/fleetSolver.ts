import { assert, assertExists } from '@tabletop/common'
import {
    RouteEvaluation,
    cityIsBlocked,
    companyStationCenters,
    exceedsRouteDistance,
    routePathResources,
    sameCenter,
    trainRoutesOf,
    type FleetRoute,
    type FleetRules,
    type RevenueCenter,
    type RouteRules,
    type RouteVisit,
    type RouteWalk,
    type Train,
    type TrainDefinition,
    type TrainRoute,
    type TrainRunningState
} from '@tabletop/18xx'
import type { AutoroutingResult } from './autorouter.js'

// More routes for one kind of train than a search over a fleet's combinations can weigh, and about
// as many as a worker holds comfortably; the most valuable are kept and the search reports the cut.
export const FleetCandidateLimit = 10_000

type Candidate = {
    route: FleetRoute
    /** The track it uses, where trains may not share it. */
    resources?: ReadonlySet<string>
    /** Its bound with nothing chosen before it, by which candidates are tried. */
    base: number
}
type Group = { train: TrainDefinition; trainIds: string[]; candidates: Candidate[] }
type Slot = { group: number; trainId: string; end: number }
/** The routes chosen so far, each for its own train, and the candidates they came from. */
type Chosen = { candidates: Candidate[]; routes: FleetRoute[] }
type Half = { paths: TrainRoute['paths']; visits: readonly RouteVisit[]; crossings: number }

/**
 * The best run of a company whose trains settle as a fleet. Every route a kind of train can run is
 * listed once, by what its title can value; then one route or none for each train is chosen,
 * maximizing revenue and subsidy together. That choice is maximum coverage under a partition
 * constraint, so it is searched by branch and bound on the title's bounds, best routes first.
 */
export class FleetSolver {
    private readonly evaluation: RouteEvaluation
    private readonly fleet: FleetRules
    private readonly deadline: number
    private readonly stopStates = new Map<string, { allowed: boolean; passable: boolean }>()
    private enumerationExhaustive = true
    private memoryLimited = false
    private interrupted = false
    private leaves = 0
    private nodes = 0
    private best = 0
    private bestRoutes: TrainRoute[] = []
    private groups: Group[] = []
    private slots: Slot[] = []

    constructor(
        private readonly state: TrainRunningState,
        private readonly rules: RouteRules,
        private readonly companyId: string,
        timeLimitMs: number
    ) {
        assertExists(rules.fleet, 'The fleet solver runs titles with fleet rules')
        assert(
            !rules.requiredRouteEnds?.(state, companyId),
            'The fleet solver does not run required routes'
        )
        this.fleet = rules.fleet
        this.evaluation = new RouteEvaluation(state, rules)
        this.deadline = performance.now() + timeLimitMs
    }

    solve(): AutoroutingResult {
        const started = performance.now()
        const available = this.evaluation.evaluate(this.companyId, [])
        assertExists(available.result, available.reason ?? 'Company cannot run trains')
        this.groups = this.trainGroups(this.evaluation.runnableTrains(this.companyId))
        const pathMs = performance.now() - started
        const searchStarted = performance.now()
        this.slots = this.groups.flatMap((group, index) =>
            group.trainIds.map((trainId) => ({ group: index, trainId, end: 0 }))
        )
        for (const [index, slot] of this.slots.entries())
            slot.end =
                index + this.slots.slice(index).filter((other) => other.group === slot.group).length
        this.search(0, 0, { candidates: [], routes: [] }, 0)
        const combinationMs = performance.now() - searchStarted
        const validationStarted = performance.now()
        const checked = this.evaluation.evaluate(this.companyId, this.bestRoutes)
        assertExists(checked.result, checked.reason ?? 'Solver returned an invalid operation')
        assert(
            checked.result.revenue + (checked.result.subsidy ?? 0) === this.best,
            'Solver and game disagree on route revenue'
        )
        const combinationExhaustive = !this.interrupted
        const pathExhaustive = this.enumerationExhaustive && !this.memoryLimited
        return {
            result: checked.result,
            exhaustive: pathExhaustive && combinationExhaustive,
            metrics: {
                encodeMs: pathMs,
                solveMs: combinationMs,
                validateMs: performance.now() - validationStarted,
                compileMs: 0,
                pathMs,
                combinationMs,
                pathExhaustive,
                combinationExhaustive,
                memoryLimited: this.memoryLimited,
                memoryBytes: 0,
                candidates: this.slots.map((slot) => this.groups[slot.group].candidates.length),
                expansions: this.nodes,
                connections: this.leaves
            }
        }
    }

    private trainGroups(trains: readonly Train[]): Group[] {
        const byDefinition = new Map<string, string[]>()
        for (const train of trains)
            byDefinition.set(train.definitionId, [
                ...(byDefinition.get(train.definitionId) ?? []),
                train.id
            ])
        const groups = [...byDefinition].map(([definitionId, trainIds]): Group => {
            const train = this.rules.depot.trainDefinition(definitionId)
            const candidates = this.candidates(train, trainIds[0])
            return { train, trainIds, candidates }
        })
        return groups.sort(
            (a, b) =>
                (b.candidates[0]?.base ?? 0) - (a.candidates[0]?.base ?? 0) ||
                a.candidates.length - b.candidates.length
        )
    }

    // Every route through a station is two walks out of it, one reversed: a route starting there
    // pairs nothing with its walk, and a route passing through leaves by its later path second.
    private candidates(train: TrainDefinition, trainId: string): Candidate[] {
        const kept = new Map<string, { candidate: Candidate; cost: [number, number] }>()
        const stations = companyStationCenters(this.state, this.companyId).filter(
            (center, index, all) => all.findIndex((other) => sameCenter(other, center)) === index
        )
        const network = this.evaluation.network
        let steps = 0
        const stopped = () => {
            if (!this.enumerationExhaustive) return true
            if (++steps % 256 === 0 && performance.now() > this.deadline)
                this.enumerationExhaustive = false
            return !this.enumerationExhaustive
        }
        const mostValuable = () => {
            if (kept.size <= FleetCandidateLimit) return
            this.memoryLimited = true
            const ranked = [...kept].sort(([, a], [, b]) => b.candidate.base - a.candidate.base)
            for (const [key] of ranked.slice(FleetCandidateLimit)) kept.delete(key)
        }
        const keep = (station: RevenueCenter, out: Half | undefined, back: Half) => {
            const end = out?.visits[out.visits.length - 1]
            const route: TrainRoute = {
                trainId,
                start: end ? { locationId: end.locationId, nodeId: end.nodeId } : station,
                paths: [...(out ? [...out.paths].reverse() : []), ...back.paths]
            }
            const visits = [...(out ? [...out.visits].reverse() : []), ...back.visits.slice(1)]
            const key = this.candidateKey(train, route, visits)
            const cost: [number, number] = [
                (out?.crossings ?? 0) + back.crossings,
                route.paths.length
            ]
            const previous = kept.get(key)
            if (previous && !this.cheaper(cost, previous.cost)) return
            const evaluated = this.evaluation.evaluateFleetRoute(this.companyId, route)
            if (!evaluated.route) return
            kept.set(key, {
                candidate: {
                    route: evaluated.route,
                    ...(this.fleet.sharedTrack ? {} : { resources: new Set(evaluated.resources) }),
                    base: this.baseBound(evaluated.route)
                },
                cost
            })
            if (kept.size >= 2 * FleetCandidateLimit) mostValuable()
        }
        const fits = (visits: readonly RouteVisit[], crossings: number) =>
            !exceedsRouteDistance(train, { visits, crossings })
        for (const station of stations) {
            if (!this.stopState(station, train).allowed) continue
            const walkBack = (out: Half | undefined) => {
                const first = out?.paths[0]
                network.walk(
                    station,
                    {
                        used: new Set(out ? this.resources(out.paths) : []),
                        ...(first ? { first: (path) => path.pathId > first.pathId } : {})
                    },
                    (back, atStop) => {
                        if (stopped()) return false
                        const visits = out ? [...out.visits, ...back.visits.slice(1)] : back.visits
                        if (!fits(visits, (out?.crossings ?? 0) + back.crossings)) return false
                        if (!atStop) return true
                        const reached = back.visits[back.visits.length - 1]
                        if (!this.mayVisit(reached, visits.slice(0, -1), train)) return false
                        keep(station, out, this.half(back))
                        return this.stopState(reached, train).passable
                    }
                )
            }
            walkBack(undefined)
            if (!this.stopState(station, train).passable) continue
            network.walk(station, {}, (out, atStop) => {
                if (stopped()) return false
                if (!fits(out.visits, out.crossings)) return false
                if (!atStop) return true
                const reached = out.visits[out.visits.length - 1]
                if (!this.mayVisit(reached, out.visits.slice(0, -1), train)) return false
                walkBack(this.half(out))
                return this.stopState(reached, train).passable
            })
        }
        mostValuable()
        return [...kept.values()].map(({ candidate }) => candidate).sort((a, b) => b.base - a.base)
    }

    private half(walk: RouteWalk): Half {
        return { paths: [...walk.paths], visits: [...walk.visits], crossings: walk.crossings }
    }

    private resources(paths: TrainRoute['paths']): string[] {
        return paths.flatMap(({ locationId, pathId }) => {
            const path = this.evaluation.network
                .face(locationId)
                .paths.find((path) => path.id === pathId)
            assertExists(path, 'A walk follows existing track')
            return routePathResources(locationId, path)
        })
    }

    private mayVisit(
        stop: RouteVisit,
        earlier: readonly RouteVisit[],
        train: TrainDefinition
    ): boolean {
        return (
            this.stopState(stop, train).allowed && !earlier.some((visit) => sameCenter(visit, stop))
        )
    }

    private stopState(stop: RevenueCenter, train: TrainDefinition) {
        const key = JSON.stringify([train.id, stop.locationId, stop.nodeId])
        let known = this.stopStates.get(key)
        if (!known) {
            const node = this.evaluation.network
                .face(stop.locationId)
                .nodes.find((node) => node.id === stop.nodeId)
            assertExists(node, 'A stop is a node of its tile')
            const allowed =
                this.rules.stopAllowed?.(this.state, this.companyId, stop, train) !== false
            known = {
                allowed,
                passable:
                    allowed &&
                    node.kind !== 'offboard' &&
                    !cityIsBlocked(this.state, this.companyId, stop.locationId, node)
            }
            this.stopStates.set(key, known)
        }
        return known
    }

    // A route settles by its stops in order, either way round, and the hexes it enters, unless the
    // title reads less; where trains may not share track, by its track too.
    private candidateKey(
        train: TrainDefinition,
        route: TrainRoute,
        visits: readonly RouteVisit[]
    ): string {
        const locationIds = [route.start.locationId]
        for (const { locationId } of route.paths)
            if (locationIds.at(-1) !== locationId) locationIds.push(locationId)
        const forward = JSON.stringify(visits.map(({ locationId, nodeId }) => [locationId, nodeId]))
        const backward = JSON.stringify(
            [...visits].reverse().map(({ locationId, nodeId }) => [locationId, nodeId])
        )
        const reversed = backward < forward
        const stops = reversed ? [...visits].reverse() : visits
        const hexes = reversed ? [...locationIds].reverse() : locationIds
        const settled =
            this.fleet.routeKey?.(train, stops, hexes) ??
            JSON.stringify([reversed ? backward : forward, [...new Set(hexes)].sort()])
        const track = this.fleet.sharedTrack ? [] : this.resources(route.paths).sort()
        return JSON.stringify([settled, track])
    }

    private cheaper(cost: [number, number], than: [number, number]): boolean {
        return cost[0] < than[0] || (cost[0] === than[0] && cost[1] < than[1])
    }

    private baseBound(route: FleetRoute): number {
        if (this.fleet.bound) return this.fleet.bound(this.state, this.companyId, route, [])
        const alone = this.evaluation.settleFleet(this.companyId, [route]).result
        return alone ? alone.revenue + (alone.subsidy ?? 0) : Infinity
    }

    private bound(candidate: Candidate, chosen: Chosen): number {
        if (!this.fleet.bound || !chosen.routes.length) return candidate.base
        return this.fleet.bound(this.state, this.companyId, candidate.route, chosen.routes)
    }

    private conflicts(candidate: Candidate, chosen: Chosen): boolean {
        const resources = candidate.resources
        if (!resources) return false
        return chosen.candidates.some((other) =>
            [...(other.resources ?? [])].some((key) => resources.has(key))
        )
    }

    /** The best bounds, at most `count`, of a group's candidates from `from` beside `chosen`. */
    private topBounds(
        group: Group,
        from: number,
        count: number,
        chosen: Chosen,
        known?: Map<number, number>
    ): number[] {
        const tops: number[] = []
        for (let index = from; index < group.candidates.length; index++) {
            const candidate = group.candidates[index]
            if (tops.length === count && candidate.base <= tops[count - 1]) break
            if (this.conflicts(candidate, chosen)) continue
            const value = this.bound(candidate, chosen)
            known?.set(index, value)
            const at = tops.findIndex((top) => top < value)
            tops.splice(at === -1 ? tops.length : at, 0, value)
            if (tops.length > count) tops.pop()
        }
        return tops
    }

    private search(slotIndex: number, from: number, chosen: Chosen, gathered: number): void {
        this.nodes++
        if (this.leaves > 0 && performance.now() > this.deadline) {
            this.interrupted = true
            return
        }
        if (slotIndex === this.slots.length) {
            this.settle(chosen)
            return
        }
        const slot = this.slots[slotIndex]
        const group = this.groups[slot.group]
        const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)
        let later = 0
        for (let index = slot.end; index < this.slots.length;) {
            const next = this.slots[index]
            later += sum(this.topBounds(this.groups[next.group], 0, next.end - index, chosen))
            index = next.end
        }
        const known = new Map<number, number>()
        const tops = this.topBounds(group, from, slot.end - slotIndex, chosen, known)
        if (gathered + sum(tops) + later <= this.best) return
        const beside = later + sum(tops.slice(0, slot.end - slotIndex - 1))
        const following = slotIndex + 1 < slot.end ? slotIndex + 1 : slot.end
        for (let index = from; index < group.candidates.length; index++) {
            const candidate = group.candidates[index]
            if (gathered + candidate.base + beside <= this.best) break
            if (this.conflicts(candidate, chosen)) continue
            const value = known.get(index) ?? this.bound(candidate, chosen)
            if (gathered + value + beside <= this.best) continue
            chosen.candidates.push(candidate)
            chosen.routes.push({
                ...candidate.route,
                result: { ...candidate.route.result, trainId: slot.trainId }
            })
            this.search(following, following === slot.end ? 0 : index + 1, chosen, gathered + value)
            chosen.candidates.pop()
            chosen.routes.pop()
            if (this.interrupted) return
        }
        this.search(slot.end, 0, chosen, gathered)
    }

    private settle(chosen: Chosen): void {
        this.leaves++
        if (!chosen.routes.length) return
        const settled = this.evaluation.settleFleet(this.companyId, chosen.routes).result
        if (!settled) return
        const total = settled.revenue + (settled.subsidy ?? 0)
        if (total <= this.best) return
        this.best = total
        this.bestRoutes = trainRoutesOf(settled)
    }
}

export function solveFleet(
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string,
    timeLimitMs: number
): AutoroutingResult {
    return new FleetSolver(state, rules, companyId, timeLimitMs).solve()
}
