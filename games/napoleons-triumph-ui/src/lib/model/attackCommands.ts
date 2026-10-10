import {
    CommandKind,
    UnitType,
    commanderCanCommand,
    hasUsableCommand,
    independentCommandsLeft,
    inReserve,
    isLegal,
    resolveAttackOrders,
    roadAttackOrder,
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

function inPlaceCommands(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    picked: readonly ProjectedUnit[]
): CommandKind[] {
    const corpsIds = new Set(picked.map((unit) => unit.commanderId))
    if (corpsIds.size !== 1) {
        return picked.every((unit) => unit.commanderId !== undefined)
            ? [CommandKind.Corps]
            : [CommandKind.Unit]
    }
    const [commanderId] = corpsIds
    const single = picked.length === 1 && independentCommandsLeft(state, playerId) > 0
    if (commanderId === undefined) {
        return single ? [CommandKind.Unit] : []
    }
    const corps = state.corpsUnits(commanderId)
    const commanded = commanderCanCommand(state, state.commander(commanderId))
    const gunsAlone = picked.every((unit) => unit.face?.type === UnitType.Artillery)
    const kinds = [
        ...(commanded ? [CommandKind.Corps] : []),
        ...(commanded && picked.length < corps.length ? [CommandKind.Detach] : []),
        ...(single && corps.length > 1 ? [CommandKind.Unit] : [])
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
        const order = roadAttackOrder(state, attack, picked)
        return order
            ? { options: [order.kind], chosen: order.kind, orders: [order] }
            : { options: [] }
    }
    const standsTogether = picked.every(
        (unit) =>
            unit.position &&
            picked[0].position &&
            inReserve(unit.position) === inReserve(picked[0].position)
    )
    const options = standsTogether
        ? inPlaceCommands(state, attack.attackerId, picked).filter((kind) =>
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
    pickedIds: readonly string[]
): MoveOrder[] | undefined {
    const order = roadAttackOrder(
        state,
        attack,
        pickedIds.map((id) => state.unit(id))
    )
    return order ? [order] : undefined
}
