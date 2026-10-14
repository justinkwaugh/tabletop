import {
    CommandKind,
    UnitType,
    hasUsableCommand,
    inReserve,
    isLegal,
    resolveAttackOrders,
    rideOnAttackOrder,
    roadAttackOrder,
    roadAttackOrders,
    type HydratedNapoleonsTriumphGameState,
    type MoveOrder,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import type { VisibleAttack } from './battleStage.js'
import { RideChoice } from './moveCommands.js'

export interface AttackerGroup {
    label: string
    units: ProjectedUnit[]
}

export function attackerGroups(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    mayRide: boolean
): AttackerGroup[] {
    const locale = state.map.approach(attack.attackApproach).locale
    const riders = state.riders()
    const ridersListed = mayRide && rideOnAttackOrder(state, attack, riders) ? riders : []
    const commandable = (units: ProjectedUnit[]) =>
        units.filter((unit) => hasUsableCommand(state, unit) && !ridersListed.includes(unit))
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
        { label: 'Riding on by road', units: ridersListed },
        { label: 'Cavalry that can ride up by road', units: byRoad }
    ].filter((group) => group.units.length > 0)
}

function inPlaceCommands(picked: readonly ProjectedUnit[], wide: boolean): CommandKind[] {
    const commanderIds = new Set(picked.map((unit) => unit.commanderId))
    const allInCorps = !commanderIds.has(undefined)
    const gunsAlone = picked.every((unit) => unit.face?.type === UnitType.Artillery)
    const kinds = [
        ...(allInCorps ? [CommandKind.Corps] : []),
        ...(allInCorps && commanderIds.size === 1 ? [CommandKind.Detach] : []),
        // Erratum to rule 11: two batteries may combine their Unit Moves, both leading, which takes a wide approach.
        ...(picked.length === 1 || (picked.length === 2 && gunsAlone && wide)
            ? [CommandKind.Unit]
            : [])
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
    /** Present when the units named are cavalry riding on that could attack either way. */
    ride?: RideChoice
}

export interface RideWanted {
    /** Rule 11: an attack by road must be a feint, so there is no riding on where an attack is pressed. */
    mayRide: boolean
    ride: RideChoice
}

export function attackCommand(
    state: HydratedNapoleonsTriumphGameState,
    attack: VisibleAttack,
    pickedIds: readonly string[],
    wanted: CommandKind | undefined,
    { mayRide, ride }: RideWanted
): AttackCommand {
    const picked = pickedIds.map((id) => state.unit(id))
    const attackLocale = state.map.approach(attack.attackApproach).locale
    if (picked.length === 0) {
        return { options: [] }
    }
    if (picked.some((unit) => unit.position?.locale !== attackLocale)) {
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
        ? inPlaceCommands(picked, state.map.approach(attack.attackApproach).wide).filter((kind) =>
              isLegal(() => resolveAttackOrders(state, attack, inPlaceOrders(picked, kind)))
          )
        : []
    const rideOrder = mayRide ? rideOnAttackOrder(state, attack, picked) : undefined
    const eitherWay = rideOrder !== undefined && options.length > 0
    if (rideOrder && !(eitherWay && ride === RideChoice.NewCommand)) {
        return {
            options: [rideOrder.kind],
            chosen: rideOrder.kind,
            orders: [rideOrder],
            ride: eitherWay ? RideChoice.RidingOn : undefined
        }
    }
    const chosen = wanted !== undefined && options.includes(wanted) ? wanted : options[0]
    return {
        options,
        chosen,
        orders: chosen === undefined ? undefined : inPlaceOrders(picked, chosen),
        ride: eitherWay ? RideChoice.NewCommand : undefined
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
