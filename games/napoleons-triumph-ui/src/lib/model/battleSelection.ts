import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { CommandKind } from '@tabletop/napoleons-triumph'
import type { RideChoice } from './moveCommands.js'
import { stagedSelection } from './stagedSelection.js'

export enum StageKind {
    Defence = 'Defence',
    DefenceLeaders = 'DefenceLeaders',
    Retreat = 'Retreat',
    Feint = 'Feint',
    Declaration = 'Declaration',
    Occupation = 'Occupation',
    Counter = 'Counter',
    OddLoss = 'OddLoss',
    ExcessLosses = 'ExcessLosses',
    Regroup = 'Regroup',
    Advance = 'Advance'
}

export enum AttackWidth {
    Wide = 'Wide',
    Narrow = 'Narrow'
}

export type DefenceValues = {
    defenders: string[]
    retreating: true
}
export const defenceSelection = stagedSelection<DefenceValues>()(['defenders', 'retreating'])

export type LeadValues = { leaders: string[] }
export const leadSelection = stagedSelection<LeadValues>()(['leaders'])

type DefenceSelection = StagedSelectionState<DefenceValues>

export function chooseRetreat(defence: DefenceSelection): DefenceSelection {
    return defenceSelection.set(defence, 'retreating', true, 'manual')
}

export interface RetreatDestination {
    unitId: string
    locale: number
}

export type RetreatValues = {
    losses: Record<string, number>
    /** Rule 12: where room is short the retreating player chooses who gets it, so the latest choice comes first. */
    destinations: RetreatDestination[]
    kept: Record<string, string>
    sentAlone: string
}
export const retreatSelection = stagedSelection<RetreatValues>()([
    'losses',
    'destinations',
    'kept',
    'sentAlone'
])

type RetreatSelection = StagedSelectionState<RetreatValues>

export function setRetreatLosses(
    retreat: RetreatSelection,
    losses: Record<string, number>
): RetreatSelection {
    return retreatSelection.revise(retreat, 'losses', losses, 'manual')
}

export function sendRetreating(
    retreat: RetreatSelection,
    destinations: RetreatDestination[]
): RetreatSelection {
    const sent = retreatSelection.revise(retreat, 'destinations', destinations, 'manual')
    return retreatSelection.withdraw(sent, 'sentAlone')
}

export function setKeptInCorps(
    retreat: RetreatSelection,
    kept: Record<string, string>
): RetreatSelection {
    return retreatSelection.revise(retreat, 'kept', kept, 'manual')
}

export type AttackerValues = {
    feinting: true
    attackers: string[]
    ride: RideChoice
    command: CommandKind
    leaders: string[]
    width: AttackWidth
    struckLeader: string
}
export const attackerSelection = stagedSelection<AttackerValues>()([
    'feinting',
    'attackers',
    'ride',
    'command',
    'leaders',
    'width',
    'struckLeader'
])

type AttackerSelection = StagedSelectionState<AttackerValues>

export function chooseFeint(attackers: AttackerSelection): AttackerSelection {
    return attackerSelection.set(attackers, 'feinting', true, 'manual')
}

export function setAttackCommand(
    attackers: AttackerSelection,
    kind: CommandKind
): AttackerSelection {
    return attackerSelection.revise(attackers, 'command', kind, 'manual')
}

export function setAttackRide(attackers: AttackerSelection, ride: RideChoice): AttackerSelection {
    return attackerSelection.revise(attackers, 'ride', ride, 'manual')
}

export function setAttackWidth(
    attackers: AttackerSelection,
    width: AttackWidth
): AttackerSelection {
    return attackerSelection.revise(attackers, 'width', width, 'manual')
}

export function nameAttackers(attackers: AttackerSelection, unitIds: string[]): AttackerSelection {
    return attackerSelection.revise(attackers, 'attackers', unitIds, 'manual')
}

export function nameLeaders(attackers: AttackerSelection, leaderIds: string[]): AttackerSelection {
    return leaderIds.length > 0
        ? attackerSelection.revise(attackers, 'leaders', leaderIds, 'manual')
        : attackerSelection.withdraw(attackers, 'leaders')
}

export function setStruckLeader(attackers: AttackerSelection, unitId: string): AttackerSelection {
    return attackerSelection.set(attackers, 'struckLeader', unitId, 'manual')
}

export type CounterValues = { counterAttackers: string[] }
export const counterSelection = stagedSelection<CounterValues>()(['counterAttackers'])

export type ExcessLossValues = { losses: Record<string, number> }
export const excessLossSelection = stagedSelection<ExcessLossValues>()(['losses'])

