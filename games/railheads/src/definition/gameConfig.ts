import * as Type from 'typebox'
import { ConfigOptionType, type GameConfigOptions } from '@tabletop/common'
import { EditionId } from '../editions/types.js'

export type RailheadsGameConfig = Type.Static<typeof RailheadsGameConfig>
export const RailheadsGameConfig = Type.Object({
    edition: Type.Optional(Type.Enum(EditionId)),
    offTheRails: Type.Optional(Type.Boolean())
})

export const RailheadsGameConfigOptions: GameConfigOptions = [
    {
        id: 'edition',
        type: ConfigOptionType.List,
        name: 'Map',
        description: 'Which title of the Railheads series to play',
        default: EditionId.Germany,
        options: [{ name: 'Germany', value: EditionId.Germany }],
        alwaysShow: true
    },
    {
        id: 'offTheRails',
        type: ConfigOptionType.Boolean,
        name: 'Off the Rails',
        description:
            'Track reaching an Industry Site may raise the industry two steps instead, leaving the company’s revenue unchanged',
        default: false
    }
]
