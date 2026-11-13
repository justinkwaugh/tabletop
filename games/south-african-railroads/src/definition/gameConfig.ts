import * as Type from 'typebox'
import { ConfigOptionType, type GameConfigOptions } from '@tabletop/common'
import { MapId } from '../maps/types.js'

export type SarGameConfig = Type.Static<typeof SarGameConfig>
export const SarGameConfig = Type.Object({
    map: Type.Optional(Type.Enum(MapId))
})

export const SarGameConfigOptions: GameConfigOptions = [
    {
        id: 'map',
        type: ConfigOptionType.List,
        name: 'Map',
        description: 'Which map to play on',
        default: MapId.SouthAfrica,
        options: [
            { name: 'South African Railroads', value: MapId.SouthAfrica },
            { name: 'Pennsylvania Railroad', value: MapId.Pennsylvania },
            { name: 'Texas Special', value: MapId.TexasSpecial },
            { name: 'Veld Railroads', value: MapId.Veld }
        ],
        alwaysShow: true
    }
]
