import { assert } from '@tabletop/common'
import {
    ALLIED_CORPS_COMMAND_LIMIT,
    INDEPENDENT_COMMANDS,
    Side,
    commanderDefinition
} from '../components/pieces.js'
import { frenchArrivalRound } from '../components/timeTrack.js'
import { CommandKind, type MoveOrder } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { samePosition, type Commander, type Position, type ProjectedUnit } from './pieces.js'

export interface ResolvedOrder {
    order: MoveOrder
    commander?: Commander
    units: ProjectedUnit[]
    /** Units of the corps that stay behind and leave it. */
    leftBehind: ProjectedUnit[]
    /** Where the commanded pieces stand; absent for pieces still off the map. */
    start?: Position
}

/** French reinforcements may be commanded twice in the turn they enter (rule 10). */
function commandAllowance(state: HydratedNapoleonsTriumphGameState, piece: {
    playerId: string
    enteredThisTurn?: true
}): number {
    return piece.enteredThisTurn && state.sideOf(piece.playerId) === Side.French ? 2 : 1
}

export function canStillMove(
    state: HydratedNapoleonsTriumphGameState,
    unit: ProjectedUnit
): boolean {
    return !unit.fixed && (unit.movesThisTurn ?? 0) < commandAllowance(state, unit)
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
    const player = state.getPlayerState(commander.playerId)
    return player.side !== Side.Allied || player.corpsCommandsUsed < ALLIED_CORPS_COMMAND_LIMIT
}

export function independentCommandsLeft(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string
): number {
    const player = state.getPlayerState(playerId)
    return INDEPENDENT_COMMANDS[state.sideOf(playerId)] - player.independentCommandsUsed
}

/** Whether a reinforcement may come onto the map this round. */
export function mayEnter(state: HydratedNapoleonsTriumphGameState, commanderId: string): boolean {
    const definition = commanderDefinition(commanderId)
    return (
        definition.side === Side.Allied ||
        state.round >= frenchArrivalRound(state.scenario, commanderId)
    )
}

/** Checks who an order commands and that they may still be commanded. Throws when it is not legal. */
export function resolveOrder(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    order: MoveOrder
): ResolvedOrder {
    assert(new Set(order.unitIds).size === order.unitIds.length, 'An order names each unit once')
    const units = order.unitIds.map((id) => state.unit(id))
    for (const unit of units) {
        assert(unit.playerId === playerId, `Unit ${unit.id} belongs to the other army`)
        assert(canStillMove(state, unit), `Unit ${unit.id} cannot be moved again this turn`)
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
    return { order, commander, units, leftBehind, start: commander.position }
}

export function movingCommander(resolved: ResolvedOrder): Commander | undefined {
    return resolved.order.kind === CommandKind.Corps ? resolved.commander : undefined
}

/** Spends the command and marks its pieces as moved; applies the detachments the command implies. */
export function expendOrder(state: HydratedNapoleonsTriumphGameState, resolved: ResolvedOrder) {
    const { order, commander, units, leftBehind } = resolved
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

export function sameStart(orders: readonly ResolvedOrder[]): boolean {
    return orders.every((resolved) => samePosition(resolved.start, orders[0].start))
}
