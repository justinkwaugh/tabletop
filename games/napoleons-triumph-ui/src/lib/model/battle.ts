import {
    AttackStep,
    CommandKind,
    DecisionKind,
    commanderCanCommand,
    HydratedNapoleonsTriumphGameState,
    counterAttackCandidates,
    declareDefense,
    eligibleReserveDefenders,
    hasUsableCommand,
    independentCommandsLeft,
    inReserve,
    mustDefend,
    nextDecision,
    resolveAttackOrders,
    samePosition,
    UnitType,
    validateAttackLeaders,
    type Attack,
    type MoveOrder,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'

/** Everything a player has picked while answering one step of an attack. */
export interface BattleDraft {
    touched: boolean
    pieces: string[]
    leaders: string[]
    wide?: boolean
    targetLeaderId?: string
    allocation: Record<string, number>
    destinations: Record<string, number>
    kept: Record<string, string>
    commanderIds: string[]
    /** The defender is planning a retreat before combat rather than a defence. */
    retreating: boolean
    /** A retreating unit picked to be sent somewhere by itself. */
    retreatUnitId?: string
}

export function emptyBattleDraft(): BattleDraft {
    return {
        touched: false,
        pieces: [],
        leaders: [],
        allocation: {},
        destinations: {},
        kept: {},
        commanderIds: [],
        retreating: false
    }
}

export function toggled(list: readonly string[], id: string, limit = Infinity): string[] {
    if (list.includes(id)) {
        return list.filter((entry) => entry !== id)
    }
    return [...list, id].slice(-limit)
}

const ROAD_REACH = 3

function legal(check: () => void): boolean {
    try {
        check()
        return true
    } catch {
        return false
    }
}

function roadPathsBetween(state: HydratedNapoleonsTriumphGameState, from: number, to: number): number[][] {
    const paths: number[][] = []
    const extend = (path: number[], locale: number) => {
        if (path.length >= ROAD_REACH) {
            return
        }
        for (const next of new Set(state.map.roadLinksFrom(locale).map((link) => link.to))) {
            if (path.includes(next) || next === from) {
                continue
            }
            const longer = [...path, next]
            if (next === to) {
                paths.push(longer)
            } else {
                extend(longer, next)
            }
        }
    }
    extend([], from)
    return paths.toSorted((a, b) => a.length - b.length)
}

/**
 * The command that brings cavalry standing elsewhere up a road to make the attack (rule 11):
 * one Corps Move, or the Unit Move of a single unit.
 */
function roadAttackOrders(
    state: HydratedNapoleonsTriumphGameState,
    attack: Pick<Attack, 'attackerId' | 'attackApproach'>,
    picked: readonly ProjectedUnit[]
): MoveOrder[] | undefined {
    const start = picked[0]?.position
    if (!start || !inReserve(start) || picked.some((unit) => !samePosition(unit.position, start))) {
        return undefined
    }
    if (picked.some((unit) => unit.face?.type !== UnitType.Cavalry)) {
        return undefined
    }
    const unitIds = picked.map((unit) => unit.id)
    const commanderId = picked[0].commanderId
    const bases: MoveOrder[] = []
    if (commanderId !== undefined && picked.every((unit) => unit.commanderId === commanderId)) {
        bases.push({ kind: CommandKind.Corps, commanderId, unitIds })
    }
    if (picked.length === 1) {
        bases.push({ kind: CommandKind.Unit, unitIds })
    }
    const to = state.map.approach(attack.attackApproach).locale
    for (const base of bases) {
        for (const road of roadPathsBetween(state, start.locale, to)) {
            const order = { ...base, road }
            if (legal(() => resolveAttackOrders(state, attack, [order]))) {
                return [order]
            }
        }
    }
    return undefined
}

/** The attacker's units that could take part in an attack across the attack approach. */
export function attackCandidates(
    state: HydratedNapoleonsTriumphGameState,
    attack: Pick<Attack, 'attackerId' | 'attackApproach'>
): ProjectedUnit[] {
    const locale = state.map.approach(attack.attackApproach).locale
    const inPlace = [
        ...state.blockers(attack.attackApproach, attack.attackerId),
        ...state.reserveUnits(locale, attack.attackerId)
    ].filter((unit) => hasUsableCommand(state, unit))
    const byRoad = state
        .unitsOf(attack.attackerId)
        .filter(
            (unit) =>
                unit.position !== undefined &&
                unit.position.locale !== locale &&
                unit.face?.type === UnitType.Cavalry &&
                hasUsableCommand(state, unit) &&
                roadAttackOrders(state, attack, [unit]) !== undefined
        )
    return [...inPlace, ...byRoad]
}

/**
 * Turns the units picked for an attack into the commands that move them: a Corps Move for each
 * corps whose commander can still command, an independent Unit Move for a lone unit otherwise.
 */
export function attackOrders(
    state: HydratedNapoleonsTriumphGameState,
    attack: Pick<Attack, 'attackerId' | 'attackApproach'>,
    pickedIds: readonly string[]
): MoveOrder[] | undefined {
    const playerId = attack.attackerId
    const picked = pickedIds.map((id) => state.unit(id))
    if (picked.length === 0) {
        return undefined
    }
    const stance = picked[0].position
    if (stance && stance.locale !== state.map.approach(attack.attackApproach).locale) {
        return roadAttackOrders(state, attack, picked)
    }
    if (!stance || picked.some((unit) => !unit.position || inReserve(unit.position) !== inReserve(stance))) {
        return undefined
    }
    const orders: MoveOrder[] = []
    let independent = independentCommandsLeft(state, playerId)
    const corpsIds = [...new Set(picked.flatMap((unit) => unit.commanderId ?? []))]
    for (const commanderId of corpsIds) {
        const units = picked.filter((unit) => unit.commanderId === commanderId)
        const gunsAlone =
            units.every((unit) => unit.face?.type === UnitType.Artillery) &&
            units.length < state.corpsUnits(commanderId).length
        if (commanderCanCommand(state, state.commander(commanderId))) {
            // Artillery leads only when it leaves its corps to fire (rule 11), so guns picked by themselves are detached.
            const kind = gunsAlone ? CommandKind.Detach : CommandKind.Corps
            orders.push({ kind, commanderId, unitIds: units.map((unit) => unit.id) })
        } else if (units.length === 1 && independent > 0) {
            independent -= 1
            orders.push({ kind: CommandKind.Unit, unitIds: [units[0].id] })
        } else {
            return undefined
        }
    }
    for (const unit of picked.filter((candidate) => candidate.commanderId === undefined)) {
        if (independent <= 0) {
            return undefined
        }
        independent -= 1
        orders.push({ kind: CommandKind.Unit, unitIds: [unit.id] })
    }
    return orders
}

export function describeLocale(state: HydratedNapoleonsTriumphGameState, locale: number): string {
    return state.map.locale(locale).name ?? `locale ${locale}`
}

/** An attack as either player sees it: everything but the defender's hidden plan. */
export type VisibleAttack = Omit<Attack, 'defensePlan'>

/** The picking a player does on blocks, on the map or in the panel, during one step of an attack. */
export interface BattleStage {
    /** Units the player may tap. */
    candidates: ProjectedUnit[]
    picked: string[]
    leaders: string[]
    /** What each picked unit is set to do, by unit id. */
    roles: Record<string, string>
    wide?: boolean
    /** The commands that would move the picked attackers, when they make a legal attack. */
    orders?: MoveOrder[]
    /** Why the pick as it stands cannot be declared, in the rules' words. */
    problem?: string
    /** Tapping a candidate settles the step at once and takes this many steps from it. */
    immediateLoss?: number
    /** The change to the draft when a candidate is tapped. */
    pick(unitId: string): Partial<BattleDraft>
}

function problemOf(check: () => void): string | undefined {
    try {
        check()
        return undefined
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
}

function copyOf(state: HydratedNapoleonsTriumphGameState): HydratedNapoleonsTriumphGameState {
    return new HydratedNapoleonsTriumphGameState(structuredClone(state.dehydrate()))
}

function rolesOf(picked: readonly string[], leaders: readonly string[], role: string): Record<string, string> {
    return Object.fromEntries(picked.map((id) => [id, leaders.includes(id) ? 'leads' : role]))
}

/** The attacker's picks, starting from the order that made the threat. */
function attackerPicks(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    draft: BattleDraft,
    plannedOrder: MoveOrder | undefined
): { candidates: ProjectedUnit[]; picked: string[] } {
    const candidates = attackCandidates(state, attack)
    const ids = candidates.map((unit) => unit.id)
    const picked = draft.touched
        ? draft.pieces.filter((id) => ids.includes(id))
        : (plannedOrder?.unitIds ?? []).filter((id) => ids.includes(id))
    return { candidates, picked }
}

/** Attackers all start from one position, so picking a unit elsewhere starts the pick over. */
function standingWith(
    state: HydratedNapoleonsTriumphGameState,
    picked: readonly string[],
    unitId: string
): string[] {
    const position = state.unit(unitId).position
    return picked.filter((id) => samePosition(state.unit(id).position, position))
}

function defenseStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    draft: BattleDraft
): BattleStage {
    const forced = mustDefend(state)
    const candidates = forced
        ? state.blockers(attack.defenseApproach, attack.defenderId)
        : eligibleReserveDefenders(state)
    const ids = candidates.map((unit) => unit.id)
    const picked = forced ? ids : draft.pieces.filter((id) => ids.includes(id))
    const limit = state.map.approach(attack.defenseApproach).wide ? 2 : 1
    const leaders = draft.leaders.filter((id) => picked.includes(id))
    return {
        candidates,
        picked,
        leaders,
        problem:
            picked.length === 0
                ? undefined
                : problemOf(() => declareDefense(copyOf(state), picked, leaders)),
        roles: rolesOf(picked, leaders, 'defends'),
        pick(unitId) {
            if (!picked.includes(unitId)) {
                return { pieces: [...picked, unitId], leaders }
            }
            if (!leaders.includes(unitId)) {
                return { pieces: picked, leaders: toggled(leaders, unitId, limit) }
            }
            return {
                pieces: forced ? picked : picked.filter((id) => id !== unitId),
                leaders: leaders.filter((id) => id !== unitId)
            }
        }
    }
}

function attackerStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    draft: BattleDraft,
    plannedOrder: MoveOrder | undefined
): BattleStage {
    const { candidates, picked } = attackerPicks(state, attack, draft, plannedOrder)
    return {
        candidates,
        picked,
        leaders: [],
        orders: attackOrders(state, attack, picked),
        roles: rolesOf(picked, [], 'attacks'),
        pick(unitId) {
            return { pieces: toggled(standingWith(state, picked, unitId), unitId) }
        }
    }
}

function declarationStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    draft: BattleDraft,
    plannedOrder: MoveOrder | undefined
): BattleStage {
    const { candidates, picked } = attackerPicks(state, attack, draft, plannedOrder)
    const wide = state.map.approach(attack.attackApproach).wide && (draft.wide ?? true)
    const limit = wide ? 2 : 1
    const leaders = draft.leaders.filter((id) => picked.includes(id)).slice(0, limit)
    const orders = attackOrders(state, attack, picked)
    const problem = orders
        ? problemOf(() => {
              const resolved = resolveAttackOrders(state, attack, orders)
              const room = state.map.locale(state.map.opposite(attack.attackApproach).locale).capacity
              if (resolved.units.length > room) {
                  throw new Error('The defense locale could not hold the attacking units')
              }
              validateAttackLeaders(
                  state,
                  leaders.map((id) => state.unit(id)),
                  {
                      attackApproach: attack.attackApproach,
                      wide,
                      guardAttack: attack.guardAttack === true,
                      attackersBlocking: resolved.stance.approach !== undefined,
                      orders: resolved.resolved
                  }
              )
          })
        : undefined
    return {
        candidates,
        picked,
        leaders,
        wide,
        orders,
        problem,
        roles: rolesOf(picked, leaders, 'attacks'),
        pick(unitId) {
            const together = standingWith(state, picked, unitId)
            const leading = leaders.filter((id) => together.includes(id))
            if (!together.includes(unitId)) {
                return { pieces: [...together, unitId], leaders: leading }
            }
            if (!leading.includes(unitId)) {
                return { pieces: together, leaders: [...leading, unitId].slice(-limit) }
            }
            return {
                pieces: together.filter((id) => id !== unitId),
                leaders: leading.filter((id) => id !== unitId)
            }
        }
    }
}

