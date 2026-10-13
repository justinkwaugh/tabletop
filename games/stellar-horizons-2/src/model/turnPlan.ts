import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { TurnPhase } from './turn.js'

export enum MergeDirection {
    Initiative = 'Initiative',
    ReverseInitiative = 'ReverseInitiative'
}

export type MergeForm = 'ordered' | 'barrier'

export interface PhaseDefinition {
    phase: TurnPhase
    branchingState: MachineState
    playState: MachineState
    direction: MergeDirection
    merge: MergeForm
}

// Rulebook 1.0: building and movement go in reverse initiative order and cargo transfer in
// initiative order, while exploration and tech development are simultaneous.
export const PHASE_DEFINITIONS: Record<TurnPhase, PhaseDefinition> = {
    [TurnPhase.Build]: {
        phase: TurnPhase.Build,
        branchingState: MachineState.BuildPhase,
        playState: MachineState.Building,
        direction: MergeDirection.ReverseInitiative,
        merge: 'ordered'
    },
    [TurnPhase.Cargo]: {
        phase: TurnPhase.Cargo,
        branchingState: MachineState.CargoPhase,
        playState: MachineState.TransferringCargo,
        direction: MergeDirection.Initiative,
        merge: 'ordered'
    },
    [TurnPhase.Movement]: {
        phase: TurnPhase.Movement,
        branchingState: MachineState.MovementPhase,
        playState: MachineState.Moving,
        direction: MergeDirection.ReverseInitiative,
        merge: 'ordered'
    },
    [TurnPhase.Exploration]: {
        phase: TurnPhase.Exploration,
        branchingState: MachineState.ExplorationPhase,
        playState: MachineState.Exploring,
        direction: MergeDirection.Initiative,
        merge: 'barrier'
    },
    [TurnPhase.Development]: {
        phase: TurnPhase.Development,
        branchingState: MachineState.DevelopmentPhase,
        playState: MachineState.Developing,
        direction: MergeDirection.Initiative,
        merge: 'barrier'
    }
}

export function phaseDefinition(phase: TurnPhase): PhaseDefinition {
    return PHASE_DEFINITIONS[phase]
}

export function branchingState(phase: TurnPhase): MachineState {
    return PHASE_DEFINITIONS[phase].branchingState
}

export function playState(phase: TurnPhase): MachineState {
    return PHASE_DEFINITIONS[phase].playState
}

export function phaseOfMachineState(machineState: MachineState): TurnPhase | undefined {
    return Object.values(PHASE_DEFINITIONS).find(
        (definition) =>
            definition.branchingState === machineState || definition.playState === machineState
    )?.phase
}

export function playPhase(state: { machineState: MachineState }): TurnPhase | undefined {
    return Object.values(PHASE_DEFINITIONS).find(
        (definition) => definition.playState === state.machineState
    )?.phase
}

export function currentPhase(state: { machineState: MachineState }): TurnPhase {
    const phase = phaseOfMachineState(state.machineState)
    assertExists(phase, `${state.machineState} is not part of a turn phase`)
    return phase
}

export function scenarioPhases(state: HydratedStellarHorizonsGameState): readonly TurnPhase[] {
    return state.scenarioDefinition().phases
}

export function firstPhase(state: HydratedStellarHorizonsGameState): TurnPhase {
    const [phase] = scenarioPhases(state)
    assertExists(phase, 'The scenario has no turn phases')
    return phase
}

export function phaseAfter(
    state: HydratedStellarHorizonsGameState,
    phase: TurnPhase
): TurnPhase | undefined {
    const phases = scenarioPhases(state)
    return phases[phases.indexOf(phase) + 1]
}

export function mergeOrder(state: HydratedStellarHorizonsGameState, phase: TurnPhase): string[] {
    const order = state.initiativeOrder()
    return PHASE_DEFINITIONS[phase].direction === MergeDirection.Initiative
        ? order
        : order.toReversed()
}

export function branchPlayerId(state: HydratedStellarHorizonsGameState): string {
    const playerId = state.parallelSpan?.branchPlayerId
    assertExists(playerId, 'No Branch is being played')
    return playerId
}
