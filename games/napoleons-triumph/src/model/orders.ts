import {
    ALLIED_CORPS_COMMAND_LIMIT,
    INDEPENDENT_COMMANDS,
    Side,
    commanderDefinition
} from '../components/pieces.js'
import { frenchArrivalRound } from '../components/timeTrack.js'
import { CommandKind, type MoveOrder, type RoadMarch } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { areTheUnits, type Commander, type Position, type ProjectedUnit } from './pieces.js'
import { distinct, legal } from './legality.js'

export interface ResolvedOrder {
    order: MoveOrder
    playerId: string
    commander?: Commander
    units: ProjectedUnit[]
    leftBehind: ProjectedUnit[]
    start?: Position
    /** Rule 10: the roads the units may leave by, when a road move brought them to the start this turn. */
    startRoads?: number[]
    march?: RoadMarch
}

/** French reinforcements may be commanded twice in the turn they enter (rule 10). */
function commandAllowance(
    state: HydratedNapoleonsTriumphGameState,
    piece: {
        playerId: string
        enteredThisTurn?: true
    }
): number {
    return piece.enteredThisTurn && state.sideOf(piece.playerId) === Side.French ? 2 : 1
}

export function canBeCommanded(
    state: HydratedNapoleonsTriumphGameState,
    unit: ProjectedUnit
): boolean {
    return (unit.movesThisTurn ?? 0) < commandAllowance(state, unit)
}

export function mayBeCommandedAgain(
    state: HydratedNapoleonsTriumphGameState,
    resolved: ResolvedOrder
): boolean {
    const entering = resolved.start === undefined
    const spent = resolved.march ? 0 : 1
    return resolved.units.some(
        (unit) =>
            (unit.movesThisTurn ?? 0) + spent <
            commandAllowance(state, {
                playerId: unit.playerId,
                enteredThisTurn: entering ? true : unit.enteredThisTurn
            })
    )
}

/** The fixed battery takes commands to fire but never leaves its position (rule 6, step 9). */
export function canStillMove(
    state: HydratedNapoleonsTriumphGameState,
    unit: ProjectedUnit
): boolean {
    return !unit.fixed && canBeCommanded(state, unit)
}

export function commanderCanCommand(
    state: HydratedNapoleonsTriumphGameState,
    commander: Commander
): boolean {
    if (commander.eliminated) {
        return false
    }
    if ((commander.commandsThisTurn ?? 0) >= commandAllowance(state, commander)) {
        return false
    }
    return corpsCommandsLeft(state, commander.playerId) > 0
}

/** Only the Allies are limited in the corps commands they give in a turn (rule 9). */
export function corpsCommandsLeft(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string
): number {
    const player = state.getPlayerState(playerId)
    return player.side === Side.Allied
        ? ALLIED_CORPS_COMMAND_LIMIT - player.corpsCommandsUsed
        : Number.POSITIVE_INFINITY
}

export function independentCommandsLeft(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string
): number {
    const player = state.getPlayerState(playerId)
    return INDEPENDENT_COMMANDS[state.sideOf(playerId)] - player.independentCommandsUsed
}

export function hasUsableCommand(
    state: HydratedNapoleonsTriumphGameState,
    unit: ProjectedUnit
): boolean {
    if (!canBeCommanded(state, unit)) {
        return false
    }
    const commander = unit.commanderId === undefined ? undefined : state.commander(unit.commanderId)
    const leavesOthers = commander === undefined || state.corpsUnits(commander.id).length > 1
    const byCommander =
        commander !== undefined &&
        commanderCanCommand(state, commander) &&
        (!unit.fixed || leavesOthers)
    const independently = independentCommandsLeft(state, unit.playerId) > 0 && leavesOthers
    return byCommander || independently
}

/** Rule 10: a reinforcement left behind when its corps came on may follow by a Unit Move. */
function mayComeOn(state: HydratedNapoleonsTriumphGameState, unit: ProjectedUnit): boolean {
    return unit.commanderId === undefined || mayEnter(state, unit.commanderId)
}

export function canCommandAMove(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string
): boolean {
    return (
        state.roadMarch !== undefined ||
        state
            .unitsOf(playerId)
            .some(
                (unit) =>
                    canStillMove(state, unit) &&
                    hasUsableCommand(state, unit) &&
                    (unit.position !== undefined || mayComeOn(state, unit))
            )
    )
}

export function mayEnter(state: HydratedNapoleonsTriumphGameState, commanderId: string): boolean {
    const definition = commanderDefinition(commanderId)
    return (
        definition.side === Side.Allied ||
        state.round >= frenchArrivalRound(state.scenario, commanderId)
    )
}