export type RegroupValues = { kept: Record<string, string> }
export const regroupSelection = stagedSelection<RegroupValues>()(['kept'])

export type AdvanceValues = {
    advancing: string[]
    commandersGoing: string[]
}
export const advanceSelection = stagedSelection<AdvanceValues>()(['advancing', 'commandersGoing'])

type AdvanceSelection = StagedSelectionState<AdvanceValues>

export function setCommandersGoing(
    advance: AdvanceSelection,
    commanderIds: string[]
): AdvanceSelection {
    return advanceSelection.set(advance, 'commandersGoing', commanderIds, 'manual')
}

export interface BattleSelections {
    defence: DefenceSelection
    lead: StagedSelectionState<LeadValues>
    retreat: RetreatSelection
    attackers: AttackerSelection
    counter: StagedSelectionState<CounterValues>
    excessLosses: StagedSelectionState<ExcessLossValues>
    regroup: StagedSelectionState<RegroupValues>
    advance: AdvanceSelection
}

export function emptyBattleSelections(): BattleSelections {
    return {
        defence: defenceSelection.empty(),
        lead: leadSelection.empty(),
        retreat: retreatSelection.empty(),
        attackers: attackerSelection.empty(),
        counter: counterSelection.empty(),
        excessLosses: excessLossSelection.empty(),
        regroup: regroupSelection.empty(),
        advance: advanceSelection.empty()
    }
}

interface StepSelection {
    hasManual(selections: BattleSelections): boolean
    undo(selections: BattleSelections): BattleSelections
}

const DEFENCE: StepSelection = {
    hasManual: (selections) => defenceSelection.hasManual(selections.defence),
    undo: (selections) => ({ ...selections, defence: defenceSelection.undo(selections.defence) })
}

const LEAD: StepSelection = {
    hasManual: (selections) => leadSelection.hasManual(selections.lead),
    undo: (selections) => ({ ...selections, lead: leadSelection.undo(selections.lead) })
}

const RETREAT: StepSelection = {
    hasManual: (selections) => retreatSelection.hasManual(selections.retreat),
    undo: (selections) => ({ ...selections, retreat: retreatSelection.undo(selections.retreat) })
}

const ATTACKERS: StepSelection = {
    hasManual: (selections) => attackerSelection.hasManual(selections.attackers),
    undo: (selections) => ({
        ...selections,
        attackers: attackerSelection.undo(selections.attackers)
    })
}

const COUNTER: StepSelection = {
    hasManual: (selections) => counterSelection.hasManual(selections.counter),
    undo: (selections) => ({ ...selections, counter: counterSelection.undo(selections.counter) })
}

const EXCESS_LOSSES: StepSelection = {
    hasManual: (selections) => excessLossSelection.hasManual(selections.excessLosses),
    undo: (selections) => ({
        ...selections,
        excessLosses: excessLossSelection.undo(selections.excessLosses)
    })
}

const REGROUP: StepSelection = {
    hasManual: (selections) => regroupSelection.hasManual(selections.regroup),
    undo: (selections) => ({ ...selections, regroup: regroupSelection.undo(selections.regroup) })
}

const ADVANCE: StepSelection = {
    hasManual: (selections) => advanceSelection.hasManual(selections.advance),
    undo: (selections) => ({ ...selections, advance: advanceSelection.undo(selections.advance) })
}

const SELECTIONS_BY_STEP_EARLIEST_FIRST: Record<StageKind, readonly StepSelection[]> = {
    [StageKind.Defence]: [DEFENCE],
    [StageKind.DefenceLeaders]: [LEAD],
    [StageKind.Retreat]: [DEFENCE, RETREAT],
    [StageKind.Feint]: [ATTACKERS],
    [StageKind.Declaration]: [ATTACKERS],
    [StageKind.Occupation]: [ATTACKERS],
    [StageKind.Counter]: [COUNTER],
    [StageKind.OddLoss]: [],
    [StageKind.ExcessLosses]: [EXCESS_LOSSES],
    [StageKind.Regroup]: [REGROUP],
    [StageKind.Advance]: [ADVANCE]
}

export function hasManualBattleSelection(selections: BattleSelections, step: StageKind): boolean {
    return SELECTIONS_BY_STEP_EARLIEST_FIRST[step].some((selection) =>
        selection.hasManual(selections)
    )
}

export function undoBattleSelection(
    selections: BattleSelections,
    step: StageKind
): BattleSelections {
    const latest = SELECTIONS_BY_STEP_EARLIEST_FIRST[step].findLast((selection) =>
        selection.hasManual(selections)
    )
    return latest ? latest.undo(selections) : selections
}
