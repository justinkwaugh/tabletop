import { assertExists } from '@tabletop/common'
import {
    BoardMap,
    type City,
    type CityId,
    type Hex,
    type HexCapacity,
    type HexGroup
} from './boardMap.js'
import { mapKeyOfHex, type HexId } from './hexes.js'
import { AUSTRALIA_MAP } from './australiaMap.js'
import { CANADA_MAP } from './canadaMap.js'
import { FRANCE_MAP } from './franceMap.js'
import { GERMANY_MAP } from './germanyMap.js'
import { MAP_KEY_OF, type MapId, type MapKey } from './maps.js'
import { USA_MAP } from './usaMap.js'

// R-8: every map the code knows; an expansion map adds its own row.
export const BOARD_MAPS: Readonly<Record<MapId, BoardMap>> = {
    'map.usa': new BoardMap(USA_MAP),
    'map.au': new BoardMap(AUSTRALIA_MAP),
    'map.ca': new BoardMap(CANADA_MAP),
    'map.fr': new BoardMap(FRANCE_MAP),
    'map.de': new BoardMap(GERMANY_MAP)
}

export function boardMap(mapId: MapId): BoardMap {
    return BOARD_MAPS[mapId]
}

const MAPS_BY_KEY: ReadonlyMap<MapKey, BoardMap> = new Map(
    Object.values(BOARD_MAPS).map((map) => [MAP_KEY_OF[map.id], map])
)

// A hex or city id names its map, so the lookups below need no map id.
function mapByKey(mapKey: MapKey): BoardMap {
    const map = MAPS_BY_KEY.get(mapKey)
    assertExists(map, `No map has the key ${mapKey}`)
    return map
}

function mapOfHex(hexId: HexId): BoardMap {
    return mapByKey(mapKeyOfHex(hexId))
}

function mapOfCity(cityId: CityId): BoardMap {
    const map = Object.values(BOARD_MAPS).find((candidate) => candidate.hasCity(cityId))
    assertExists(map, `No map has the city ${cityId}`)
    return map
}

// Whether a hex of some map has this id.
export function isHexId(value: string): value is HexId {
    return Object.values(BOARD_MAPS).some((map) => map.hasHex(value))
}

// The map a hex id belongs to.
export function mapIdOfHex(hexId: HexId): MapId {
    return mapOfHex(hexId).id
}

export function hexById(hexId: HexId): Hex {
    return mapOfHex(hexId).hex(hexId)
}

export function cityById(cityId: CityId): City {
    return mapOfCity(cityId).city(cityId)
}

export function isCityHex(hexId: HexId): boolean {
    return hexById(hexId).terrain === 'city'
}

export function cityIn(hexId: HexId): City | undefined {
    return mapOfHex(hexId).cityIn(hexId)
}

export function cityAt(hexId: HexId): City {
    const city = cityIn(hexId)
    assertExists(city, `Hex ${hexId} is not a city`)
    return city
}

// The hexes of the hex's map in reading order: a pointy map's rows north to south, columns west
// to east; a flat map's doubled rows north to south, columns west to east.
export function hexOrder(hexId: HexId): number {
    return mapOfHex(hexId).hexOrder(hexId)
}

// R-4.1.2: the hexes next to this one that exist on the board, an impassable side apart (R-8).
export function adjacentHexIds(hexId: HexId): readonly HexId[] {
    return mapOfHex(hexId).adjacentHexIds(hexId)
}

// R-4.1.4: 2 locomotives, 1 in an East Coast city, no limit in Chicago; R-8 the expansion hexes.
export function hexCapacity(hexId: HexId): HexCapacity {
    return mapOfHex(hexId).capacity(hexId)
}

// R-8.2: a long-distance hex or city (Perth, Brisbane).
export function isLongDistance(hexId: HexId): boolean {
    return mapOfHex(hexId).isLongDistance(hexId)
}

export function groupsOf(hexId: HexId): readonly HexGroup[] {
    return mapOfHex(hexId).groupsOf(hexId)
}
