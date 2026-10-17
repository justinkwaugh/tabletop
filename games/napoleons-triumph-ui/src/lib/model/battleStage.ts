import { assert, assertExists } from '@tabletop/common'
import {
    DecisionKind,
    FeintEnd,
    MachineState,
    attackerLeadsInitially,
    canPressAttack,
    checkAttackDeclaration,
    checkDefenseLeaders,
    counterAttackAccountWith,
    counterAttackCandidates,
    declareDefense,
    declareFeint,
    eligibleReserveDefenders,
    finalResultWith,
    forcedDefense,
    initialAccountOf,
    initialResultOf,
    isLegal,
    nextDecision,
    occupyAfterRetreat,
    resolveAttackOrders,
    samePosition,
    validateCounterAttackers,
    whyIllegal,
    type Attack,
    type CommandKind,
    type HydratedNapoleonsTriumphGameState,
    type EndedAttack,
    type MoveOrder,
    type ThreatOrder,
    type ProjectedUnit,
    type ResultTerm
} from '@tabletop/napoleons-triumph'
import {
    attackCommand,
    attackerGroups,
    rideInOrders,
    type AttackerGroup
} from './attackCommands.js'
import {
    AttackWidth,
    StageKind,
    advanceSelection,
    attackerSelection,
    counterSelection,
    defenceSelection,
    excessLossSelection,
    leadSelection,
    nameAttackers,
    nameLeaders,
    regroupSelection,
    retreatSelection,
    setCommandersGoing,
    liftCommander,
    setKeptInCorps,
    sendRetreating,
    setStruckLeader,
    setRetreatLosses,
    type BattleSelections
} from './battleSelection.js'
import type { StagedSelectionState } from '@tabletop/frontend-components'
import { sameIds } from '$lib/utils/ids.js'
import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import type { SingledOut } from '$lib/utils/pieceLayout.js'
import { RideChoice } from './moveCommands.js'
import { movableCommander, retreatPlan, strengthOf, type RetreatPlan } from './retreatPlan.js'
import type { StagedSelection } from './stagedSelection.js'
import { copyOf } from './stateCopy.js'

export type VisibleAttack = Omit<Attack, 'defensePlan' | 'attackPlan'> & {
    attackPlan?: { order?: ThreatOrder }
    defensePlan?: { playerId: string }
}

export enum BattleRole {
    Defends = 'defends',
    Leads = 'leads',
    Attacks = 'attacks',
    CounterAttacks = 'counter-attacks',
    Advances = 'advances',
    RetreatsAlone = 'goes alone',
    PassedBy = 'passed by'
}

interface Picking {
    pickableIds: string[]
    roles: Record<string, BattleRole>
}

export interface DefenceStage extends Picking {
    kind: StageKind.Defence
    /** Pieces block the approach, so they all defend and cannot retreat. The game names them itself; this is only met in an attack that was already waiting on its defender before it did. */
    forced: boolean
    candidates: ProjectedUnit[]
    defenders: string[]
    problem?: string
}

/** Rule 11, step 4: the attack has been pressed, and the defender names which of the defending pieces lead. */
export interface DefenceLeadersStage extends Picking {
    kind: StageKind.DefenceLeaders
    defenders: ProjectedUnit[]
    leaders: string[]
    leaderLimit: number
    problem?: string
}

export interface RetreatStage extends Picking {
    kind: StageKind.Retreat
    plan: RetreatPlan
    /** The losses can fall more than one way and are still to be settled, before where the units go. */
    choosingLosses: boolean
    movingCommander?: string
    alone?: string
}

interface AttackerPicking extends Picking {
    groups: AttackerGroup[]
    attackers: string[]
    ride?: RideChoice
    commandOptions: CommandKind[]
    command?: CommandKind
    orders?: MoveOrder[]
}

export interface FeintStage extends AttackerPicking {
    kind: StageKind.Feint
    canPress: boolean
    /** An attack whose defence named its leading units with its pieces: pressing it turns them face-up at once. */
    pressShowsLeaders: boolean
    feinting: boolean
    ends: FeintEnd[]
}

export interface DeclarationStage extends AttackerPicking {
    kind: StageKind.Declaration
    startsFromThreat: boolean
    leaders: string[]
    approachWide: boolean
    wide: boolean
    firesAsAPair: boolean
    targetOptions: string[]
    target?: string
    problem?: string
    initialResult?: number
    initialAccount?: ResultTerm[]
}

