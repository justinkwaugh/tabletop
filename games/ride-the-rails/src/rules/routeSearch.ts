import { assert, assertExists } from '@tabletop/common'
import type { HexId } from '../data/hexes.js'
import { RAILROAD_IDS, type RailroadId } from '../data/railroads.js'
import {
    adjacentHexIds,
    cityAt,
    hexOrder,
    isCityHex,
    USA_HEXES,
    usaCity,
    type CityId
} from '../data/usaMap.js'
import type { RideTheRailsGameState, Track } from '../model/gameState.js'
import { journeyHexIds, journeyPayments, paymentTotal, type Link } from './routes.js'
import { hasTrackIn } from './track.js'

export type NextCity = {
    cityId: CityId
    railroadIds: RailroadId[]
}

export type RankedJourney = {
    links: Link[]
    gain: number
}

export type BestJourneys = {
    journeys: RankedJourney[]
    expansions: number
    capped: boolean
}

export const BEST_JOURNEYS_EXPANSION_CAP = 10_000

class ExpansionBudget {
    expansions = 0
    capped = false

    constructor(readonly cap: number) {}

    spend(): boolean {
        if (this.expansions >= this.cap) {
            this.capped = true
            return false
        }
        this.expansions += 1
        return true
    }
}

const NEIGHBOURS_IN_HEX_ORDER: ReadonlyMap<HexId, readonly HexId[]> = new Map(
    USA_HEXES.map((hex) => [
        hex.id,
        [...adjacentHexIds(hex.id)].sort((a, b) => hexOrder(a) - hexOrder(b))
    ])
)

function neighboursInHexOrder(hexId: HexId): readonly HexId[] {
    const neighbours = NEIGHBOURS_IN_HEX_ORDER.get(hexId)
    assertExists(neighbours, `Unknown USA hex ${hexId}`)
    return neighbours
}

// R-3.3.2, R-3.3.2-H1, R-3.3.3: a depth-first search in one railroad's track through non-city
// hexes, neighbours in hex order, so the links come out in hex id order.
function railroadLinksFrom(
    track: Track,
    railroadId: RailroadId,
    cityHexId: HexId,
    visited: ReadonlySet<HexId>,
    budget: ExpansionBudget
): Link[] {
    if (!hasTrackIn(track, cityHexId, railroadId)) {
        return []
    }
    const links: Link[] = []
    const path: HexId[] = [cityHexId]
    const extend = (hexId: HexId) => {
        for (const next of neighboursInHexOrder(hexId)) {
            if (path.includes(next) || visited.has(next) || !hasTrackIn(track, next, railroadId)) {
                continue
            }
            if (!budget.spend()) {
                return
            }
            if (isCityHex(next)) {
                links.push({ railroadId, hexIds: [...path, next] })
                continue
            }
            path.push(next)
            extend(next)
            path.pop()
        }
    }
    extend(cityHexId)
    return links
}

function searchLinksFrom(
    track: Track,
    cityHexId: HexId,
    visited: ReadonlySet<HexId>,
    budget: ExpansionBudget
): Link[] {
    return RAILROAD_IDS.flatMap((railroadId) =>
        railroadLinksFrom(track, railroadId, cityHexId, visited, budget)
    )
}

const unbounded = () => new ExpansionBudget(Number.POSITIVE_INFINITY)

// R-3.3.2, R-3.3.3: every link out of the city at hexId that uses none of the visited hexes
// (the city itself may be among them), in railroad order of R-1.4, then hex id order.
export function linksFrom(
    state: RideTheRailsGameState,
    hexId: HexId,
    visited: Iterable<HexId>
): Link[] {
    assert(isCityHex(hexId), `Hex ${hexId} is not a city`)
    return searchLinksFrom(state.track, hexId, new Set(visited), unbounded())
}

function routeHexIds(startHexId: HexId, links: readonly Link[]): Set<HexId> {
    return new Set([startHexId, ...links.flatMap((link) => link.hexIds)])
}

function routeEndHexId(startHexId: HexId, links: readonly Link[]): HexId {
    return links.at(-1)?.hexIds.at(-1) ?? startHexId
}

