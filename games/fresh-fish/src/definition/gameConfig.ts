import * as Type from 'typebox'
import {
    assert,
    ConfigOptionType,
    type GameConfig,
    GameConfigOptions,
    ListConfigOption,
    NumberInputConfigOption
} from '@tabletop/common'

export enum RuleSet {
    Kyles = 'kyles',
    Classic = 'classic'
}

type Rules = { auctioneerWinsTie: boolean; forceThreeDisks: boolean }

const RULE_SETS: Record<RuleSet, Rules> = {
    [RuleSet.Kyles]: { auctioneerWinsTie: false, forceThreeDisks: true },
    [RuleSet.Classic]: { auctioneerWinsTie: true, forceThreeDisks: false }
}

const kylesDescription =
    'Each player places a disk on each of their first three turns. Auction ties are broken starting to the left of the auctioneer.'
const classicDescription =
    'Players may draw a tile once they have a disk on the board. Auction ties are broken starting with the auctioneer.'

const ruleSetOption: ListConfigOption = {
    id: 'ruleSet',
    type: ConfigOptionType.List,
    name: 'Rules',
    // Older site forms show only this, so it describes both rule sets.
    description: `Kyle's Rules: ${kylesDescription} Classic: ${classicDescription}`,
    default: RuleSet.Kyles,
    options: [
        { name: "Kyle's Rules", value: RuleSet.Kyles, description: kylesDescription },
        { name: 'Classic', value: RuleSet.Classic, description: classicDescription }
    ]
}

const boardSeedOption: NumberInputConfigOption = {
    id: 'boardSeed',
    type: ConfigOptionType.NumberInput,
    name: 'Board Seed',
    description: 'Seed a specific board layout',
    default: undefined,
    placeholder: 'seed value'
}

export type FreshFishGameConfig = Type.Static<typeof FreshFishGameConfig>
export const FreshFishGameConfig = Type.Object({
    ruleSet: Type.Enum(RuleSet, { default: RuleSet.Kyles }),
    diskRuleOverride: Type.Optional(Type.Boolean()),
    boardSeed: Type.Optional(Type.Number())
})

export const FreshFishGameConfigOptions: GameConfigOptions = [ruleSetOption, boardSeedOption]

export function auctioneerWinsTie(config: GameConfig): boolean {
    return RULE_SETS[ruleSetOf(config)].auctioneerWinsTie
}

export function forceThreeDisks(config: GameConfig): boolean {
    return (
        optionalBoolean(config.diskRuleOverride, 'Invalid disk rule') ??
        RULE_SETS[ruleSetOf(config)].forceThreeDisks
    )
}

export function normalizeFreshFishConfig(config: GameConfig): FreshFishGameConfig {
    // Games from before rule sets store the two rules directly. numTurnsWithDisksToStart
    // predates forceThreeDisks, and its games forced three disks.
    const {
        auctioneerWinsTie: tie,
        forceThreeDisks: disks,
        diskRuleOverride,
        numTurnsWithDisksToStart: _numTurnsWithDisksToStart,
        ...current
    } = config
    const storedTie = optionalBoolean(tie, 'Invalid tie rule')
    const storedDisks = optionalBoolean(disks ?? diskRuleOverride, 'Invalid disk rule')
    const stated = current.ruleSet ?? RuleSet.Kyles
    assert(isRuleSet(stated), 'Rules must be a known rule set')

    // Older site forms can add the default rule set to a legacy config, so stored rules win.
    const ruleSet =
        (storedTie ?? RULE_SETS[stated].auctioneerWinsTie) ? RuleSet.Classic : RuleSet.Kyles
    const forced = storedDisks ?? RULE_SETS[stated].forceThreeDisks
    return {
        ...current,
        ruleSet,
        ...(forced !== RULE_SETS[ruleSet].forceThreeDisks ? { diskRuleOverride: forced } : {})
    }
}

function optionalBoolean(value: GameConfig[string] | undefined, message: string) {
    assert(value === undefined || typeof value === 'boolean', message)
    return value
}

function ruleSetOf(config: GameConfig): RuleSet {
    const ruleSet = config.ruleSet
    assert(isRuleSet(ruleSet), 'Rules must be a known rule set')
    return ruleSet
}

function isRuleSet(value: unknown): value is RuleSet {
    return Object.values<unknown>(RuleSet).includes(value)
}