export interface OccupationStage extends AttackerPicking {
    kind: StageKind.Occupation
    mayMoveIn: boolean
    byRoad: boolean
    roadOrders?: MoveOrder[]
    gunsMayStay: boolean
}

export interface CounterStage extends Picking {
    kind: StageKind.Counter
    candidates: ProjectedUnit[]
    counterAttackers: string[]
    attackWinning: boolean
    finalResult: number
    counterAccount: ResultTerm[]
    problem?: string
}

export interface OddLossStage extends Picking {
    kind: StageKind.OddLoss
    units: ProjectedUnit[]
}

export interface ExcessLossStage extends Picking {
    kind: StageKind.ExcessLosses
    amount: number
    units: ProjectedUnit[]
    losses: Record<string, number>
    assigned: number
}

export interface RegroupStage extends Picking {
    kind: StageKind.Regroup
    corps: { commanderId: string; units: ProjectedUnit[]; keptId: string }[]
}

export interface AdvanceStage extends Picking {
    kind: StageKind.Advance
    units: ProjectedUnit[]
    advancing: string[]
    commanders: { commanderId: string; goes: boolean; mustGo: boolean; unitsStaying: number }[]
}

export type BattleStage =
    | DefenceStage
    | DefenceLeadersStage
    | RetreatStage
    | FeintStage
    | DeclarationStage
    | OccupationStage
    | CounterStage
    | OddLossStage
    | ExcessLossStage
    | RegroupStage
    | AdvanceStage

function idsOf(units: readonly ProjectedUnit[]): string[] {
    return units.map((unit) => unit.id)
}

function rolesOf(
    picked: readonly string[],
    leaders: readonly string[],
    role: BattleRole
): Record<string, BattleRole> {
    return Object.fromEntries(
        picked.map((id) => [id, leaders.includes(id) ? BattleRole.Leads : role])
    )
}

function toggled(list: readonly string[], id: string, limit = Number.POSITIVE_INFINITY): string[] {
    return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id].slice(-limit)
}

function defenceStage(
    state: HydratedNapoleonsTriumphGameState,
    selections: BattleSelections
): DefenceStage {
    const blockers = forcedDefense(state)
    const candidates = blockers
        ? blockers.map((id) => state.unit(id))
        : eligibleReserveDefenders(state)
    const candidateIds = idsOf(candidates)
    const named = defenceSelection.value(selections.defence, 'defenders') ?? []
    const defenders = blockers ?? named.filter((id) => candidateIds.includes(id))
    return {
        kind: StageKind.Defence,
        forced: blockers !== undefined,
        candidates,
        defenders,
        problem:
            defenders.length === 0
                ? undefined
                : whyIllegal(() => declareDefense(copyOf(state), defenders)),
        pickableIds: blockers ? [] : candidateIds,
        roles: rolesOf(defenders, [], BattleRole.Defends)
    }
}

function defenceLeadersStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections
): DefenceLeadersStage {
    const defenders = attack.defendingUnitIds.map((id) => state.unit(id))
    const defenderIds = idsOf(defenders)
    const leaders = (leadSelection.value(selections.lead, 'leaders') ?? []).filter((id) =>
        defenderIds.includes(id)
    )
    return {
        kind: StageKind.DefenceLeaders,
        defenders,
        leaders,
        leaderLimit: state.map.approach(attack.defenseApproach).wide ? 2 : 1,
        problem: whyIllegal(() => checkDefenseLeaders(state, leaders)),
        pickableIds: defenderIds,
        roles: rolesOf(defenderIds, leaders, BattleRole.Defends)
    }
}

