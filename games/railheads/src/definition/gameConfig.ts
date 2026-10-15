import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ConfigOptionType, assert, type GameConfig, type GameConfigOptions } from '@tabletop/common'
import { EditionId } from '../editions/types.js'

export type RailheadsGameConfig = Type.Static<typeof RailheadsGameConfig>
export const RailheadsGameConfig = Type.Object({
    edition: Type.Optional(Type.Enum(EditionId)),
    offTheRails: Type.Optional(Type.Boolean())
})

export const RailheadsGameConfigValidator = Compile(RailheadsGameConfig)

export type RailheadsSetup = { editionId: EditionId; offTheRails: boolean }

export function readRailheadsSetup(config: GameConfig): RailheadsSetup {
    assert(
        RailheadsGameConfigValidator.Check(config),
        'Game configuration is not a Railheads setup'
    )
    return {
        editionId: config.edition ?? EditionId.Germany,
        offTheRails: config.offTheRails ?? false
    }
}

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
