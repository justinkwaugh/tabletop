import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { assert, type GameConfig, type GameConfigOptions } from '@tabletop/common'
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

// No game options: a first game is the Oath of Supremacy (R-1.13) on a random deck (R-1.21), and a
// continued game plays the Oath its winner vowed (R-8.1). A stored config may still name either.
export const OathGameConfigOptions: GameConfigOptions = []

// The retired fixed 54-card deck: a stored setup still waiting to start begins with a random one.

export function normalizeOathConfig(config: GameConfig): OathGameConfig {
    const normalized =
        config.setupVariant === SetupVariant.Curated
            ? { ...config, setupVariant: SetupVariant.Randomized }
            : config
    assert(
        Value.Check(OathGameConfig, normalized),
        `Not an Oath configuration: ${JSON.stringify(config)}`
    )
    return normalized
}
