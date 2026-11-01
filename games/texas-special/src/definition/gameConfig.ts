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
        default: MapId.TexasSpecial,
        // Only Texas Special is offered for now. The other maps are withheld until a later
        // release; their maps, rules and tests stay complete, so offering one again only needs its
        // entry restored here:
        // { name: 'Frontier Railroads', value: MapId.Frontier },
        // { name: 'Keystone Railroads', value: MapId.Keystone },
        // { name: 'Old Frontier Railroads', value: MapId.OldFrontier },
        // { name: 'SAR', value: MapId.SouthAfrica }
        options: [{ name: 'Texas Special', value: MapId.TexasSpecial }],
        alwaysShow: true
    }
]