function retreatStage(
    state: HydratedNapoleonsTriumphGameState,
    selections: BattleSelections
): RetreatStage {
    const plan = retreatPlan(state, selections.retreatArrangement)
    const choosingLosses =
        plan.groups.some((group) => group.open) &&
        retreatSelection.value(selections.retreat, 'lossesTaken') !== true
    if (choosingLosses) {
        return { kind: StageKind.Retreat, plan, choosingLosses, pickableIds: [], roles: {} }
    }
    const moving = movableCommander(
        plan,
        retreatSelection.value(selections.retreat, 'movingCommander')
    )
    if (moving) {
        return {
            kind: StageKind.Retreat,
            plan,
            choosingLosses,
            movingCommander: moving.commanderId,
            pickableIds: [...moving.corpsUnitIds],
            roles: {}
        }
    }
    const placed = Object.keys(plan.destinations)
    const mayPartWays = plan.room.size > 1 && placed.length > 1
    const maySendOne = mayPartWays || plan.stranded > 0
    const alone = maySendOne ? retreatSelection.value(selections.retreat, 'sentAlone') : undefined
    return {
        kind: StageKind.Retreat,
        plan,
        choosingLosses,
        alone,
        pickableIds: maySendOne ? idsOf(plan.survivors) : [],
        roles: alone === undefined ? {} : { [alone]: BattleRole.RetreatsAlone }
    }
}

function attackerPicking(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections,
    mayRide: boolean
): AttackerPicking & { leaders: string[] } {
    const planned = attack.attackPlan?.order
    const groups = attackerGroups(state, attack, mayRide)
    const pickableIds = groups.flatMap((group) => idsOf(group.units))
    const named =
        attackerSelection.value(selections.attackers, 'attackers') ?? planned?.unitIds ?? []
    const attackers = named.filter((id) => pickableIds.includes(id))
    const leaders = (attackerSelection.value(selections.attackers, 'leaders') ?? []).filter((id) =>
        attackers.includes(id)
    )
    const asPlanned = planned !== undefined && sameIds(planned.unitIds, attackers)
    const plannedRide =
        asPlanned && planned.continues !== true ? RideChoice.NewCommand : RideChoice.RidingOn
    const wantedRide = attackerSelection.value(selections.attackers, 'ride') ?? plannedRide
    const command = attackCommand(
        state,
        attack,
        attackers,
        attackerSelection.value(selections.attackers, 'command') ??
            (asPlanned ? planned.kind : undefined),
        { mayRide, ride: wantedRide }
    )
    return {
        groups,
        pickableIds,
        attackers,
        leaders,
        ride: command.ride,
        commandOptions: command.options,
        command: command.chosen,
        orders: command.orders,
        roles: rolesOf(attackers, leaders, BattleRole.Attacks)
    }
}

function feintStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections
): FeintStage {
    const picking = attackerPicking(state, attack, selections, true)
    const { orders } = picking
    const canPress = canPressAttack(state)
    // Rule 11, steps 3-5: a pressed attack names its pieces only after the defence's leading units are shown.
    const feinting = !canPress || attackerSelection.value(selections.attackers, 'feinting') === true
    return {
        ...picking,
        kind: StageKind.Feint,
        canPress,
        pressShowsLeaders: attack.defensePlan !== undefined,
        feinting,
        pickableIds: feinting ? picking.pickableIds : [],
        roles: feinting ? rolesOf(picking.attackers, [], BattleRole.Attacks) : {},
        ends:
            feinting && orders
                ? [FeintEnd.Approach, FeintEnd.Reserve].filter((end) =>
                      isLegal(() => declareFeint(copyOf(state), orders, end))
                  )
                : []
    }
}

// Erratum to rule 11: two batteries given a Unit Move each attack together only by both leading with their fire, across a wide approach.
function firesAsAPair(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    orders: MoveOrder[] | undefined
): boolean {
    if (!orders) {
        return false
    }
    const site = { attackerId: attack.attackerId, attackApproach: attack.attackApproach }
    return (
        isLegal(() => resolveAttackOrders(state, site, orders)) &&
        resolveAttackOrders(state, site, orders).artilleryPair
    )
}

function declarationStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections
): DeclarationStage {
    // Rule 11: an attack by road must be a feint, so cavalry riding on presses an attack only by a new command.
    const picking = attackerPicking(state, attack, selections, false)
    const pair = firesAsAPair(state, attack, picking.orders)
    const approachWide = state.map.approach(attack.attackApproach).wide
    const wide =
        approachWide &&
        (pair || attackerSelection.value(selections.attackers, 'width') !== AttackWidth.Narrow)
    const leaders = pair ? picking.attackers : picking.leaders.slice(0, wide ? 2 : 1)
    const targetOptions =
        !wide && attack.defenseLeaderIds.length === 2 ? attack.defenseLeaderIds : []
    const wantedTarget = attackerSelection.value(selections.attackers, 'struckLeader')
    const target = targetOptions.find((id) => id === wantedTarget) ?? targetOptions[0]
    const { orders } = picking
    const declaration = orders
        ? { orders, wide, leaderIds: leaders, targetLeaderId: target }
        : undefined
    const problem = declaration
        ? whyIllegal(() => checkAttackDeclaration(state, declaration))
        : picking.attackers.length > 0
          ? 'No one command can send these units into the attack together'
          : undefined
    // Rule 11, step 5: the defence leading unit a narrow attack does not strike "is no longer considered a leading unit".
    const passedBy = Object.fromEntries(
        targetOptions.filter((id) => id !== target).map((id) => [id, BattleRole.PassedBy])
    )
    return {
        ...picking,
        kind: StageKind.Declaration,
        pickableIds: [...picking.pickableIds, ...targetOptions],
        startsFromThreat:
            attack.attackPlan?.order?.unitIds.some((id) => picking.pickableIds.includes(id)) ===
            true,
        leaders,
        roles: { ...rolesOf(picking.attackers, leaders, BattleRole.Attacks), ...passedBy },
        approachWide,
        wide,
        firesAsAPair: pair,
        targetOptions,
        target,
        problem,
        initialResult:
            declaration && problem === undefined
                ? initialResultOf(state, checkAttackDeclaration(state, declaration))
                : undefined,
        initialAccount:
            declaration && problem === undefined
                ? initialAccountOf(state, checkAttackDeclaration(state, declaration))
                : undefined
    }
}

function occupationStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections
): OccupationStage {
    const picking = attackerPicking(state, attack, selections, true)
    const { orders } = picking
    const byRoad = orders?.some((order) => order.road !== undefined) === true
    const legalWith = (candidate: MoveOrder[] | undefined, gunsStay: boolean) =>
        candidate !== undefined &&
        isLegal(() => occupyAfterRetreat(copyOf(state), candidate, gunsStay))
    const roadOrders = byRoad
        ? undefined
        : rideInOrders(state, attack, picking.attackers, picking.command)
    return {
        ...picking,
        kind: StageKind.Occupation,
        roles: rolesOf(picking.attackers, [], BattleRole.Attacks),
        mayMoveIn: legalWith(orders, false),
        byRoad,
        roadOrders: legalWith(roadOrders, false) ? roadOrders : undefined,
        gunsMayStay: legalWith(orders, true)
    }
}

function counterStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections
): CounterStage {
    const candidates = counterAttackCandidates(state)
    const attackWinning = attackerLeadsInitially(state)
    const able = candidates.filter((unit) =>
        isLegal(() =>
            validateCounterAttackers(state, [unit], attack.defenseApproach, attackWinning)
        )
    )
    const counterAttackers = (
        counterSelection.value(selections.counter, 'counterAttackers') ?? []
    ).filter((id) => able.some((unit) => unit.id === id))
    const units = counterAttackers.map((id) => state.unit(id))
    return {
        kind: StageKind.Counter,
        candidates,
        counterAttackers,
        attackWinning,
        finalResult: finalResultWith(state, units),
        counterAccount: counterAttackAccountWith(units),
        problem: whyIllegal(() =>
            validateCounterAttackers(state, units, attack.defenseApproach, attackWinning)
        ),
        pickableIds: idsOf(able),
        roles: Object.fromEntries(counterAttackers.map((id) => [id, BattleRole.CounterAttacks]))
    }
}

function advanceStage(
    state: HydratedNapoleonsTriumphGameState,
    unitIds: readonly string[],
    selections: BattleSelections
): AdvanceStage {
    const units = unitIds.map((id) => state.unit(id))
    const onlyOne = unitIds.length === 1
    const advancing = onlyOne
        ? [...unitIds]
        : (advanceSelection.value(selections.advance, 'advancing') ?? unitIds).filter((id) =>
              unitIds.includes(id)
          )
    const sent = advanceSelection.value(selections.advance, 'commandersGoing') ?? []
    const commanderIds = [...new Set(advancing.flatMap((id) => state.unit(id).commanderId ?? []))]
    const commanders = commanderIds
        .map((commanderId) => state.commander(commanderId))
        .filter((commander) => samePosition(commander.position, state.unit(advancing[0]).position))
        .map((commander) => {
            const unitsStaying = state
                .corpsUnits(commander.id)
                .filter(
                    (unit) =>
                        samePosition(unit.position, commander.position) &&
                        !advancing.includes(unit.id)
                ).length
            const mustGo = unitsStaying === 0
            return {
                commanderId: commander.id,
                unitsStaying,
                mustGo,
                goes: mustGo || sent.includes(commander.id)
            }
        })
    return {
        kind: StageKind.Advance,
        units,
        advancing,
        commanders,
        pickableIds: onlyOne ? [] : [...unitIds],
        roles: Object.fromEntries(advancing.map((id) => [id, BattleRole.Advances]))
    }
}

function decisionStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections
): BattleStage | undefined {
    const decision = nextDecision(state)
    if (decision?.kind === DecisionKind.OddLoss) {
        return {
            kind: StageKind.OddLoss,
            units: decision.unitIds.map((id) => state.unit(id)),
            pickableIds: decision.unitIds,
            roles: {}
        }
    }
    if (decision?.kind === DecisionKind.ExcessLosses) {
        const chosen = excessLossSelection.value(selections.excessLosses, 'losses') ?? {}
        const losses = Object.fromEntries(
            Object.entries(chosen).filter(([id]) => decision.unitIds.includes(id))
        )
        return {
            kind: StageKind.ExcessLosses,
            amount: decision.amount,
            units: decision.unitIds.map((id) => state.unit(id)),
            losses,
            assigned: Object.values(losses).reduce((sum, steps) => sum + steps, 0),
            pickableIds: decision.unitIds,
            roles: {}
        }
    }
    if (decision?.kind === DecisionKind.Regroup) {
        const chosen = regroupSelection.value(selections.regroup, 'kept') ?? {}
        const corps = decision.commanderIds.map((commanderId) => {
            const units = attack.attackingUnitIds
                .flatMap((id) => state.findUnit(id) ?? [])
                .filter((unit) => unit.commanderId === commanderId)
            const kept = units.find((unit) => unit.id === chosen[commanderId]) ?? units[0]
            assertExists(kept, `No unit of ${commanderId} is left to regroup`)
            return { commanderId, units, keptId: kept.id }
        })
        return {
            kind: StageKind.Regroup,
            corps,
            pickableIds: corps.flatMap((entry) => idsOf(entry.units)),
            roles: {}
        }
    }
    if (decision?.kind === DecisionKind.Advance) {
        return advanceStage(state, decision.unitIds, selections)
    }
    return undefined
}

export function battleStageOf(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections
): BattleStage | undefined {
    switch (state.machineState) {
        case MachineState.DefenseResponse:
            return defenceSelection.value(selections.defence, 'retreating')
                ? retreatStage(state, selections)
                : defenceStage(state, selections)
        case MachineState.DefenseDeclaration:
            return defenceLeadersStage(state, attack, selections)
        case MachineState.Retreating:
            return retreatStage(state, selections)
        case MachineState.FeintDecision:
            return feintStage(state, attack, selections)
        case MachineState.AttackDeclaration:
            return declarationStage(state, attack, selections)
        case MachineState.Occupying:
            return occupationStage(state, attack, selections)
        case MachineState.CounterAttackDecision:
            return counterStage(state, attack, selections)
        case MachineState.ResolvingAttack:
            return decisionStage(state, attack, selections)
        default:
            return undefined
    }
}

function withAttackers(
    stage: Pick<AttackerPicking, 'attackers'>,
    selections: BattleSelections,
    attackers: string[],
    leaders: string[]
): BattleSelections {
    const named = sameIds(stage.attackers, attackers)
        ? selections.attackers
        : nameAttackers(selections.attackers, attackers)
    return { ...selections, attackers: nameLeaders(named, leaders) }
}

function standingWith(
    state: HydratedNapoleonsTriumphGameState,
    picked: readonly string[],
    unitId: string
): string[] {
    const position = state.unit(unitId).position
    return picked.filter((id) => samePosition(state.unit(id).position, position))
}

/** Taking back the last unit named leaves no choice of the player's behind, so Undo then leaves the step. */
function namedOrNone<
    Values extends Record<string, unknown>,
    Current extends Extract<keyof Values, string>
