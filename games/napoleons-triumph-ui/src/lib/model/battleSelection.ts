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
    commandersLeftOut: string[]
    retreating: true
}
export const defenceSelection = stagedSelection<DefenceValues>()([
    'defenders',
    'commandersLeftOut',
    'retreating'
])

export function nameDefenders(
    defence: DefenceSelection,
    unitIds: string[],
    commandersLeftOut: string[]
): DefenceSelection {
    return unitIds.length > 0
        ? leaveCommandersOut(
              defenceSelection.revise(defence, 'defenders', unitIds, 'manual'),
              commandersLeftOut
          )
        : defenceSelection.empty()
}

export function leaveCommandersOut(
    defence: DefenceSelection,
    commanderIds: string[]
): DefenceSelection {
    return commanderIds.length > 0
        ? defenceSelection.revise(defence, 'commandersLeftOut', commanderIds, 'manual')
        : defenceSelection.withdraw(defence, 'commandersLeftOut')
}

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

/**
 * How a retreat stands arranged: who takes its losses, where each unit goes, whom each commander keeps.
 * Deliberate: this is kept apart from the staged selection, as the open seat of a set-up is. Each
 * part is redone by another tap, so none is a step for Undo to take back.
 */
export interface RetreatArrangement {
    losses?: Record<string, number>
    /** Rule 12: where room is short the retreating player chooses who gets it, so the latest choice comes first. */
    destinations?: RetreatDestination[]
    kept?: Record<string, string>
}

export type RetreatValues = {
    /** The player has settled how the losses fall, so the panel has gone on to where the units go. */
    lossesTaken: true
    sentAlone: string
    /** The commander whose flag is picked up, waiting for the unit he is to stay with. */
    movingCommander: string
}
export const retreatSelection = stagedSelection<RetreatValues>()([
    'lossesTaken',
    'sentAlone',
    'movingCommander'
])

type RetreatSelection = StagedSelectionState<RetreatValues>

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
    retreatArrangement: RetreatArrangement
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
        retreatArrangement: {},
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
    undo: (selections) => {
        const retreat = retreatSelection.undo(selections.retreat)
        const backToTheLosses =
            retreatSelection.value(selections.retreat, 'lossesTaken') === true &&
            retreatSelection.value(retreat, 'lossesTaken') === undefined
        // Other losses can change who retreats, so where the units were sent does not survive them.
        return {
            ...selections,
            retreat,
            retreatArrangement: backToTheLosses
                ? { losses: selections.retreatArrangement.losses }
                : selections.retreatArrangement
        }
    }
}

export function setRetreatLosses(
    selections: BattleSelections,
    losses: Record<string, number>
): BattleSelections {
    return { ...selections, retreatArrangement: { ...selections.retreatArrangement, losses } }
}

export function takeRetreatLosses(selections: BattleSelections): BattleSelections {
    return {
        ...selections,
        retreat: retreatSelection.set(selections.retreat, 'lossesTaken', true, 'manual')
    }
}

export function sendRetreating(
    selections: BattleSelections,
    destinations: RetreatDestination[]
): BattleSelections {
    return {
        ...selections,
        retreat: retreatSelection.clearFrom(selections.retreat, 'sentAlone'),
        retreatArrangement: { ...selections.retreatArrangement, destinations }
    }
}

export function setKeptInCorps(
    selections: BattleSelections,
    kept: Record<string, string>
): BattleSelections {
    return {
        ...selections,
        retreat: retreatSelection.withdraw(selections.retreat, 'movingCommander'),
        retreatArrangement: { ...selections.retreatArrangement, kept }
    }
}

export function liftCommander(selections: BattleSelections, commanderId: string): BattleSelections {
    return {
        ...selections,
        retreat: retreatSelection.set(
            retreatSelection.withdraw(selections.retreat, 'sentAlone'),
            'movingCommander',
            commanderId,
            'manual'
        )
    }
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
