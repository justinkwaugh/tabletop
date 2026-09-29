import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, ConfigOptionType, type GameConfig, type GameConfigOptions } from '@tabletop/common'
import { OathType } from '../model/oathEnums.js'
import { oathTypeName } from '../util/victory.js'
import { SetupVariant } from '../data/worldDeck.js'

export type OathGameConfig = Type.Static<typeof OathGameConfig>
export const OathGameConfig = Type.Object({
    /** R-1.1, R-1.21 */
    setupVariant: Type.Optional(Type.Enum(SetupVariant)),
    /** R-1.13, R-2.11, R-3 */
    oathType: Type.Optional(Type.Enum(OathType))
})

const OathGameConfigValidator = Compile(OathGameConfig)

export function readOathGameConfig(config: GameConfig | undefined): OathGameConfig {
    if (config === undefined) return {}
    assert(OathGameConfigValidator.Check(config), 'Game configuration is not a valid Oath setup')
    return config
}

export const OathGameConfigOptions: GameConfigOptions = [
    {
        id: 'setupVariant',
        type: ConfigOptionType.List,
        name: 'World Deck',
        description:
            'Random: nine denizens of each suit, drawn at random from all 198. ' +
            'Curated: a fixed set of 54 denizens chosen for a first game.',
        default: SetupVariant.Randomized,
        options: [
            { name: 'Random', value: SetupVariant.Randomized },
            { name: 'Curated', value: SetupVariant.Curated }
        ],
        alwaysShow: true
    },
    {
        id: 'oathType',
        type: ConfigOptionType.List,
        name: 'Oath',
        description:
            'The Oath the Chancellor has sworn, which decides how the Oathkeeper is chosen.',
        default: OathType.Supremacy,
        options: Object.values(OathType).map((oathType) => ({
            name: oathTypeName(oathType).replace(/^the /, ''),
            value: oathType
        })),
        alwaysShow: true
    }
]