>(
    step: StagedSelection<Values>,
    selection: StagedSelectionState<Values>,
    stage: Current,
    unitIds: Values[Current] & readonly string[]
): StagedSelectionState<Values> {
    return unitIds.length > 0 ? step.set(selection, stage, unitIds, 'manual') : step.empty()
}

function pickDefender(
    stage: DefenceStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
    return {
        ...selections,
        defence: namedOrNone(
            defenceSelection,
            selections.defence,
            'defenders',
            toggled(stage.defenders, unitId)
        )
    }
}

function pickDefenceLeader(
    stage: DefenceLeadersStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
    return {
        ...selections,
        lead: namedOrNone(
            leadSelection,
            selections.lead,
            'leaders',
            toggled(stage.leaders, unitId, stage.leaderLimit)
        )
    }
}

function pickLeadingAttacker(
    state: HydratedNapoleonsTriumphGameState,
    stage: DeclarationStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
    if (stage.targetOptions.includes(unitId)) {
        return stage.target === unitId
            ? selections
            : { ...selections, attackers: setStruckLeader(selections.attackers, unitId) }
    }
    const together = standingWith(state, stage.attackers, unitId)
    const leading = stage.leaders.filter((id) => together.includes(id))
    if (!together.includes(unitId)) {
        return withAttackers(stage, selections, [...together, unitId], leading)
    }
    if (!leading.includes(unitId)) {
        return withAttackers(
            stage,
            selections,
            together,
            [...leading, unitId].slice(-(stage.wide ? 2 : 1))
        )
    }
    return withAttackers(
        stage,
        selections,
        together.filter((id) => id !== unitId),
        leading.filter((id) => id !== unitId)
    )
}

function addExcessLoss(
    state: HydratedNapoleonsTriumphGameState,
    stage: ExcessLossStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
    const current = stage.losses[unitId] ?? 0
    const strength = strengthOf(state.unit(unitId))
    const { [unitId]: _removed, ...others } = stage.losses
    const full = current >= strength || stage.assigned >= stage.amount
    const losses = full ? others : { ...others, [unitId]: current + 1 }
    return {
        ...selections,
        excessLosses: excessLossSelection.set(selections.excessLosses, 'losses', losses, 'manual')
    }
}

export function pickUnit(
    state: HydratedNapoleonsTriumphGameState,
    stage: BattleStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
    switch (stage.kind) {
        case StageKind.Defence:
            return pickDefender(stage, selections, unitId)
        case StageKind.DefenceLeaders:
            return pickDefenceLeader(stage, selections, unitId)
        case StageKind.Retreat:
            return pickRetreatingUnit(stage, selections, unitId)
        case StageKind.Feint:
        case StageKind.Occupation:
            return withAttackers(
                stage,
                selections,
                toggled(standingWith(state, stage.attackers, unitId), unitId),
                []
            )
        case StageKind.Declaration:
            return pickLeadingAttacker(state, stage, selections, unitId)
        case StageKind.Counter:
            return {
                ...selections,
                counter: counterSelection.set(
                    selections.counter,
                    'counterAttackers',
                    toggled(stage.counterAttackers, unitId, 2),
                    'manual'
                )
            }
        case StageKind.ExcessLosses:
            return addExcessLoss(state, stage, selections, unitId)
        case StageKind.Regroup: {
            const commanderId = state.unit(unitId).commanderId
            assertExists(commanderId, 'Only a unit of a defeated corps stays with its commander')
            return {
                ...selections,
                regroup: regroupSelection.set(
                    selections.regroup,
                    'kept',
                    { ...keptByCommander(stage), [commanderId]: unitId },
                    'manual'
                )
            }
        }
        case StageKind.Advance:
            return {
                ...selections,
                advance: advanceSelection.revise(
                    selections.advance,
                    'advancing',
                    toggled(stage.advancing, unitId),
                    'manual'
                )
            }
        case StageKind.OddLoss:
            return selections
    }
}

export function keptByCommander(stage: RegroupStage): Record<string, string> {
    return Object.fromEntries(stage.corps.map((entry) => [entry.commanderId, entry.keptId]))
}

export function commandersGoing(stage: AdvanceStage): string[] {
    return stage.commanders.filter((entry) => entry.goes).map((entry) => entry.commanderId)
}