/** Reinforcements come on only from the round the Time Track gives them (rule 10). */
export function assertArrived(state: HydratedNapoleonsTriumphGameState, resolved: ResolvedOrder) {
    legal(
        resolved.commander === undefined || mayEnter(state, resolved.commander.id),
        'That corps has not arrived yet'
    )
    legal(
        resolved.units.every(
            (unit) => unit.commanderId === undefined || mayEnter(state, unit.commanderId)
        ),
        'Those units have not arrived yet'
    )
}

/** Rule 10: in a single turn a piece moves only along connected roads, so pieces a road move brought to their locale go on by the roads they came by. */
function roadsToGoOnBy(
    units: readonly ProjectedUnit[],
    start: Position | undefined
): number[] | undefined {
    const [first, ...others] = units.flatMap((unit) =>
        unit.arrivedByRoad !== undefined && unit.arrivedByRoad.locale === start?.locale
            ? [unit.arrivedByRoad.roads]
            : []
    )
    return first?.filter((road) => others.every((roads) => roads.includes(road)))
}

export function resolveOrder(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder
): ResolvedOrder {
    legal(distinct(order.unitIds), 'An order names each unit once')
    const units = order.unitIds.map((id) => state.unit(id))
    for (const unit of units) {
        legal(unit.playerId === playerId, `Unit ${unit.id} belongs to the other army`)
    }
    if (order.continues) {
        return resolveContinuation(state, playerId, order, units)
    }
    for (const unit of units) {
        legal(canBeCommanded(state, unit), `Unit ${unit.id} cannot be moved again this turn`)
    }
    if (order.kind === CommandKind.Unit) {
        legal(order.commanderId === undefined, 'A Unit Move is not given by a commander')
        legal(units.length === 1, 'A Unit Move commands a single unit')
        const [unit] = units
        legal(independentCommandsLeft(state, playerId) > 0, 'No independent commands are left')
        if (unit.commanderId !== undefined) {
            legal(
                state.corpsUnits(unit.commanderId).length > 1,
                'A commander cannot detach its last unit'
            )
        }
        return {
            order,
            playerId,
            units,
            leftBehind: [],
            start: unit.position,
            startRoads: roadsToGoOnBy(units, unit.position)
        }
    }
    legal(order.commanderId !== undefined, `A ${order.kind} command needs a commander`)
    const commander = state.commander(order.commanderId)
    legal(commander.playerId === playerId, 'That commander belongs to the other army')
    legal(commanderCanCommand(state, commander), `${commander.id} cannot give another command`)
    const corps = state.corpsUnits(commander.id)
    legal(
        units.every((unit) => unit.commanderId === commander.id),
        `Every commanded unit must belong to the corps of ${commander.id}`
    )
    const leftBehind = corps.filter((unit) => !order.unitIds.includes(unit.id))
    if (order.kind === CommandKind.Detach) {
        legal(leftBehind.length > 0, 'A commander cannot detach its last unit')
        legal(order.road === undefined, 'Detached units cannot move by road')
        return { order, playerId, commander, units, leftBehind: [], start: commander.position }
    }
    legal(
        units.every((unit) => !unit.fixed),
        'The fixed battery cannot march with its corps'
    )
    return {
        order,
        playerId,
        commander,
        units,
        leftBehind,
        start: commander.position,
        startRoads: roadsToGoOnBy(units, commander.position)
    }
}

function resolveContinuation(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder,
    units: ProjectedUnit[]
): ResolvedOrder {
    const march = state.roadMarch
    legal(
        march !== undefined &&
            march.kind === order.kind &&
            march.commanderId === order.commanderId &&
            areTheUnits(march.unitIds, units),
        'No road move by those pieces is in progress'
    )
    const commander =
        march.commanderId === undefined ? undefined : state.commander(march.commanderId)
    return { order, playerId, commander, units, leftBehind: [], start: units[0].position, march }
}

export function movingCommander(resolved: ResolvedOrder): Commander | undefined {
    return resolved.order.kind === CommandKind.Corps ? resolved.commander : undefined
}

export function expendOrder(state: HydratedNapoleonsTriumphGameState, resolved: ResolvedOrder) {
    const { order, commander, units, leftBehind } = resolved
    if (resolved.march) {
        return
    }
    const player = state.getPlayerState(resolved.playerId)
    if (order.kind === CommandKind.Unit) {
        player.independentCommandsUsed += 1
    } else if (commander) {
        commander.commandsThisTurn = (commander.commandsThisTurn ?? 0) + 1
        player.corpsCommandsUsed += 1
    }
    for (const unit of units) {
        unit.movesThisTurn = (unit.movesThisTurn ?? 0) + 1
        if (order.kind !== CommandKind.Corps) {
            state.detach(unit)
        }
    }
    for (const unit of leftBehind) {
        state.detach(unit)
    }
}
