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

export enum FirstPlayer {
    Random = 'Random',
    Creator = 'Creator',
    Opponent = 'Opponent'
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
    setup: Type.Optional(Type.Enum(LyngkSetup)),
    firstPlayer: Type.Optional(Type.Enum(FirstPlayer))
})

const standardDescription = 'Stacks of 5 with your color on top are removed and score a point.'
const stackOfSixDescription =
    'Stacks of 5 stay on the board, a joker also counts as white, and completing a stack of 6 with your color on top wins at once.'

const randomDescription =
    'The pieces are dealt to the points at random, as the rules have it, and the first player moves first.'
const takeTurnsDescription =
    'Starting with the first player, players take turns placing any piece on any empty point; the other player then makes the first move.'
const iSetYouStartDescription =
    'The first player places every piece; the other player then makes the first move.'

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
    },
    {
        id: 'firstPlayer',
        type: ConfigOptionType.List,
        name: 'First player',
        description:
            'Who makes the first move, or with Take turns or I set, you start places the first piece.',
        default: FirstPlayer.Random,
        options: [
            {
                name: 'Random',
                value: FirstPlayer.Random,
                description: 'The first player is drawn by lot.'
            },
            {
                name: 'Game creator',
                value: FirstPlayer.Creator,
                description: 'The player who created the game goes first.'
            },
            {
                name: 'Opponent',
                value: FirstPlayer.Opponent,
                description: "The creator's opponent goes first."
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

export function firstPlayerFromConfig(config: GameConfig): FirstPlayer {
    if (config.firstPlayer === undefined) return FirstPlayer.Random
    const choice = Object.values(FirstPlayer).find((known) => known === config.firstPlayer)
    assertExists(choice, `Unknown choice of first player ${String(config.firstPlayer)}`)
    return choice
}
