import { assertExists } from '@tabletop/common'
import { hexCoordinates, type HexId } from '../data/hexes.js'
import { RAILROAD_INTRODUCTIONS, type RailroadId, type StartRule } from '../data/railroads.js'
import type { City, CityId } from '../data/boardMap.js'
import { boardMap, cityIn, isLongDistance } from '../data/boardMaps.js'
import type { MapId } from '../data/maps.js'
import type { HydratedRideTheRailsGameState, Track } from '../model/gameState.js'
import { hasTrack, railroadsIn } from './track.js'

export const CHICAGO_CITY_ID: CityId = 'city.usa.chicago'

const WESTERNMOST_COUNT = 3

// R-8.5: Purple may start in Berlin.
const BERLIN_CITY_ID: CityId = 'city.de.berlin'

// R-4.2.3: Yellow's westernmost rule is the USA board's; no other map prints it.
const WESTERNMOST_MAP: MapId = 'map.usa'

export function isEastCoastCity(city: City): boolean {
    return city.groups.includes('east-coast')
}

export function isWestCoastCity(city: City): boolean {
    return city.groups.includes('west-coast')
}

// R-8.2: no railroad starts in a long-distance city (Perth, Brisbane): none prints a start colour
// there, and Black's start rule leaves it out.
export function noRailroadStartsIn(city: City): boolean {
    return isLongDistance(city.hexId)
}

// R-4.2.3: the occupied cities lowest in dcol, every city tied with the third included,
// whether or not it could take Yellow.
export function westernmostOccupiedCities(track: Track): CityId[] {
    const occupied = boardMap(WESTERNMOST_MAP)
        .cities.filter((city) => railroadsIn(track, city.hexId).length > 0)
        .map((city) => ({ cityId: city.id, ...hexCoordinates(city.hexId) }))
        .sort((a, b) => a.dcol - b.dcol || a.row - b.row)
    const third = occupied.at(WESTERNMOST_COUNT - 1)
    return occupied
        .filter((city) => third === undefined || city.dcol <= third.dcol)
        .map((city) => city.cityId)
}

// R-4.2: whether a placement here may be the railroad's start, its first locomotive. The placement
// test asks only when the hex is not adjacent to the railroad's own track (R-4.1.2), and checks
// capacity itself.
export function mayStartIn(
    state: HydratedRideTheRailsGameState,
    railroadId: RailroadId,
    hexId: HexId
): boolean {
    const city = cityIn(hexId)
    if (!city) {
        return false
    }
    return (
        !hasTrack(state.track, railroadId) &&
        cityFitsStartRule(startRuleOf(state, railroadId), city, railroadId, state.track)
    )
}

function startRuleOf(state: HydratedRideTheRailsGameState, railroadId: RailroadId): StartRule {
    const introduction = RAILROAD_INTRODUCTIONS[state.mapId].find(
        (candidate) => candidate.railroadId === railroadId
    )
    assertExists(introduction, `No start rule for ${railroadId} on ${state.mapId}`)
    return introduction.startRule
}

// R-4.2: whether the city meets the railroad's start rule, capacity aside.
export function cityFitsStartRule(
    startRule: StartRule,
    city: City,
    railroadId: RailroadId,
    track: Track
): boolean {
    switch (startRule) {
        // R-4.2.1: Red and Blue never share a city, which the East Coast capacity of 1 ensures.
        case 'east-coast-apart':
            return isEastCoastCity(city)
        // R-4.2.2
        case 'east-coast-or-chicago':
            return isEastCoastCity(city) || city.id === CHICAGO_CITY_ID
        // R-4.2.3: the set is read from the track before the placement.
        case 'chicago-or-westernmost':
            return (
                city.id === CHICAGO_CITY_ID ||
                (westernmostOccupiedCities(track).includes(city.id) &&
                    railroadsIn(track, city.hexId).length === 1)
            )
        // R-4.2.4
        case 'west-coast':
            return isWestCoastCity(city)
        // R-4.2.5: any city with room, which the placement test checks.
        case 'any-city':
            return true
        // R-8.2: as any-city, but never a long-distance city.
        case 'any-city-but-long-distance':
            return !noRailroadStartsIn(city)
        // R-4.2, R-8: an expansion map's introduction panel starts a railroad in a city printed in
        // its colour.
        case 'printed-colour':
            return city.startColours.includes(railroadId)
        // R-8.5: in a city of its colour, or in Berlin.
        case 'printed-colour-or-berlin':
            return city.startColours.includes(railroadId) || city.id === BERLIN_CITY_ID
    }
}
