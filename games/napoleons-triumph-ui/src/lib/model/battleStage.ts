import { assertExists } from '@tabletop/common'
import {
    DecisionKind,
    FeintEnd,
    HydratedNapoleonsTriumphGameState,
    MachineState,
    attackerLeadsInitially,
    canPressAttack,
    checkAttackDeclaration,
    counterAttackCandidates,
    declareDefense,
    declareFeint,
    eligibleReserveDefenders,
    finalResultWith,
    initialResultOf,
    isLegal,
    mustDefend,
    nextDecision,
    occupyAfterRetreat,
    retreatingUnits,
    samePosition,
    validateCounterAttackers,
    whyIllegal,
    type Attack,
    type CommandKind,
    type MoveOrder,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import {
    attackCommand,
    attackerGroups,
    rideInOrders,
    type AttackerGroup
} from './attackCommands.js'
import {
    AttackWidth,
    advanceSelection,
    attackerSelection,
    counterSelection,
    defenceSelection,
    excessLossSelection,
    regroupSelection,
    retreatSelection,
    type BattleSelections
} from './battleSelection.js'
import { retreatPlan, type RetreatPlan } from './retreatPlan.js'

/** An attack as either player sees it: everything but the defender's hidden plan. */
export type VisibleAttack = Omit<Attack, 'defensePlan'>

export enum BattleRole {
    Defends = 'defends',
    Leads = 'leads',
    Attacks = 'attacks',
    CounterAttacks = 'counter-attacks',
    Advances = 'advances',
    Stays = 'stays',
    RetreatsAlone = 'goes alone'
}

export enum StageKind {
    Defence = 'Defence',
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

interface Picking {
    pickableIds: string[]
    roles: Record<string, BattleRole>
}

export interface DefenceStage extends Picking {
    kind: StageKind.Defence
    forced: boolean
    candidates: ProjectedUnit[]
    bystanders: ProjectedUnit[]
    defenders: string[]
    leaders: string[]
    leaderLimit: number
    problem?: string
}

export interface RetreatStage extends Picking {
    kind: StageKind.Retreat
    plan: RetreatPlan
    alone?: string
}

interface AttackerPicking extends Picking {
    groups: AttackerGroup[]
    attackers: string[]
    commandOptions: CommandKind[]
    command?: CommandKind
    orders?: MoveOrder[]
}

export interface FeintStage extends AttackerPicking {
    kind: StageKind.Feint
    canPress: boolean
    ends: FeintEnd[]
}

export interface DeclarationStage extends AttackerPicking {
    kind: StageKind.Declaration
    leaders: string[]
    approachWide: boolean
    wide: boolean
    targetOptions: string[]
    target?: string
    problem?: string
    initialResult?: number
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
    commanders: { commanderId: string; goes: boolean; mustGo: boolean }[]
}

export type BattleStage =
    | DefenceStage
    | RetreatStage
    | FeintStage
    | DeclarationStage
    | OccupationStage
    | CounterStage
    | OddLossStage
    | ExcessLossStage
    | RegroupStage
    | AdvanceStage

function copyOf(state: HydratedNapoleonsTriumphGameState): HydratedNapoleonsTriumphGameState {
    return new HydratedNapoleonsTriumphGameState(structuredClone(state.dehydrate()))
}

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
    attack: VisibleAttack,
    selections: BattleSelections
): DefenceStage {
    const forced = mustDefend(state)
    const candidates = forced
        ? state.blockers(attack.defenseApproach, attack.defenderId)
        : eligibleReserveDefenders(state)
    const candidateIds = idsOf(candidates)
    const named = defenceSelection.value(selections.defence, 'defenders') ?? []
    const defenders = forced ? candidateIds : named.filter((id) => candidateIds.includes(id))
    const leaders = (defenceSelection.value(selections.defence, 'leaders') ?? []).filter((id) =>
        defenders.includes(id)
    )
    return {
        kind: StageKind.Defence,
        forced,
        candidates,
        bystanders: retreatingUnits(state).filter((unit) => !candidates.includes(unit)),
        defenders,
        leaders,
        leaderLimit: state.map.approach(attack.defenseApproach).wide ? 2 : 1,
        problem:
            defenders.length === 0
                ? undefined
                : whyIllegal(() => declareDefense(copyOf(state), defenders, leaders)),
        pickableIds: candidateIds,
        roles: rolesOf(defenders, leaders, BattleRole.Defends)
    }
}

function retreatStage(
    state: HydratedNapoleonsTriumphGameState,
    selections: BattleSelections
): RetreatStage {
    const plan = retreatPlan(state, selections.retreat)
    const alone = retreatSelection.value(selections.retreat, 'sentAlone')
    return {
        kind: StageKind.Retreat,
        plan,
        alone,
        pickableIds: plan.room.size > 1 ? Object.keys(plan.destinations) : [],
        roles: alone === undefined ? {} : { [alone]: BattleRole.RetreatsAlone }
    }
}

function attackerPicking(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections,
    plannedOrder: MoveOrder | undefined
): AttackerPicking & { leaders: string[] } {
    const groups = attackerGroups(state, attack)
    const pickableIds = groups.flatMap((group) => idsOf(group.units))
    const named =
        attackerSelection.value(selections.attackers, 'attackers') ?? plannedOrder?.unitIds ?? []
    const attackers = named.filter((id) => pickableIds.includes(id))
    const leaders = (attackerSelection.value(selections.attackers, 'leaders') ?? []).filter((id) =>
        attackers.includes(id)
    )
    const command = attackCommand(
        state,
        attack,
        attackers,
        attackerSelection.value(selections.attackers, 'command') ?? plannedOrder?.kind
    )
    return {
        groups,
        pickableIds,
        attackers,
        leaders,
        commandOptions: command.options,
        command: command.chosen,
        orders: command.orders,
        roles: rolesOf(attackers, leaders, BattleRole.Attacks)
    }
}

function feintStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections,
    plannedOrder: MoveOrder | undefined
): FeintStage {
    const picking = attackerPicking(state, attack, selections, plannedOrder)
    const { orders } = picking
    return {
        ...picking,
        kind: StageKind.Feint,
        roles: rolesOf(picking.attackers, [], BattleRole.Attacks),
        canPress: canPressAttack(state),
        ends: orders
            ? [FeintEnd.Approach, FeintEnd.Reserve].filter((end) =>
                  isLegal(() => declareFeint(copyOf(state), orders, end))
              )
            : []
    }
}

function declarationStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections,
    plannedOrder: MoveOrder | undefined
): DeclarationStage {
    const picking = attackerPicking(state, attack, selections, plannedOrder)
    const approachWide = state.map.approach(attack.attackApproach).wide
    const wide =
        approachWide &&
        attackerSelection.value(selections.attackers, 'width') !== AttackWidth.Narrow
    const leaders = picking.leaders.slice(0, wide ? 2 : 1)
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
        : undefined
    return {
        ...picking,
        kind: StageKind.Declaration,
        leaders,
        roles: rolesOf(picking.attackers, leaders, BattleRole.Attacks),
        approachWide,
        wide,
        targetOptions,
        target,
        problem,
        initialResult:
            declaration && problem === undefined
                ? initialResultOf(state, checkAttackDeclaration(state, declaration))
                : undefined
    }
}

function occupationStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections,
    plannedOrder: MoveOrder | undefined
): OccupationStage {
    const picking = attackerPicking(state, attack, selections, plannedOrder)
    const { orders } = picking
    const byRoad = orders?.some((order) => order.road !== undefined) === true
    const legalWith = (candidate: MoveOrder[] | undefined, gunsStay: boolean) =>
        candidate !== undefined &&
        isLegal(() => occupyAfterRetreat(copyOf(state), candidate, gunsStay))
    const roadOrders = byRoad ? undefined : rideInOrders(state, attack, picking.attackers)
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
    const counterAttackers = (
        counterSelection.value(selections.counter, 'counterAttackers') ?? []
    ).filter((id) => candidates.some((unit) => unit.id === id))
    const units = counterAttackers.map((id) => state.unit(id))
    const attackWinning = attackerLeadsInitially(state)
    return {
        kind: StageKind.Counter,
        candidates,
        counterAttackers,
        attackWinning,
        finalResult: finalResultWith(state, units),
        problem: whyIllegal(() =>
            validateCounterAttackers(state, units, attack.defenseApproach, attackWinning)
        ),
        pickableIds: idsOf(candidates),
        roles: Object.fromEntries(counterAttackers.map((id) => [id, BattleRole.CounterAttacks]))
    }
}