// R-3.3.2, R-3.3.2-H1, R-3.3.3: the cities one link of this railroad reaches from the city at
// fromHexId through non-city hexes outside the visited ones (the city itself may be among them).
// A search of the railroad's track, each hex reached once.
function railroadCitiesFrom(
    track: Track,
    railroadId: RailroadId,
    fromHexId: HexId,
    visited: ReadonlySet<HexId>
): Set<HexId> {
    const cities = new Set<HexId>()
    if (!hasTrackIn(track, fromHexId, railroadId)) {
        return cities
    }
    const reached = new Set<HexId>([fromHexId])
    const frontier: HexId[] = [fromHexId]
    for (let hexId = frontier.pop(); hexId !== undefined; hexId = frontier.pop()) {
        for (const next of neighboursInHexOrder(hexId)) {
            if (reached.has(next) || visited.has(next) || !hasTrackIn(track, next, railroadId)) {
                continue
            }
            reached.add(next)
            if (isCityHex(next)) {
                cities.add(next)
            } else {
                frontier.push(next)
            }
        }
    }
    return cities
}

// R-3.3.2, R-3.3.3: the cities one more link reaches without reusing a hex of the route, in hex
// id order, each with the railroads (R-1.4 order) that make that link.
export function nextCities(
    state: RideTheRailsGameState,
    startCityId: CityId,
    links: readonly Link[]
): NextCity[] {
    const startHexId = usaCity(startCityId).hexId
    assert(links.length === 0 || links[0].hexIds[0] === startHexId, 'The route leaves its start')
    const fromHexId = routeEndHexId(startHexId, links)
    const visited = routeHexIds(startHexId, links)
    const reached = RAILROAD_IDS.map(
        (railroadId) =>
            [railroadId, railroadCitiesFrom(state.track, railroadId, fromHexId, visited)] as const
    )
    const endHexIds = [...new Set(reached.flatMap(([, cities]) => [...cities]))]
    return endHexIds
        .sort((a, b) => hexOrder(a) - hexOrder(b))
        .map((endHexId) => ({
            cityId: cityAt(endHexId).id,
            railroadIds: reached
                .filter(([, cities]) => cities.has(endHexId))
                .map(([railroadId]) => railroadId)
        }))
}

// R-3.3.2, R-3.3.3: one link of this railroad from fromHexId reaches targetHexId through non-city
// hexes outside the blocked ones.
function reachesCity(
    track: Track,
    railroadId: RailroadId,
    fromHexId: HexId,
    targetHexId: HexId,
    blocked: ReadonlySet<HexId>
): boolean {
    return railroadCitiesFrom(track, railroadId, fromHexId, blocked).has(targetHexId)
}

// R-3.3.2, R-3.3.2-H1, R-3.3.3: the links of one railroad from the city at fromHexId to the city
// at targetHexId that use none of the visited hexes, in the order the depth-first search of
// railroadLinksFrom finds them. A step is taken only while the target can still be reached
// without the hexes already used, so finding each next link takes polynomial time.
function* railroadLinksTo(
    track: Track,
    railroadId: RailroadId,
    fromHexId: HexId,
    targetHexId: HexId,
    visited: ReadonlySet<HexId>
): Generator<Link> {
    if (!hasTrackIn(track, fromHexId, railroadId) || visited.has(targetHexId)) {
        return
    }
    const path: HexId[] = [fromHexId]
    const blocked = new Set<HexId>([...visited, fromHexId])
    function* extend(hexId: HexId): Generator<Link> {
        for (const next of neighboursInHexOrder(hexId)) {
            if (blocked.has(next) || !hasTrackIn(track, next, railroadId)) {
                continue
            }
            if (next === targetHexId) {
                yield { railroadId, hexIds: [...path, next] }
                continue
            }
            if (isCityHex(next)) {
                continue
            }
            path.push(next)
            blocked.add(next)
            if (reachesCity(track, railroadId, next, targetHexId, blocked)) {
                yield* extend(next)
            }
            blocked.delete(next)
            path.pop()
        }
    }
    yield* extend(fromHexId)
}

// R-X.1: how many candidate links one realise may try before it gives up. Only a route whose
// every realisation of an earlier link blocks a later one reaches it.
export const REALISE_CANDIDATE_CAP = 1_000