/**
 * A retreat's losses are owed by groups of units, so a tap never changes how many steps are lost,
 * only where they fall: one step moves onto the tapped unit from the unit of its group carrying most.
 * A unit that owes nothing, or can take no more, is left as it is.
 */
export function moveLossOnto(
    state: HydratedNapoleonsTriumphGameState,
    stage: RetreatStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
    const lossOf = (id: string) => stage.plan.losses[id] ?? 0
    const group = stage.plan.groups.find((candidate) => candidate.unitIds.includes(unitId))
    if (!group || lossOf(unitId) >= strengthOf(state.unit(unitId))) {
        return selections
    }
    const stillOwed = group.assigned < group.steps
    const [giver] = group.unitIds
        .filter((id) => id !== unitId && lossOf(id) > 0)
        .toSorted((a, b) => lossOf(b) - lossOf(a))
    if (!stillOwed && giver === undefined) {
        return selections
    }
    const moved = {
        ...stage.plan.losses,
        ...(stillOwed || giver === undefined ? {} : { [giver]: lossOf(giver) - 1 }),
        [unitId]: lossOf(unitId) + 1
    }
    const losses = Object.fromEntries(Object.entries(moved).filter(([, steps]) => steps > 0))
    return setRetreatLosses(selections, losses)
}

/** Picks a commander's flag up, or puts it back where it was when it is the one already picked up. */
export function liftRetreatingCommander(
    stage: RetreatStage,
    selections: BattleSelections,
    commanderId: string
): BattleSelections {
    if (stage.movingCommander === commanderId) {
        return {
            ...selections,
            retreat: retreatSelection.clearFrom(selections.retreat, 'movingCommander')
        }
    }
    assert(
        !stage.choosingLosses && movableCommander(stage.plan, commanderId) !== undefined,
        'A flag is picked up only where the commander has a choice of units to keep'
    )
    return liftCommander(selections, commanderId)
}

function keepWithCommander(
    stage: RetreatStage,
    selections: BattleSelections,
    commanderId: string,
    unitId: string
): BattleSelections {
    const kept = { ...stage.plan.kept, [commanderId]: unitId }
    return setKeptInCorps(selections, kept)
}

export function sendRetreatTo(
    stage: RetreatStage,
    selections: BattleSelections,
    locale: number
): BattleSelections {
    const { plan } = stage
    const sent = stage.alone ? [stage.alone] : idsOf(plan.survivors)
    const settled = Object.entries(plan.destinations).map(([unitId, to]) => ({
        unitId,
        locale: to
    }))
    const earlier = [...plan.asked, ...settled].filter(
        (destination, index, all) =>
            !sent.includes(destination.unitId) &&
            all.findIndex((other) => other.unitId === destination.unitId) === index
    )
    const destinations = [...sent.map((unitId) => ({ unitId, locale })), ...earlier]
    return sendRetreating(selections, destinations)
}

function pickRetreatingUnit(
    stage: RetreatStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
    if (stage.movingCommander !== undefined) {
        return keepWithCommander(stage, selections, stage.movingCommander, unitId)
    }
    if (stage.alone === unitId) {
        return {
            ...selections,
            retreat: retreatSelection.clearFrom(selections.retreat, 'sentAlone')
        }
    }
    const withRoom = [...stage.plan.room].filter(([, free]) => free > 0)
    const stranded = stage.plan.destinations[unitId] === undefined
    if (stranded && withRoom.length === 1) {
        return sendRetreatTo({ ...stage, alone: unitId }, selections, withRoom[0][0])
    }
    return {
        ...selections,
        retreat: retreatSelection.set(selections.retreat, 'sentAlone', unitId, 'manual')
    }
}

export function sendCommander(
    stage: AdvanceStage,
    selections: BattleSelections,
    commanderId: string,
    goes: boolean
): BattleSelections {
    const sent = stage.commanders
        .filter((entry) => !entry.mustGo && (entry.commanderId === commanderId ? goes : entry.goes))
        .map((entry) => entry.commanderId)
    return { ...selections, advance: setCommandersGoing(selections.advance, sent) }
}

