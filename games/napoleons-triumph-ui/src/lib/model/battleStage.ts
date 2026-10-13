import { assertExists } from '@tabletop/common'
import {
    DecisionKind,
    FeintEnd,
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
    type HydratedNapoleonsTriumphGameState,
    type MoveOrder,
    type ThreatOrder,
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
    StageKind,
    advanceSelection,
    attackerSelection,
    counterSelection,
    defenceSelection,
    excessLossSelection,
    nameAttackers,
    nameLeaders,
    regroupSelection,
    retreatSelection,
    setCommandersGoing,
    setKeptInCorps,
    sendRetreating,
    setStruckLeader,
    setRetreatLosses,
    type BattleSelections
} from './battleSelection.js'
import { sameIds } from '$lib/utils/ids.js'
import { RideChoice } from './moveCommands.js'
import { retreatPlan, strengthOf, type RetreatPlan } from './retreatPlan.js'
import { copyOf } from './stateCopy.js'

export type VisibleAttack = Omit<Attack, 'defensePlan' | 'attackPlan'> & {
    attackPlan?: { order?: ThreatOrder }
}

export enum BattleRole {
    Defends = 'defends',
    Leads = 'leads',
    Attacks = 'attacks',
    CounterAttacks = 'counter-attacks',
    Advances = 'advances',
    Stays = 'stays',
    RetreatsAlone = 'goes alone',
    PassedBy = 'passed by'
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
    ride?: RideChoice
    commandOptions: CommandKind[]
    command?: CommandKind
    orders?: MoveOrder[]
}

export interface FeintStage extends AttackerPicking {
    kind: StageKind.Feint
    canPress: boolean
    feinting: boolean
    ends: FeintEnd[]
}

export interface DeclarationStage extends AttackerPicking {
    kind: StageKind.Declaration
    startsFromThreat: boolean
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
    commanders: { commanderId: string; goes: boolean; mustGo: boolean; unitsStaying: number }[]
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
    const placed = Object.keys(plan.destinations)
    const mayPartWays = plan.room.size > 1 && placed.length > 1
    const maySendOne = mayPartWays || plan.stranded > 0
    const alone = maySendOne ? retreatSelection.value(selections.retreat, 'sentAlone') : undefined
    return {
        kind: StageKind.Retreat,
        plan,
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

function declarationStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    selections: BattleSelections
): DeclarationStage {
    // Rule 11: an attack by road must be a feint, so cavalry riding on presses an attack only by a new command.
    const picking = attackerPicking(state, attack, selections, false)
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
        : (advanceSelection.value(selections.advance, 'advancing') ?? []).filter((id) =>
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
    selections: BattleSelections
): BattleStage | undefined {
    switch (state.machineState) {
        case MachineState.DefenseResponse:
            return defenceSelection.value(selections.defence, 'retreating')
                ? retreatStage(state, selections)
                : defenceStage(state, attack, selections)
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
            assertExists(commanderId, 'Only a unit of a repulsed corps stays with its commander')
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

export function cycleLoss(
    state: HydratedNapoleonsTriumphGameState,
    stage: RetreatStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
    const strength = strengthOf(state.unit(unitId))
    const next = ((stage.plan.losses[unitId] ?? 0) + 1) % (strength + 1)
    const { [unitId]: _previous, ...others } = stage.plan.losses
    const losses = next === 0 ? others : { ...others, [unitId]: next }
    return { ...selections, retreat: setRetreatLosses(selections.retreat, losses) }
}

export function keepWithCommander(
    stage: RetreatStage,
    selections: BattleSelections,
    commanderId: string,
    unitId: string
): BattleSelections {
    const kept = { ...stage.plan.kept, [commanderId]: unitId }
    return { ...selections, retreat: setKeptInCorps(selections.retreat, kept) }
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
    return { ...selections, retreat: sendRetreating(selections.retreat, destinations) }
}

function pickRetreatingUnit(
    stage: RetreatStage,
    selections: BattleSelections,
    unitId: string
): BattleSelections {
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

function committedRoles(attack: VisibleAttack): Record<string, BattleRole> {
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
