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

export enum LyngkSetup {
    Random = 'Random',
    TakeTurns = 'TakeTurns',
    ISetYouStart = 'ISetYouStart'
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
    variant: Type.Optional(Type.Enum(LyngkVariant)),
    setup: Type.Optional(Type.Enum(LyngkSetup))
})

const standardDescription = 'Stacks of 5 with your color on top are removed and score a point.'
const stackOfSixDescription =
    'Stacks of 5 stay on the board, a joker also counts as white, and completing a stack of 6 with your color on top wins at once.'

const randomDescription = 'The pieces are dealt to the points at random, as the rules have it.'
const takeTurnsDescription =
    'Players take turns placing any piece on any empty point; the second player then moves first.'
const iSetYouStartDescription =
    'The first player places every piece; the other player then moves first.'

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
    },
    {
        id: 'setup',
        type: ConfigOptionType.List,
        name: 'Setup',
        description: `Random: ${randomDescription} Take turns: ${takeTurnsDescription} I set, you start: ${iSetYouStartDescription}`,
        default: LyngkSetup.Random,
        options: [
            { name: 'Random', value: LyngkSetup.Random, description: randomDescription },
            {
                name: 'Take turns',
                value: LyngkSetup.TakeTurns,
                description: takeTurnsDescription
            },
            {
                name: 'I set, you start',
                value: LyngkSetup.ISetYouStart,
                description: iSetYouStartDescription
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

export function setupFromConfig(config: GameConfig): LyngkSetup {
    if (config.setup === undefined) return LyngkSetup.Random
    const setup = Object.values(LyngkSetup).find((known) => known === config.setup)
    assertExists(setup, `Unknown LYNGK setup ${String(config.setup)}`)
    return setup
}
