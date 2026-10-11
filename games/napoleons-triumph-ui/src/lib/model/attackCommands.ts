import {
    CommandKind,
    UnitType,
    hasUsableCommand,
    inReserve,
    isLegal,
    resolveAttackOrders,
    roadAttackOrder,
    roadAttackOrders,
    type HydratedNapoleonsTriumphGameState,
    type MoveOrder,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import type { VisibleAttack } from './battleStage.js'

export interface AttackerGroup {
    label: string
    units: ProjectedUnit[]
}

export function attackerGroups(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack
): AttackerGroup[] {
    const locale = state.map.approach(attack.attackApproach).locale
    const commandable = (units: ProjectedUnit[]) =>
        units.filter((unit) => hasUsableCommand(state, unit))
    const riding = (state.roadMarch?.unitIds ?? []).map((id) => state.unit(id))
    const byRoad = state
        .unitsOf(attack.attackerId)
        .filter(
            (unit) =>
                unit.position?.locale !== locale &&
                unit.face?.type === UnitType.Cavalry &&
                roadAttackOrder(state, attack, [unit]) !== undefined
        )
    return [
        {
            label: 'On the approach',
            units: commandable(state.blockers(attack.attackApproach, attack.attackerId))
        },
        { label: 'In reserve', units: commandable(state.reserveUnits(locale, attack.attackerId)) },
        { label: 'Riding on by road', units: roadAttackOrder(state, attack, riding) ? riding : [] },
        { label: 'Cavalry that can ride up by road', units: byRoad }
    ].filter((group) => group.units.length > 0)
}

function inPlaceCommands(picked: readonly ProjectedUnit[]): CommandKind[] {
    const commanderIds = new Set(picked.map((unit) => unit.commanderId))
    const allInCorps = !commanderIds.has(undefined)
    const gunsAlone = picked.every((unit) => unit.face?.type === UnitType.Artillery)
    const kinds = [
        ...(allInCorps ? [CommandKind.Corps] : []),
        ...(allInCorps && commanderIds.size === 1 ? [CommandKind.Detach] : []),
        // Erratum to rule 11: two batteries may combine their Unit Moves.
        ...(picked.length === 1 || (picked.length === 2 && gunsAlone) ? [CommandKind.Unit] : [])
    ]
    // Rule 11, step 5: a Corps Move attack cannot be led by artillery, so guns picked by themselves leave their corps first.
    return gunsAlone
        ? kinds.toSorted(
              (a, b) => Number(a === CommandKind.Corps) - Number(b === CommandKind.Corps)
          )
        : kinds
}

function inPlaceOrders(picked: readonly ProjectedUnit[], kind: CommandKind): MoveOrder[] {
    if (kind === CommandKind.Unit) {
        return picked.map((unit) => ({ kind, unitIds: [unit.id] }))
    }
    const commanderIds = [...new Set(picked.flatMap((unit) => unit.commanderId ?? []))]
    return commanderIds.map((commanderId) => ({
        kind,
        commanderId,
        unitIds: picked.filter((unit) => unit.commanderId === commanderId).map((unit) => unit.id)
    }))
}

export interface AttackCommand {
    options: CommandKind[]
    chosen?: CommandKind
    orders?: MoveOrder[]
}

export function attackCommand(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    pickedIds: readonly string[],
    wanted?: CommandKind
): AttackCommand {
    const picked = pickedIds.map((id) => state.unit(id))
    const attackLocale = state.map.approach(attack.attackApproach).locale
    const riding = state.roadMarch?.unitIds.some((id) => pickedIds.includes(id)) === true
    if (picked.length === 0) {
        return { options: [] }
    }
    if (riding || picked.some((unit) => unit.position?.locale !== attackLocale)) {
        const byRoad = roadAttackOrders(state, attack, picked)
        const order = byRoad.find((candidate) => candidate.kind === wanted) ?? byRoad.at(0)
        return {
            options: byRoad.map((candidate) => candidate.kind),
            chosen: order?.kind,
            orders: order ? [order] : undefined
        }
    }
    const standsTogether = picked.every(
        (unit) =>
            unit.position &&
            picked[0].position &&
            inReserve(unit.position) === inReserve(picked[0].position)
    )
    const options = standsTogether
        ? inPlaceCommands(picked).filter((kind) =>
              isLegal(() => resolveAttackOrders(state, attack, inPlaceOrders(picked, kind)))
          )
        : []
    const chosen = wanted !== undefined && options.includes(wanted) ? wanted : options[0]
    return {
        options,
        chosen,
        orders: chosen === undefined ? undefined : inPlaceOrders(picked, chosen)
    }
}

export function rideInOrders(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    pickedIds: readonly string[],
    wanted?: CommandKind
): MoveOrder[] | undefined {
    const order = roadAttackOrder(
        state,
        attack,
        pickedIds.map((id) => state.unit(id)),
        wanted
    )
    return order ? [order] : undefined
}
