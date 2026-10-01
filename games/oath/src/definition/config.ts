import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { assert, ConfigOptionType, type GameConfig, type GameConfigOptions } from '@tabletop/common'
import { OathType, SetupVariant } from '../model/oathEnums.js'

export type OathGameConfig = Type.Static<typeof OathGameConfig>
export const OathGameConfig = Type.Object({
    /** R-1.1, R-1.21 */
    setupVariant: Type.Optional(Type.Enum(SetupVariant)),
    /** R-1.13, R-2.11, R-3 */
    oathType: Type.Optional(Type.Enum(OathType))
})

/** R-1.13 */
export const OATH_NAMES: Readonly<Record<OathType, string>> = {
    [OathType.Supremacy]: 'Oath of Supremacy',
    [OathType.ThePeople]: 'Oath of the People',
    [OathType.Devotion]: 'Oath of Devotion',
    [OathType.Protection]: 'Oath of Protection'
}

export const OathGameConfigOptions: GameConfigOptions = [
    {
        id: 'setupVariant',
        type: ConfigOptionType.List,
        name: 'World Deck',
        description: 'Random: nine denizens of each suit, drawn at random from all 198.',
        default: SetupVariant.Randomized,
        options: [{ name: 'Random', value: SetupVariant.Randomized }],
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
            name: OATH_NAMES[oathType],
            value: oathType
        })),
        alwaysShow: true
    }
]

// The retired fixed 54-card deck: a stored setup still waiting to start begins with a random one.
const RETIRED_FIXED_DECK = 'curated'

export function normalizeOathConfig(config: GameConfig): OathGameConfig {
    const normalized =
        config.setupVariant === RETIRED_FIXED_DECK
            ? { ...config, setupVariant: SetupVariant.Randomized }
            : config
    assert(
        Value.Check(OathGameConfig, normalized),
        `Not an Oath configuration: ${JSON.stringify(config)}`
    )
    return normalized
}
