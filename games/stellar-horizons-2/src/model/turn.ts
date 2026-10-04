export enum TurnStep {
    Build = 'Build',
    Cargo = 'Cargo',
    Movement = 'Movement',
    Exploration = 'Exploration',
    Development = 'Development',
    Done = 'Done'
}

export const TURN_STEPS: readonly TurnStep[] = [
    TurnStep.Build,
    TurnStep.Cargo,
    TurnStep.Movement,
    TurnStep.Exploration,
    TurnStep.Development,
    TurnStep.Done
]

export function nextTurnStep(step: TurnStep): TurnStep {
    const index = TURN_STEPS.indexOf(step)
    return TURN_STEPS[Math.min(index + 1, TURN_STEPS.length - 1)]
}

export function roundHalfUp(value: number): number {
    return Math.floor(value + 0.5)
}
