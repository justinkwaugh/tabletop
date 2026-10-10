import { assert } from '@tabletop/common'
import {
    ALLIED_CORPS_COMMAND_LIMIT,
    INDEPENDENT_COMMANDS,
    Side,
    commanderDefinition
} from '../components/pieces.js'
import { frenchArrivalRound } from '../components/timeTrack.js'
import { CommandKind, type MoveOrder, type RoadMarch } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import type { Commander, Position, ProjectedUnit } from './pieces.js'

export interface ResolvedOrder {
    order: MoveOrder
    commander?: Commander
    units: ProjectedUnit[]
    leftBehind: ProjectedUnit[]
    start?: Position
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

export function mayEnter(state: HydratedNapoleonsTriumphGameState, commanderId: string): boolean {
    const definition = commanderDefinition(commanderId)
    return (
        definition.side === Side.Allied ||
        state.round >= frenchArrivalRound(state.scenario, commanderId)
    )
}

/** Reinforcements come on only from the round the Time Track gives them (rule 10). */
export function assertArrived(state: HydratedNapoleonsTriumphGameState, resolved: ResolvedOrder) {
    assert(
        resolved.commander === undefined || mayEnter(state, resolved.commander.id),
        'That corps has not arrived yet'
    )
    assert(
        resolved.units.every(
            (unit) => unit.commanderId === undefined || mayEnter(state, unit.commanderId)
        ),
        'Those units have not arrived yet'
    )
}

export function resolveOrder(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder
): ResolvedOrder {
    assert(new Set(order.unitIds).size === order.unitIds.length, 'An order names each unit once')
    const units = order.unitIds.map((id) => state.unit(id))
    for (const unit of units) {
        assert(unit.playerId === playerId, `Unit ${unit.id} belongs to the other army`)
    }
    if (order.continues) {
        return resolveContinuation(state, order, units)
    }
    for (const unit of units) {
        assert(canBeCommanded(state, unit), `Unit ${unit.id} cannot be moved again this turn`)
    }
    if (order.kind === CommandKind.Unit) {
        assert(order.commanderId === undefined, 'A Unit Move is not given by a commander')
        assert(units.length === 1, 'A Unit Move commands a single unit')
        const [unit] = units
        assert(independentCommandsLeft(state, playerId) > 0, 'No independent commands are left')
        if (unit.commanderId !== undefined) {
            assert(
                state.corpsUnits(unit.commanderId).length > 1,
                'A commander cannot detach its last unit'
            )
        }
        return { order, units, leftBehind: [], start: unit.position }
    }
    assert(order.commanderId !== undefined, `A ${order.kind} command needs a commander`)
    const commander = state.commander(order.commanderId)
    assert(commander.playerId === playerId, 'That commander belongs to the other army')
    assert(commanderCanCommand(state, commander), `${commander.id} cannot give another command`)
    const corps = state.corpsUnits(commander.id)
    assert(
        units.every((unit) => unit.commanderId === commander.id),
        `Every commanded unit must belong to the corps of ${commander.id}`
    )
    const leftBehind = corps.filter((unit) => !order.unitIds.includes(unit.id))
    if (order.kind === CommandKind.Detach) {
        assert(leftBehind.length > 0, 'A commander cannot detach its last unit')
        assert(order.road === undefined, 'Detached units cannot move by road')
        return { order, commander, units, leftBehind: [], start: commander.position }
    }
    assert(
        units.every((unit) => !unit.fixed),
        'The fixed battery cannot march with its corps'
    )
    return { order, commander, units, leftBehind, start: commander.position }
}

function resolveContinuation(
    state: HydratedNapoleonsTriumphGameState,
    order: MoveOrder,
    units: ProjectedUnit[]
): ResolvedOrder {
    const march = state.roadMarch
    assert(
        march !== undefined &&
            march.kind === order.kind &&
            march.commanderId === order.commanderId &&
            march.unitIds.length === units.length &&
            units.every((unit) => march.unitIds.includes(unit.id)),
        'No road move by those pieces is in progress'
    )
    const commander =
        march.commanderId === undefined ? undefined : state.commander(march.commanderId)
    return { order, commander, units, leftBehind: [], start: units[0].position, march }
}

export function movingCommander(resolved: ResolvedOrder): Commander | undefined {
    return resolved.order.kind === CommandKind.Corps ? resolved.commander : undefined
}

export function expendOrder(state: HydratedNapoleonsTriumphGameState, resolved: ResolvedOrder) {
    const { order, commander, units, leftBehind } = resolved
    if (resolved.march) {
        return
    }
    const player = state.getPlayerState(units[0].playerId)
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