function advanceStage(
    state: HydratedNapoleonsTriumphGameState,
    unitIds: readonly string[],
    selections: BattleSelections
): AdvanceStage {
    const units = unitIds.map((id) => state.unit(id))
    const advancing = (advanceSelection.value(selections.advance, 'advancing') ?? []).filter((id) =>
        unitIds.includes(id)
    )
    const staying = advanceSelection.value(selections.advance, 'commandersStaying') ?? []
    const commanderIds = [...new Set(advancing.flatMap((id) => state.unit(id).commanderId ?? []))]
    const commanders = commanderIds
        .map((commanderId) => state.commander(commanderId))
        .filter((commander) => samePosition(commander.position, state.unit(advancing[0]).position))
        .map((commander) => {
            const mustGo = state
                .corpsUnits(commander.id)
                .filter((unit) => samePosition(unit.position, commander.position))
                .every((unit) => advancing.includes(unit.id))
            return {
                commanderId: commander.id,
                mustGo,
                goes: mustGo || !staying.includes(commander.id)
            }
        })
    return {
        kind: StageKind.Advance,
        units,
        advancing,
        commanders,
        pickableIds: [...unitIds],
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
            roles: Object.fromEntries(corps.map((entry) => [entry.keptId, BattleRole.Stays]))
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
    selections: BattleSelections,
    plannedOrder: MoveOrder | undefined
): BattleStage | undefined {
    switch (attack.step) {
        case MachineState.DefenseResponse:
            return defenceSelection.value(selections.defence, 'retreating')
                ? retreatStage(state, selections)
                : defenceStage(state, attack, selections)
        case MachineState.Retreating:
            return retreatStage(state, selections)
        case MachineState.FeintDecision:
            return feintStage(state, attack, selections, plannedOrder)
        case MachineState.AttackDeclaration:
            return declarationStage(state, attack, selections, plannedOrder)
        case MachineState.Occupying:
            return occupationStage(state, attack, selections, plannedOrder)
        case MachineState.CounterAttackDecision:
            return counterStage(state, attack, selections)
        case MachineState.ResolvingAttack:
            return decisionStage(state, attack, selections)
    }
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id) => b.includes(id))
}

function withAttackers(
    stage: Pick<AttackerPicking, 'attackers'>,
    selections: BattleSelections,
    attackers: string[],
    leaders: string[]
): BattleSelections {
    const named = sameIds(stage.attackers, attackers)
        ? selections.attackers
        : attackerSelection.set(selections.attackers, 'attackers', attackers, 'manual')
    return {
        ...selections,
        attackers:
            leaders.length > 0
                ? attackerSelection.set(named, 'leaders', leaders, 'manual')
                : attackerSelection.clearFrom(named, 'leaders')
    }
}

function standingWith(
    state: HydratedNapoleonsTriumphGameState,
    picked: readonly string[],
    unitId: string
): string[] {
    const position = state.unit(unitId).position
    return picked.filter((id) => samePosition(state.unit(id).position, position))
}

function pickDefender(
    stage: DefenceStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
    const { defenders, leaders } = stage
    const named = defenders.includes(unitId)
    const leading = leaders.includes(unitId)
    const nextDefenders =
        named && leading && !stage.forced
            ? defenders.filter((id) => id !== unitId)
            : [...new Set([...defenders, unitId])]
    const nextLeaders = !named ? leaders : toggled(leaders, unitId, stage.leaderLimit)
    const withDefenders = defenceSelection.set(
        selections.defence,
        'defenders',
        nextDefenders,
        'manual'
    )
    return {
        ...selections,
        defence:
            nextLeaders.length > 0
                ? defenceSelection.set(withDefenders, 'leaders', nextLeaders, 'manual')
                : withDefenders
    }
}

function pickLeadingAttacker(
    state: HydratedNapoleonsTriumphGameState,
    stage: DeclarationStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
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
    const strength = state.unit(unitId).face?.strength ?? 0
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
        case StageKind.Retreat:
            return {
                ...selections,
                retreat:
                    stage.alone === unitId
                        ? retreatSelection.clearFrom(selections.retreat, 'sentAlone')
                        : retreatSelection.set(selections.retreat, 'sentAlone', unitId, 'manual')
            }
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
            assertExists(commanderId, 'Only a unit of a repulsed corps stays with its commander')
            const kept = Object.fromEntries(
                stage.corps.map((entry) => [entry.commanderId, entry.keptId])
            )
            return {
                ...selections,
                regroup: regroupSelection.set(
                    selections.regroup,
                    'kept',
                    { ...kept, [commanderId]: unitId },
                    'manual'
                )
            }
        }
        case StageKind.Advance:
            return {
                ...selections,
                advance: advanceSelection.set(
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

export function committedRoles(attack: VisibleAttack): Record<string, BattleRole> {
    return {
        ...Object.fromEntries(attack.attackingUnitIds.map((id) => [id, BattleRole.Attacks])),
        ...Object.fromEntries(attack.defendingUnitIds.map((id) => [id, BattleRole.Defends])),
        ...Object.fromEntries(attack.attackLeaderIds.map((id) => [id, BattleRole.Leads])),
        ...Object.fromEntries(attack.defenseLeaderIds.map((id) => [id, BattleRole.Leads])),
        ...Object.fromEntries(
            attack.counterAttackerIds.map((id) => [id, BattleRole.CounterAttacks])
        )
    }
}
