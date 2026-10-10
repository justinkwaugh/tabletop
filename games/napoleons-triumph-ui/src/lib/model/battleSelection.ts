import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { CommandKind } from '@tabletop/napoleons-triumph'
import { stagedSelection } from './stagedSelection.js'

export enum AttackWidth {
    Wide = 'Wide',
    Narrow = 'Narrow'
}

export type DefenceValues = {
    defenders: string[]
    leaders: string[]
    retreating: true
}
export const defenceSelection = stagedSelection<DefenceValues>()([
    'defenders',
    'leaders',
    'retreating'
])

export type RetreatValues = {
    losses: Record<string, number>
    destinations: Record<string, number>
    kept: Record<string, string>
    sentAlone: string
}
export const retreatSelection = stagedSelection<RetreatValues>()([
    'losses',
    'destinations',
    'kept',
    'sentAlone'
])

export type AttackerValues = {
    attackers: string[]
    command: CommandKind
    width: AttackWidth
    leaders: string[]
    struckLeader: string
}
export const attackerSelection = stagedSelection<AttackerValues>()([
    'attackers',
    'command',
    'width',
    'leaders',
    'struckLeader'
])

export type CounterValues = { counterAttackers: string[] }
export const counterSelection = stagedSelection<CounterValues>()(['counterAttackers'])

export type ExcessLossValues = { losses: Record<string, number> }
export const excessLossSelection = stagedSelection<ExcessLossValues>()(['losses'])

export type RegroupValues = { kept: Record<string, string> }
export const regroupSelection = stagedSelection<RegroupValues>()(['kept'])

export type AdvanceValues = {
    advancing: string[]
    commandersStaying: string[]
}
export const advanceSelection = stagedSelection<AdvanceValues>()(['advancing', 'commandersStaying'])

export interface BattleSelections {
    defence: StagedSelectionState<DefenceValues>
    retreat: StagedSelectionState<RetreatValues>
    attackers: StagedSelectionState<AttackerValues>
    counter: StagedSelectionState<CounterValues>
    excessLosses: StagedSelectionState<ExcessLossValues>
    regroup: StagedSelectionState<RegroupValues>
    advance: StagedSelectionState<AdvanceValues>
}

export function emptyBattleSelections(): BattleSelections {
    return {
        defence: defenceSelection.empty(),
        retreat: retreatSelection.empty(),
        attackers: attackerSelection.empty(),
        counter: counterSelection.empty(),
        excessLosses: excessLossSelection.empty(),
        regroup: regroupSelection.empty(),
        advance: advanceSelection.empty()
    }
}

export function hasManualBattleSelection(selections: BattleSelections): boolean {
    return (
        defenceSelection.hasManual(selections.defence) ||
        retreatSelection.hasManual(selections.retreat) ||
        attackerSelection.hasManual(selections.attackers) ||
        counterSelection.hasManual(selections.counter) ||
        excessLossSelection.hasManual(selections.excessLosses) ||
        regroupSelection.hasManual(selections.regroup) ||
        advanceSelection.hasManual(selections.advance)
    )
}

export function undoBattleSelection(selections: BattleSelections): BattleSelections {
    if (retreatSelection.hasManual(selections.retreat)) {
        return { ...selections, retreat: retreatSelection.undo(selections.retreat) }
    }
    return {
        ...selections,
        defence: defenceSelection.undo(selections.defence),
        attackers: attackerSelection.undo(selections.attackers),
        counter: counterSelection.undo(selections.counter),
        excessLosses: excessLossSelection.undo(selections.excessLosses),
        regroup: regroupSelection.undo(selections.regroup),
        advance: advanceSelection.undo(selections.advance)
    }
}