function counterStage(state: HydratedNapoleonsTriumphGameState, draft: BattleDraft): BattleStage {
    const candidates = counterAttackCandidates(state)
    const picked = draft.pieces.filter((id) => candidates.some((unit) => unit.id === id))
    return {
        candidates,
        picked,
        leaders: [],
        roles: Object.fromEntries(picked.map((id) => [id, 'counter-attacks'])),
        pick(unitId) {
            return { pieces: toggled(picked, unitId, 2) }
        }
    }
}

function decisionStage(
    state: HydratedNapoleonsTriumphGameState,
    draft: BattleDraft
): BattleStage | undefined {
    const decision = nextDecision(state)
    if (decision?.kind === DecisionKind.OddLoss) {
        return {
            candidates: decision.unitIds.map((id) => state.unit(id)),
            picked: [],
            leaders: [],
            roles: {},
            immediateLoss: 1,
            pick: () => ({})
        }
    }
    if (decision?.kind === DecisionKind.Advance) {
        const picked = draft.pieces.filter((id) => decision.unitIds.includes(id))
        return {
            candidates: decision.unitIds.map((id) => state.unit(id)),
            picked,
            leaders: [],
            roles: Object.fromEntries(picked.map((id) => [id, 'advances'])),
            pick(unitId) {
                return { pieces: toggled(picked, unitId) }
            }
        }
    }
    return undefined
}

