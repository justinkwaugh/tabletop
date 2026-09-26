import * as Type from 'typebox'
import { assert, type GameConfig, type GameConfigOptions, ConfigOptionType } from '@tabletop/common'

export type LowenherzGameConfig = Type.Static<typeof LowenherzGameConfig>
export const LowenherzGameConfig = Type.Object({
    privateMoney: Type.Boolean({ default: false }),
    standardSetup: Type.Boolean({ default: false }),
    allowZeroDucatOffers: Type.Boolean({ default: false })
})

export const LowenherzGameConfigOptions: GameConfigOptions = [
    {
        id: 'privateMoney',
        type: ConfigOptionType.Boolean,
        name: 'Private money',
        description: 'Keep balances private until the end of the game.',
        default: false
    },
    {
        id: 'standardSetup',
        type: ConfigOptionType.Boolean,
        name: 'Standard rulebook setup',
        description:
            'Begin from the fixed board layout printed in the rulebook instead of players placing their own castles and knights. Ignored in a 2-player game, whose variant is built on player placement.',
        default: false
    },
    {
        id: 'allowZeroDucatOffers',
        type: ConfigOptionType.Boolean,
        name: 'Allow zero-ducat offers',
        description: 'Allow negotiation offers of zero ducats.',
        default: false
    }
]

export function normalizeLowenherzConfig(config: GameConfig): LowenherzGameConfig {
    const { publicMoney, playerPlacedCastles, minimumOneDucat, ...current } = config
    return {
        ...current,
        privateMoney: resolveBooleanOption(current.privateMoney, publicMoney),
        standardSetup: resolveBooleanOption(current.standardSetup, playerPlacedCastles),
        allowZeroDucatOffers: resolveBooleanOption(current.allowZeroDucatOffers, minimumOneDucat)
    }
}

function resolveBooleanOption(
    current: GameConfig[string] | undefined,
    legacy: GameConfig[string] | undefined
): boolean {
    // Older site forms can add current defaults to legacy configs without translating them.
    const value = legacy ?? current ?? false
    assert(typeof value === 'boolean', 'Configuration option must be a boolean')
    return legacy !== undefined && legacy !== null ? !value : value
}
