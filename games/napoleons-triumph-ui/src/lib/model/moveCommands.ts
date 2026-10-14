import {
    CommandKind,
    commanderCanCommand,
    commanderDefinition,
    commandersOf,
    independentCommandsLeft,
    mayEnter,
    type Commander,
    type HydratedNapoleonsTriumphGameState,
    type MoveOrder,
    type ProjectedUnit,
    type RoadMarch,
    type Side
} from '@tabletop/napoleons-triumph'

/** Rule 10: cavalry reinforcements riding on in their turn of entry may go on under the command they ride by or take their second command. */
export enum RideChoice {
    RidingOn = 'RidingOn',
    NewCommand = 'NewCommand'
}

export interface CommandedGroup {
    commander?: Commander
    units: readonly ProjectedUnit[]
}

export interface Reinforcement {
    key: string
    playerId: string
    name: string
    commander?: Commander
    units: ProjectedUnit[]
}

export function reinforcementsOf(
    state: HydratedNapoleonsTriumphGameState,
    side: Side
): Reinforcement[] {
    const { playerId } = state.playerOf(side)
    const corps = commandersOf(side)
        .map((definition) => state.commander(definition.id))
        .filter(
            (commander) =>
                !commander.eliminated &&
                commander.position === undefined &&
                mayEnter(state, commander.id)
        )
        .map((commander) => ({
            key: `reinforcement|${commander.id}`,
            playerId,
            name: commanderDefinition(commander.id).name,
            commander,
            units: state.corpsUnits(commander.id)
        }))
    // Rule 10: units left behind when their corps came on are detached and follow by Unit Moves.
    const leftBehind = state
        .unitsOf(playerId)
        .filter((unit) => unit.position === undefined && unit.commanderId === undefined)
    return leftBehind.length > 0
        ? [
              ...corps,
              {
                  key: 'reinforcement|left behind',
                  playerId,
                  name: 'Units left behind',
                  units: leftBehind
              }
          ]
        : corps
}

export function moveCommandOptions(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    group: CommandedGroup,
    pickedUnitIds: readonly string[],
    wholeCorpsChosen: boolean
): CommandKind[] {
    if (pickedUnitIds.length === 0) {
        return []
    }
    const commander = group.commander
    const canCommand = commander !== undefined && commanderCanCommand(state, commander)
    const whole = pickedUnitIds.length === group.units.length
    const detachable = commander === undefined || group.units.length > 1
    const single =
        pickedUnitIds.length === 1 && detachable && independentCommandsLeft(state, playerId) > 0
    const corps = canCommand ? [CommandKind.Corps] : []
    const detach =
        canCommand && !whole && commander.position !== undefined ? [CommandKind.Detach] : []
    const unit = single ? [CommandKind.Unit] : []
    return wholeCorpsChosen ? [...corps, ...detach, ...unit] : [...unit, ...detach, ...corps]
}

export function moveOrder(
    kind: CommandKind,
    group: CommandedGroup,
    pickedUnitIds: readonly string[]
): MoveOrder {
    return kind === CommandKind.Unit
        ? { kind, unitIds: [...pickedUnitIds] }
        : { kind, commanderId: group.commander?.id, unitIds: [...pickedUnitIds] }
}

export function rideOnOrder(march: Pick<RoadMarch, 'kind' | 'commanderId' | 'unitIds'>): MoveOrder {
    return {
        kind: march.kind,
        commanderId: march.commanderId,
        unitIds: [...march.unitIds],
        continues: true
    }
}
