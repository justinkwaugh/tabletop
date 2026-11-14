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

// The hexes a search may not enter, asked one hex at a time so that sets can be combined without
// copying them.
type HexSet = Pick<ReadonlySet<HexId>, 'has'>

function either(a: HexSet, b: HexSet): HexSet {
    return { has: (hexId) => a.has(hexId) || b.has(hexId) }
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
// hexes, neighbours in hex order, so the links come out in hex id order. It steps onto a non-city
// hex only while some city outside the route and the path can still be reached from it, so every
// expansion lies on the way to a link and track that leads to no other city costs nothing.
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
    const blocked = new Set<HexId>([...visited, cityHexId])
    const extend = (hexId: HexId) => {
        for (const next of neighboursInHexOrder(hexId)) {
            if (blocked.has(next) || !hasTrackIn(track, next, railroadId)) {
                continue
            }
            const isCity = isCityHex(next)
            if (!isCity && !reachesCityWhere(track, railroadId, next, blocked, () => true)) {
                continue
            }
            if (!budget.spend()) {
                return
            }
            if (isCity) {
                links.push({ railroadId, hexIds: [...path, next] })
                continue
            }
            path.push(next)
            blocked.add(next)
            extend(next)
            blocked.delete(next)
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
    visited: HexSet
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

// R-3.3.2, R-3.3.3: one link of this railroad from fromHexId reaches a city the goal accepts,
// through non-city hexes outside the blocked ones. A search of the railroad's track that stops at
// the first such city.
function reachesCityWhere(
    track: Track,
    railroadId: RailroadId,
    fromHexId: HexId,
    blocked: HexSet,
    isGoal: (cityHexId: HexId) => boolean
): boolean {
    const reached = new Set<HexId>([fromHexId])
    const frontier: HexId[] = [fromHexId]
    for (let hexId = frontier.pop(); hexId !== undefined; hexId = frontier.pop()) {
        for (const next of neighboursInHexOrder(hexId)) {
            if (reached.has(next) || blocked.has(next) || !hasTrackIn(track, next, railroadId)) {
                continue
            }
            reached.add(next)
            if (!isCityHex(next)) {
                frontier.push(next)
            } else if (isGoal(next)) {
                return true
            }
        }
    }
    return false
}

// R-3.3.2, R-3.3.3: one link of this railroad from fromHexId reaches targetHexId through non-city
// hexes outside the blocked ones.
function reachesCity(
    track: Track,
    railroadId: RailroadId,
    fromHexId: HexId,
    targetHexId: HexId,
    blocked: HexSet
): boolean {
    return (
        hasTrackIn(track, fromHexId, railroadId) &&
        reachesCityWhere(track, railroadId, fromHexId, blocked, (hexId) => hexId === targetHexId)
    )
}

// R-3.3.2, R-3.3.3: one link of a named route, the railroad that makes it between two cities.
type Leg = {
    railroadId: RailroadId
    fromHexId: HexId
    toHexId: HexId
}

// R-3.3.2, R-3.3.2-H1, R-3.3.3: the links of the leg's railroad from its first city to its second
// that use none of the blocked hexes, in the order the depth-first search of railroadLinksFrom
// finds them. A step is taken only while the second city can still be reached without the hexes
// already used, so the search never walks into a dead end and finds each next link in polynomial
// time. Each step spends one expansion of the budget.
function* railroadLinksTo(
    track: Track,
    { railroadId, fromHexId, toHexId }: Leg,
    blocked: HexSet,
    budget: ExpansionBudget
): Generator<Link> {
    if (!hasTrackIn(track, fromHexId, railroadId) || blocked.has(toHexId)) {
        return
    }
    const path: HexId[] = [fromHexId]
    const onPath = new Set<HexId>(path)
    const used = either(blocked, onPath)
    function* extend(hexId: HexId): Generator<Link> {
        for (const next of neighboursInHexOrder(hexId)) {
            if (used.has(next) || !hasTrackIn(track, next, railroadId)) {
                continue
            }
            if (next === toHexId) {
                yield { railroadId, hexIds: [...path, next] }
                continue
            }
            if (isCityHex(next)) {
                continue
            }
            onPath.add(next)
            if (reachesCity(track, railroadId, next, toHexId, used)) {
                if (!budget.spend()) {
                    return
                }
                path.push(next)
                yield* extend(next)
                path.pop()
            }
            onPath.delete(next)
        }
    }
    yield* extend(fromHexId)
}

// R-3.3.2, R-3.3.3: the leg's first link outside the blocked hexes, or undefined when it has none.
// Every step can still reach the second city, so the search goes straight there: at most one
// step per hex of the railroad, each a search of its track.
function firstLinkOf(track: Track, leg: Leg, blocked: HexSet): Link | undefined {
    const first = railroadLinksTo(track, leg, blocked, unbounded()).next()
    return first.done ? undefined : first.value
}

// R-3.3.3: the non-city hexes that every link of the leg outside the blocked hexes passes;
// undefined when the leg has no such link. One depth-first search of the railroad's track from the
// first city, through non-city hexes and to the second city, numbers each hex and finds the
// lowest number each subtree reaches round it. A hex on the search's way to the second city is
// passed by every link exactly when the subtree after it reaches no hex numbered before it.
function hexesEveryLinkPasses(
    track: Track,
    { railroadId, fromHexId, toHexId }: Leg,
    blocked: HexSet
): Set<HexId> | undefined {
    const order = new Map<HexId, number>()
    const low = new Map<HexId, number>()
    const parent = new Map<HexId, HexId>()
    const visit = (hexId: HexId): number => {
        const number = order.size
        order.set(hexId, number)
        let lowest = number
        for (const next of neighboursInHexOrder(hexId)) {
            if (
                next === parent.get(hexId) ||
                blocked.has(next) ||
                !hasTrackIn(track, next, railroadId) ||
                (isCityHex(next) && next !== toHexId && next !== fromHexId)
            ) {
                continue
            }
            const seen = order.get(next)
            if (seen === undefined) {
                parent.set(next, hexId)
                lowest = Math.min(lowest, visit(next))
            } else {
                lowest = Math.min(lowest, seen)
            }
        }
        low.set(hexId, lowest)
        return lowest
    }
    if (!hasTrackIn(track, fromHexId, railroadId) || blocked.has(toHexId)) {
        return undefined
    }
    visit(fromHexId)
    if (!order.has(toHexId)) {
        return undefined
    }
    const passed = new Set<HexId>()
    let child = toHexId
    for (let hexId = parent.get(child); hexId !== undefined && hexId !== fromHexId;) {
        if (numbered(low, child) >= numbered(order, hexId)) {
            passed.add(hexId)
        }
        child = hexId
        hexId = parent.get(child)
    }
    return passed
}

function numbered(numbers: ReadonlyMap<HexId, number>, hexId: HexId): number {
    const number = numbers.get(hexId)
    assertExists(number, `Hex ${hexId} was not searched`)
    return number
}

// R-3.3.3: the hexes the later legs cannot do without, given the visited ones; undefined when
// they cannot all be made. A hex one leg must pass is closed to the others, which may force
// them onto further hexes, until nothing changes. Blocking more hexes only adds to what a leg
// must pass, so each round grows the sets or ends the loop.
function hexesLaterLegsNeed(
    track: Track,
    legs: readonly Leg[],
    visited: HexSet
): Set<HexId> | undefined {
    const needs = legs.map(() => new Set<HexId>())
    for (let changed = true; changed;) {
        changed = false
        for (const [index, leg] of legs.entries()) {
            const others = new Set(
                needs.flatMap((each, other) => (other === index ? [] : [...each]))
            )
            const needed = hexesEveryLinkPasses(track, leg, either(visited, others))
            if (!needed) {
                return undefined
            }
            if (needed.size > needs[index].size) {
                needs[index] = needed
                changed = true
            }
        }
    }
    return new Set(needs.flatMap((each) => [...each]))
}

function sameLink(a: Link, b: Link): boolean {
    return (
        a.railroadId === b.railroadId &&
        a.hexIds.length === b.hexIds.length &&
        a.hexIds.every((hexId, index) => hexId === b.hexIds[index])
    )
}

// R-3.3.2, R-3.3.3: the first realisation of the legs in link order, by a search that backs up
// to an earlier link when a later one cannot be made. From each city it first follows the leg's
// first link; only when the rest of the route cannot follow it does it look at the others, and
// then never at a link that takes a hex a later leg needs (hexesLaterLegsNeed), so it tries only
// links that leave every later leg possible on its own. It gives up when the budget is spent.
function searchRealisation(
    track: Track,
    legs: readonly Leg[],
    startHexId: HexId,
    budget: ExpansionBudget
): Link[] | undefined {
    const realiseFrom = (links: Link[], visited: ReadonlySet<HexId>): Link[] | undefined => {
        const index = links.length
        if (index === legs.length) {
            return links
        }
        const leg = legs[index]
        const follow = (link: Link) =>
            realiseFrom([...links, link], new Set([...visited, ...link.hexIds]))
        const first = railroadLinksTo(track, leg, visited, budget).next()
        if (first.done) {
            return undefined
        }
        const followed = follow(first.value)
        if (followed || budget.capped) {
            return followed
        }
        const needs = hexesLaterLegsNeed(track, legs.slice(index + 1), visited)
        if (!needs) {
            return undefined
        }
        for (const link of railroadLinksTo(track, leg, either(visited, needs), budget)) {
            if (sameLink(link, first.value)) {
                continue
            }
            const realised = follow(link)
            if (realised || budget.capped) {
                return realised
            }
        }
        return undefined
    }
    return realiseFrom([], new Set([startHexId]))
}

// R-X.1: how many steps one realise may take in its searches before it gives up. Only a route
// whose later links contend for the same hexes, with no hex one of them must have, makes the
// search back up far enough to reach it.
export const REALISE_EXPANSION_CAP = 20_000

// R-3.3.2, R-3.3.3, R-X.1: the hexes of a route given as its cities and each link's railroad,
// the first realisation in link order that visits no hex twice; undefined when none exists, when
// the start holds no passenger, or when the search spends REALISE_EXPANSION_CAP steps.
//
// The route is realised one link at a time: the first realisation of the route so far is kept
// while the next link can follow it, so that link is the first one out of its city that avoids
// the route's hexes, found without a search. Only when it cannot follow does the search look for
// the first realisation of the whole route so far. So every city nextCities offers after the
// realisation of a route is realised with it, whatever the cap, and the hexes of the route so
// far stay as they were.
//
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
    const legs: Leg[] = railroadIds.map((railroadId, index) => ({
        railroadId,
        fromHexId: cityHexIds[index],
        toHexId: cityHexIds[index + 1]
    }))
    const startHexId = cityHexIds[0]
    const budget = new ExpansionBudget(REALISE_EXPANSION_CAP)
    let links: Link[] = []
    for (const [index, leg] of legs.entries()) {
        const next = firstLinkOf(state.track, leg, routeHexIds(startHexId, links))
        const realised = next
            ? [...links, next]
            : searchRealisation(state.track, legs.slice(0, index + 1), startHexId, budget)
        if (!realised) {
            return undefined
        }
        links = realised
    }
    return links
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
// steps onto; at the cap the search stops, so a cap can only drop journeys from the list. The
// search steps only onto hexes on the way to another city (railroadLinksFrom), so it reaches its
// first link within a railroad's length and lists a journey whenever one leaves the start.
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
