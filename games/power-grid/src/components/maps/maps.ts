import { MapId, type GameMap } from './gameMap.js'
import { GERMANY } from './germany.js'

const MAPS: Record<MapId, GameMap> = {
    [MapId.Germany]: GERMANY
}

export function gameMap(id: MapId): GameMap {
    return MAPS[id]
}
