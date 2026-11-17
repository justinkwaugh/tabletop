import * as Type from 'typebox'
import {
    assertExists,
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'
import { MAP_DETAILS, MAP_IDS, MapId } from '../data/maps.js'

export type RideTheRailsGameConfig = Type.Static<typeof RideTheRailsGameConfig>
export const RideTheRailsGameConfig = Type.Object({
    map: Type.Optional(MapId)
})

// R-8.1: the base game's map, which every game stored before the option plays.
const DEFAULT_MAP: MapId = 'map.usa'

export const RideTheRailsGameConfigOptions: GameConfigOptions = [
    {
        id: 'map',
        type: ConfigOptionType.List,
        name: 'Map',
        // Older site forms show only this, so it describes every map.
        description: MAP_IDS.map(
            (mapId) => `${MAP_DETAILS[mapId].name}: ${MAP_DETAILS[mapId].description}`
        ).join(' '),
        default: DEFAULT_MAP,
        options: MAP_IDS.map((mapId) => ({
            name: MAP_DETAILS[mapId].name,
            value: mapId,
            description: MAP_DETAILS[mapId].description
        })),
        alwaysShow: true
    }
]

export class RideTheRailsConfigurator extends BaseConfigurator {
    schema = RideTheRailsGameConfig
    options = RideTheRailsGameConfigOptions
}

// R-8, R-X.3: the map a game is created on; a game that names none plays the USA.
export function mapFromConfig(config: GameConfig): MapId {
    if (config.map === undefined) return DEFAULT_MAP
    const mapId = MAP_IDS.find((known) => known === config.map)
    assertExists(mapId, `Unknown Ride the Rails map ${String(config.map)}`)
    return mapId
}