/** The units each side has committed to the attack, leaders first, with the approach they fight at. */
export function committedUnits(attack: VisibleAttack | undefined): SingledOut[] {
    return attack
        ? [
              {
                  towards: APPROACH_GEOMETRY[attack.attackApproach].centre,
                  unitIds: [...attack.attackLeaderIds, ...attack.attackingUnitIds]
              },
              {
                  towards: APPROACH_GEOMETRY[attack.defenseApproach].centre,
                  unitIds: [
                      ...attack.defenseLeaderIds,
                      ...attack.counterAttackingUnitIds,
                      ...attack.defendingUnitIds
                  ]
              }
          ]
        : []
}

/**
 * Units the enemy knows something of once an attack is over: those it has seen face-up, and those
 * named in a defence this turn, which stay towards the approach they defended. Seen units come
 * first, as leading units do during an attack.
 */
export function knownToTheEnemy(units: readonly ProjectedUnit[]): SingledOut[] {
    const seenFirst = units.toSorted(
        (a, b) => Number(b.shown !== undefined) - Number(a.shown !== undefined)
    )
    const byApproach = new Map<number | undefined, string[]>()
    for (const unit of seenFirst) {
        if (unit.shown !== undefined || unit.defendedApproach !== undefined) {
            const key = unit.defendedApproach
            byApproach.set(key, [...(byApproach.get(key) ?? []), unit.id])
        }
    }
    return [...byApproach].map(([approach, unitIds]) => ({
        towards: approach === undefined ? undefined : APPROACH_GEOMETRY[approach].centre,
        unitIds
    }))
}

export function committedRoles(attack: EndedAttack): Record<string, BattleRole> {
    return {
        ...Object.fromEntries(attack.attackingUnitIds.map((id) => [id, BattleRole.Attacks])),
        ...Object.fromEntries(attack.defendingUnitIds.map((id) => [id, BattleRole.Defends])),
        ...Object.fromEntries(attack.attackLeaderIds.map((id) => [id, BattleRole.Leads])),
        ...Object.fromEntries(attack.defenseLeaderIds.map((id) => [id, BattleRole.Leads])),
        ...Object.fromEntries(
            attack.counterAttackingUnitIds.map((id) => [id, BattleRole.CounterAttacks])
        )
    }
}

/** The roles as they stood in the defence, for listing the defenders apart from the counter-attack some of them then made. */
export function rolesBeforeTheCounterAttack(
    attack: EndedAttack,
    roles: Record<string, BattleRole>
): Record<string, BattleRole> {
    const defended = (id: string) =>
        attack.defenseLeaderIds.includes(id) ? BattleRole.Leads : BattleRole.Defends
    return Object.fromEntries(
        Object.entries(roles).map(([id, role]) => [
            id,
            role === BattleRole.CounterAttacks && attack.counterAttackingUnitIds.includes(id)
                ? defended(id)
                : role
        ])
    )
}

export function rolesShown(
    attack: VisibleAttack | undefined,
    stage: BattleStage | undefined
): Record<string, BattleRole> {
    if (stage?.kind === StageKind.Retreat) {
        return stage.roles
    }
    return { ...(attack ? committedRoles(attack) : {}), ...(stage?.roles ?? {}) }
}

export function battleLocalesOf(state: HydratedNapoleonsTriumphGameState): number[] {
    const { attack, map } = state
    return attack
        ? [map.approach(attack.attackApproach).locale, map.approach(attack.defenseApproach).locale]
        : []
}

export interface AttackResults {
    initial?: number
    final?: number
}

/** The results of the attack as they stand, with those still being decided in the step now open. */
export function resultsSoFar(attack: EndedAttack, stage: BattleStage | undefined): AttackResults {
    if (attack.feint) {
        return {}
    }
    if (stage?.kind === StageKind.Declaration) {
        return stage.problem ? {} : { initial: stage.initialResult }
    }
    if (stage?.kind === StageKind.Counter) {
        return {
            initial: attack.initialResult,
            final: stage.problem ? undefined : stage.finalResult
        }
    }
    return { initial: attack.initialResult, final: attack.finalResult }
}

/** The panel folds a step down to its prompt and buttons only where its choices can be made on the map. */
export function foldsAway(stage: BattleStage | undefined): boolean {
    switch (stage?.kind) {
        case StageKind.ExcessLosses:
        case StageKind.Regroup:
        case StageKind.Advance:
            return false
        case StageKind.Retreat:
            return !stage.choosingLosses
        default:
            return true
    }
}
