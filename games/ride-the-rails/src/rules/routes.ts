import * as Type from 'typebox'
import { HexId } from '../data/hexes.js'
import { RAILROAD_IDS, RailroadId } from '../data/railroads.js'
import type { CityId } from '../data/boardMap.js'
import { adjacentHexIds, cityAt, cityById, cityIn, isCityHex, isHexId } from '../data/boardMaps.js'
import { hasTrackIn } from './track.js'
import type { RideTheRailsGameState, Track } from '../model/gameState.js'
import type { RideTheRailsPlayerState } from '../model/playerState.js'

// R-3.3.2: one railroad's hexes from a city to the next city, both cities included.
export type Link = Type.Static<typeof Link>
export const Link = Type.Object({
    railroadId: RailroadId,
    hexIds: Type.Array(HexId)
})

export type JourneyRefusal =
    'no-links' | 'not-a-link' | 'links-do-not-meet' | 'no-passenger' | 'hex-visited-twice'

export type LinksPerRailroad = Type.Static<typeof LinksPerRailroad>
export const LinksPerRailroad = Type.Options(
    Type.Partial(Type.Record(RailroadId, Type.Integer({ minimum: 1 }))),
    { additionalProperties: false }
)

export type JourneyPayment = Type.Static<typeof JourneyPayment>
export const JourneyPayment = Type.Object({
    playerId: Type.String(),
    dividends: Type.Integer({ minimum: 0 }),
    fare: Type.Integer({ minimum: 0 })
})

export type JourneyPayments = {
    linksPerRailroad: LinksPerRailroad
    payments: JourneyPayment[]
}

// R-3.3.2: a link ends at the first city it reaches, so track through a city is two links.
export function isLink(track: Track, { railroadId, hexIds }: Link): boolean {
    if (hexIds.length < 2 || !hexIds.every(isHexId) || new Set(hexIds).size !== hexIds.length) {
        return false
    }
    const interior = hexIds.slice(1, -1)
    return (
        isCityHex(hexIds[0]) &&
        isCityHex(hexIds[hexIds.length - 1]) &&
        interior.every((hexId) => !isCityHex(hexId)) &&
        hexIds.every((hexId) => hasTrackIn(track, hexId, railroadId)) &&
        hexIds.every(
            (hexId, index) => index === 0 || adjacentHexIds(hexIds[index - 1]).includes(hexId)
        )
    )
}

// R-3.3.2: a route changes railroad only in a city, where one link ends and the next begins.
function linksMeet(links: readonly Link[]): boolean {
    return links.every(
        (link, index) => index === 0 || links[index - 1].hexIds.at(-1) === link.hexIds[0]
    )
}

// R-3.3.2, R-3.3.3: the hexes a journey passes, start city to end city; its links meet in cities.
export function journeyHexIds(links: readonly Link[]): HexId[] {
    return links.flatMap((link, index) => (index === 0 ? link.hexIds : link.hexIds.slice(1)))
}

// R-3.3.3: the meeting city of two links is one visit.
function visitsNoHexTwice(links: readonly Link[]): boolean {
    const visited = journeyHexIds(links)
    return new Set(visited).size === visited.length
}

function startsAtPassenger(state: RideTheRailsGameState, links: readonly Link[]): boolean {
    const start = cityIn(links[0].hexIds[0])
    return start !== undefined && state.passengers.includes(start.id)
}

// R-3.3.1, R-3.3.2, R-3.3.3: the player need not hold shares in a railroad to use it.
export function journeyRefusal(
    state: RideTheRailsGameState,
    links: readonly Link[]
): JourneyRefusal | undefined {
    if (links.length === 0) {
        return 'no-links'
    }
    if (!links.every((link) => isLink(state.track, link))) {
        return 'not-a-link'
    }
    if (!linksMeet(links)) {
        return 'links-do-not-meet'
    }
    if (!startsAtPassenger(state, links)) {
        return 'no-passenger'
    }
    if (!visitsNoHexTwice(links)) {
        return 'hex-visited-twice'
    }
    return undefined
}

export function isLegalJourney(state: RideTheRailsGameState, links: readonly Link[]): boolean {
    return journeyRefusal(state, links) === undefined
}

// R-3.3.5: the cities visited, start and end included; one more than the links.
export function journeyCities(links: readonly Link[]): CityId[] {
    return [links[0].hexIds[0], ...links.map((link) => link.hexIds[link.hexIds.length - 1])].map(
        (hexId) => cityAt(hexId).id
    )
}

export function linksPerRailroad(links: readonly Link[]): LinksPerRailroad {
    const counts: LinksPerRailroad = {}
    for (const { railroadId } of links) {
        counts[railroadId] = (counts[railroadId] ?? 0) + 1
    }
    return counts
}

// R-3.3.4: $1 per link of a railroad, per share of it, to every player; R-3.3.5: the fare is links + 1.
export function journeyPayments(
    players: readonly RideTheRailsPlayerState[],
    riderId: string,
    links: readonly Link[]
): JourneyPayments {
    const counts = linksPerRailroad(links)
    const payments = players.map(({ playerId, shares }) => ({
        playerId,
        dividends: RAILROAD_IDS.reduce(
            (sum, railroadId) => sum + (counts[railroadId] ?? 0) * (shares[railroadId] ?? 0),
            0
        ),
        fare: playerId === riderId ? links.length + 1 : 0
    }))
    return { linksPerRailroad: counts, payments }
}

// R-3.3.4, R-3.3.5: what a journey pays one player, dividends and fare together.
export function paymentTotal({ dividends, fare }: JourneyPayment): number {
    return dividends + fare
}

// R-3.3.1: a search in one railroad's track from a city through non-city hexes to another city.
export function hasLinkFrom(track: Track, cityHexId: HexId, railroadId: RailroadId): boolean {
    if (!hasTrackIn(track, cityHexId, railroadId)) {
        return false
    }
    const reached = new Set<HexId>([cityHexId])
    const frontier: HexId[] = [cityHexId]
    for (let hexId = frontier.pop(); hexId !== undefined; hexId = frontier.pop()) {
        for (const next of adjacentHexIds(hexId)) {
            if (reached.has(next) || !hasTrackIn(track, next, railroadId)) {
                continue
            }
            if (isCityHex(next)) {
                return true
            }
            reached.add(next)
            frontier.push(next)
        }
    }
    return false
}

// R-3.3.1: one link is a journey, so the pass is legal only when no passenger city has a link out.
export function journeyExists(state: RideTheRailsGameState): boolean {
    return state.passengers.some((cityId) => {
        const { hexId } = cityById(cityId)
        return RAILROAD_IDS.some((railroadId) => hasLinkFrom(state.track, hexId, railroadId))
    })
}