// R-3.3.2, R-3.3.3, R-X.1: the hexes of a route given as its cities and each link's railroad,
// the first realisation in link order that visits no hex twice; undefined when none exists, when
// the start holds no passenger, or when the search tries REALISE_CANDIDATE_CAP candidate links.
// The server checks the journey itself (journeyRefusal), so the cap bounds only this offer.
export function realise(
    state: RideTheRailsGameState,
    cities: readonly CityId[],
    railroadIds: readonly RailroadId[]
): Link[] | undefined {
    assert(cities.length === railroadIds.length + 1, 'A route has one more city than links')
    if (railroadIds.length === 0 || !state.passengers.includes(cities[0])) {
        return undefined
    }
    const cityHexIds = cities.map((cityId) => usaCity(cityId).hexId)
    // R-3.3.3: a city twice, or a link that does not exist even alone, leaves no realisation.
    if (
        new Set(cityHexIds).size !== cityHexIds.length ||
        railroadIds.some(
            (railroadId, index) =>
                !reachesCity(
                    state.track,
                    railroadId,
                    cityHexIds[index],
                    cityHexIds[index + 1],
                    new Set()
                )
        )
    ) {
        return undefined
    }
    const budget = new ExpansionBudget(REALISE_CANDIDATE_CAP)
    const realiseFrom = (links: Link[], visited: ReadonlySet<HexId>): Link[] | undefined => {
        const index = links.length
        if (index === railroadIds.length) {
            return links
        }
        const candidates = railroadLinksTo(
            state.track,
            railroadIds[index],
            cityHexIds[index],
            cityHexIds[index + 1],
            visited
        )
        for (const link of candidates) {
            if (!budget.spend()) {
                return undefined
            }
            const realised = realiseFrom([...links, link], new Set([...visited, ...link.hexIds]))
            if (realised || budget.capped) {
                return realised
            }
        }
        return undefined
    }
    return realiseFrom([], new Set([cityHexIds[0]]))
}

// R-3.3.4, R-3.3.5: the rider's fare plus the dividends on the rider's own shares.
function riderGain(state: RideTheRailsGameState, playerId: string, links: readonly Link[]): number {
    const payment = journeyPayments(state.players, playerId, links).payments.find(
        (candidate) => candidate.playerId === playerId
    )
    assertExists(payment, `No player ${playerId}`)
    return paymentTotal(payment)
}

function hexCount(links: readonly Link[]): number {
    return journeyHexIds(links).length
}

function compareLinks(a: Link, b: Link): number {
    const byRailroad = RAILROAD_IDS.indexOf(a.railroadId) - RAILROAD_IDS.indexOf(b.railroadId)
    if (byRailroad !== 0) {
        return byRailroad
    }
    for (let index = 0; index < Math.min(a.hexIds.length, b.hexIds.length); index++) {
        const byHex = hexOrder(a.hexIds[index]) - hexOrder(b.hexIds[index])
        if (byHex !== 0) {
            return byHex
        }
    }
    return a.hexIds.length - b.hexIds.length
}

function compareRoutesInIdOrder(a: readonly Link[], b: readonly Link[]): number {
    for (let index = 0; index < Math.min(a.length, b.length); index++) {
        const byLink = compareLinks(a[index], b[index])
        if (byLink !== 0) {
            return byLink
        }
    }
    return a.length - b.length
}

function compareRanked(a: RankedJourney, b: RankedJourney): number {
    return (
        b.gain - a.gain ||
        b.links.length - a.links.length ||
        hexCount(a.links) - hexCount(b.links) ||
        compareRoutesInIdOrder(a.links, b.links)
    )
}

// R-3.3, R-X.1: suggestions only. Every legal journey from the start, best first for the rider:
// gain, then more links, then fewer hexes, then id order. One expansion is one hex the search
// steps onto; at the cap the search stops, so a cap can only drop journeys from the list.
export function bestJourneys(
    state: RideTheRailsGameState,
    startCityId: CityId,
    playerId: string,
    expansionCap = BEST_JOURNEYS_EXPANSION_CAP
): BestJourneys {
    const budget = new ExpansionBudget(expansionCap)
    const journeys: RankedJourney[] = []
    const startHexId = usaCity(startCityId).hexId
    const extend = (links: readonly Link[], visited: ReadonlySet<HexId>) => {
        const outgoing = searchLinksFrom(
            state.track,
            routeEndHexId(startHexId, links),
            visited,
            budget
        )
        for (const link of outgoing) {
            const route = [...links, link]
            journeys.push({ links: route, gain: riderGain(state, playerId, route) })
            extend(route, new Set([...visited, ...link.hexIds]))
        }
    }
    if (state.passengers.includes(startCityId)) {
        extend([], new Set([startHexId]))
    }
    return {
        journeys: journeys.sort(compareRanked),
        expansions: budget.expansions,
        capped: budget.capped
    }
}
