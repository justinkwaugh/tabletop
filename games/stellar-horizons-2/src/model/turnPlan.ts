import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { type SpanPhase, TurnPhase } from './turn.js'

export enum MergeDirection {
    Initiative = 'Initiative',
    ReverseInitiative = 'ReverseInitiative'
}

export type MergeForm = 'ordered' | 'barrier'

export interface PhaseDefinition {
    phase: SpanPhase
    branchingState: MachineState
    playState: MachineState
    direction: MergeDirection
    merge: MergeForm
}

// Rulebook 1.0: building and movement go in reverse initiative order and cargo transfer in
// initiative order, while exploration and tech development are simultaneous. The campaign's
// initiative declaration, base production choices and goods assignment (4.1, 4.4, 4.5) are
// simultaneous too.
export const PHASE_DEFINITIONS: Record<SpanPhase, PhaseDefinition> = {
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
    },
    [TurnPhase.Initiative]: {
        phase: TurnPhase.Initiative,
        branchingState: MachineState.InitiativePhase,
        playState: MachineState.DecidingInitiative,
        direction: MergeDirection.Initiative,
        merge: 'barrier'
    },
    [TurnPhase.BaseProduction]: {
        phase: TurnPhase.BaseProduction,
        branchingState: MachineState.BaseProductionPhase,
        playState: MachineState.ChoosingProduction,
        direction: MergeDirection.Initiative,
        merge: 'barrier'
    },
    [TurnPhase.TradeGoods]: {
        phase: TurnPhase.TradeGoods,
        branchingState: MachineState.TradeGoodsPhase,
        playState: MachineState.AssigningGoods,
        direction: MergeDirection.Initiative,
        merge: 'barrier'
    },
    // Rulebook 5.1: directives drawn are chosen at the same time, in secret.
    [TurnPhase.Directives]: {
        phase: TurnPhase.Directives,
        branchingState: MachineState.DirectivePhase,
        playState: MachineState.ChoosingDirective,
        direction: MergeDirection.Initiative,
        merge: 'barrier'
    }
}

// The campaign plays the cargo and trade phase on the Main Line, one Player at a time in
// initiative order, since selling draws from the shared demand pool (campaign plan, decision 1).
export const MAIN_LINE_PHASE_STATES: Partial<Record<MachineState, TurnPhase>> = {
    [MachineState.Trading]: TurnPhase.Cargo,
    [MachineState.Attacking]: TurnPhase.Combat,
    [MachineState.Defending]: TurnPhase.Combat,
    [MachineState.AssigningHits]: TurnPhase.Combat,
    [MachineState.ResolvingRaid]: TurnPhase.Combat,
    [MachineState.EndingCombat]: TurnPhase.Combat
}

export const SPAN_PHASES = Object.values(PHASE_DEFINITIONS).map((definition) => definition.phase)

export function isSpanPhase(phase: TurnPhase): phase is SpanPhase {
    return phase in PHASE_DEFINITIONS
}

// The Players still to play a Main Line phase, first in line first.
export function mainLineQueue(state: HydratedStellarHorizonsGameState): string[] | undefined {
    switch (MAIN_LINE_PHASE_STATES[state.machineState]) {
        case TurnPhase.Cargo:
            return state.remainingTraders
        case TurnPhase.Combat:
            return state.remainingAttackers
        default:
            return undefined
    }
}

export function phaseDefinition(phase: SpanPhase): PhaseDefinition {
    return PHASE_DEFINITIONS[phase]
}

export function branchingState(phase: SpanPhase): MachineState {
    return PHASE_DEFINITIONS[phase].branchingState
}

export function playState(phase: SpanPhase): MachineState {
    return PHASE_DEFINITIONS[phase].playState
}

export function phaseOfMachineState(machineState: MachineState): TurnPhase | undefined {
    return (
        Object.values(PHASE_DEFINITIONS).find(
            (definition) =>
                definition.branchingState === machineState || definition.playState === machineState
        )?.phase ?? MAIN_LINE_PHASE_STATES[machineState]
    )
}

export function playPhase(state: { machineState: MachineState }): TurnPhase | undefined {
    return (
        Object.values(PHASE_DEFINITIONS).find(
            (definition) => definition.playState === state.machineState
        )?.phase ?? MAIN_LINE_PHASE_STATES[state.machineState]
    )
}

export function currentPhase(state: { machineState: MachineState }): TurnPhase {
    const phase = phaseOfMachineState(state.machineState)
    assertExists(phase, `${state.machineState} is not part of a turn phase`)
    return phase
}

// The campaign's first turn has only exploration and development (rulebook 3.0).
export function scenarioPhases(state: HydratedStellarHorizonsGameState): readonly TurnPhase[] {
    const scenario = state.scenarioDefinition()
    return state.year === scenario.startYear && scenario.firstTurnPhases
        ? scenario.firstTurnPhases
        : scenario.phases
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

export function mergeOrder(state: HydratedStellarHorizonsGameState, phase: SpanPhase): string[] {
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
