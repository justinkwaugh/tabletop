import type { BoardMap, CityId } from '../data/boardMap.js'
import type { HexId } from '../data/hexes.js'
import type { RailroadId } from '../data/railroads.js'
import type { Track } from '../model/gameState.js'
import { hasTrackIn, railroadsIn } from './track.js'

// R-8 (Intercolonial, Greater Germany): every named city reaches every other through complete
// links (R-3.3.2) of any railroads, so the railroad changes only in cities.
export function citiesConnected(map: BoardMap, track: Track, cityIds: readonly CityId[]): boolean {
    const [first, ...rest] = cityIds
    if (first === undefined) {
        return true
    }
    const reached = new Set<CityId>([first])
    const frontier: CityId[] = [first]
    for (let cityId = frontier.pop(); cityId !== undefined; cityId = frontier.pop()) {
        for (const next of linkedCities(map, track, cityId)) {
            if (!reached.has(next)) {
                reached.add(next)
                frontier.push(next)
            }
        }
    }
    return rest.every((cityId) => reached.has(cityId))
}

// R-3.3.2: the cities one link of any railroad joins to this one.
function linkedCities(map: BoardMap, track: Track, cityId: CityId): CityId[] {
    const cityHexId = map.city(cityId).hexId
    return railroadsIn(track, cityHexId).flatMap((railroadId) =>
        linkEnds(map, track, railroadId, cityHexId)
    )
}

// R-3.3.2: a search in one railroad's track from a city through non-city hexes to the next cities.
function linkEnds(map: BoardMap, track: Track, railroadId: RailroadId, cityHexId: HexId): CityId[] {
    const ends: CityId[] = []
    const reached = new Set<HexId>([cityHexId])
    const frontier: HexId[] = [cityHexId]
    for (let hexId = frontier.pop(); hexId !== undefined; hexId = frontier.pop()) {
        for (const next of map.adjacentHexIds(hexId)) {
            if (reached.has(next) || !hasTrackIn(track, next, railroadId)) {
                continue
            }
            reached.add(next)
            const city = map.cityIn(next)
            if (city) {
                ends.push(city.id)
            } else {
                frontier.push(next)
            }
        }
    }
    return ends
}
