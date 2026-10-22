import * as Type from 'typebox'
import {
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

export const LyngkGameConfigOptions: GameConfigOptions = [
    {
        id: 'variant',
        type: ConfigOptionType.List,
        name: 'Variant',
        description:
            'Standard: stacks of 5 with your color on top are removed and score a point. Stack of 6: stacks of 5 stay on the board, a joker also counts as white, and completing a stack of 6 with your color on top wins at once.',
        default: LyngkVariant.Standard,
        options: [
            { name: 'Standard', value: LyngkVariant.Standard },
            { name: 'Stack of 6', value: LyngkVariant.StackOfSix }
        ],
        alwaysShow: true
    }
]

export class LyngkConfigurator extends BaseConfigurator {
    schema = LyngkGameConfig
    options = LyngkGameConfigOptions
}

export function variantFromConfig(config: GameConfig): LyngkVariant {
    return (
        Object.values(LyngkVariant).find((variant) => variant === config.variant) ??
        LyngkVariant.Standard
    )
}