/** What the acting player is picking on blocks at this step of the attack, when the step has such a pick. */
export function battleStage(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    draft: BattleDraft,
    plannedOrder: MoveOrder | undefined
): BattleStage | undefined {
    switch (attack.step) {
        case AttackStep.DefenseResponse:
            return defenseStage(state, attack, draft)
        case AttackStep.FeintDecision:
        case AttackStep.Occupying:
            return attackerStage(state, attack, draft, plannedOrder)
        case AttackStep.AttackDeclaration:
            return declarationStage(state, attack, draft, plannedOrder)
        case AttackStep.CounterAttackDecision:
            return counterStage(state, draft)
        case AttackStep.Resolving:
            return decisionStage(state, draft)
        default:
            return undefined
    }
}

/** What the pieces named so far in an attack are doing, as both players know it. */
export function committedRoles(attack: VisibleAttack): Record<string, string> {
    return {
        ...Object.fromEntries(attack.attackingUnitIds.map((id) => [id, 'attacks'])),
        ...Object.fromEntries(attack.defendingUnitIds.map((id) => [id, 'defends'])),
        ...Object.fromEntries(attack.attackLeaderIds.map((id) => [id, 'leads'])),
        ...Object.fromEntries(attack.defenseLeaderIds.map((id) => [id, 'leads'])),
        ...Object.fromEntries(attack.counterAttackerIds.map((id) => [id, 'counter-attacks']))
    }
}
