import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'
import { MapId } from '../components/maps/gameMap.js'

export type PowerGridGameConfig = Type.Static<typeof PowerGridGameConfig>
export const PowerGridGameConfig = Type.Object({
    map: Type.Optional(Type.Enum(MapId))
})

export const PowerGridGameConfigOptions: GameConfigOptions = [
    {
        id: 'map',
        type: ConfigOptionType.List,
        name: 'Map',
        description: 'The board to play on; the play area is a random group of adjacent regions',
        default: MapId.Germany,
        options: [
            {
                name: 'Germany',
                value: MapId.Germany,
                description:
                    'The original Funkenschlag map; uranium is phased out once plant 39 is bought'
            }
        ],
        alwaysShow: true
    }
]

export class PowerGridConfigurator extends BaseConfigurator {
    schema = PowerGridGameConfig
    options = PowerGridGameConfigOptions
}

export function configuredMap(config: GameConfig): MapId {
    return Object.values(MapId).find((id) => id === config.map) ?? MapId.Germany
}
