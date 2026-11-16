import * as Type from 'typebox'
import {
    assertExists,
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'

export enum LyngkVariant {
    Standard = 'Standard',
    StackOfSix = 'StackOfSix'
}

export type VariantRules = {
    maxHeight: number
    removesCompletedStacks: boolean
}

export const VARIANT_RULES: Record<LyngkVariant, VariantRules> = {
    [LyngkVariant.Standard]: { maxHeight: 5, removesCompletedStacks: true },
    [LyngkVariant.StackOfSix]: { maxHeight: 6, removesCompletedStacks: false }
}

export type LyngkGameConfig = Type.Static<typeof LyngkGameConfig>
export const LyngkGameConfig = Type.Object({
    variant: Type.Optional(Type.Enum(LyngkVariant))
})

const standardDescription = 'Stacks of 5 with your color on top are removed and score a point.'
const stackOfSixDescription =
    'Stacks of 5 stay on the board, a joker also counts as white, and completing a stack of 6 with your color on top wins at once.'

export const LyngkGameConfigOptions: GameConfigOptions = [
    {
        id: 'variant',
        type: ConfigOptionType.List,
        name: 'Variant',
        // Older site forms show only this, so it describes every variant.
        description: `Standard: ${standardDescription} Stack of 6: ${stackOfSixDescription}`,
        default: LyngkVariant.Standard,
        options: [
            { name: 'Standard', value: LyngkVariant.Standard, description: standardDescription },
            {
                name: 'Stack of 6',
                value: LyngkVariant.StackOfSix,
                description: stackOfSixDescription
            }
        ],
        alwaysShow: true
    }
]

export class LyngkConfigurator extends BaseConfigurator {
    schema = LyngkGameConfig
    options = LyngkGameConfigOptions
}

export function variantFromConfig(config: GameConfig): LyngkVariant {
    if (config.variant === undefined) return LyngkVariant.Standard
    const variant = Object.values(LyngkVariant).find((known) => known === config.variant)
    assertExists(variant, `Unknown LYNGK variant ${String(config.variant)}`)
    return variant
}
