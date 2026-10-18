export enum TurnPhase {
    Build = 'Build',
    Cargo = 'Cargo',
    Movement = 'Movement',
    Exploration = 'Exploration',
    Development = 'Development',
    Initiative = 'Initiative',
    BaseProduction = 'BaseProduction'
}

export const TURN_PHASES: readonly TurnPhase[] = [
    TurnPhase.Build,
    TurnPhase.Cargo,
    TurnPhase.Movement,
    TurnPhase.Exploration,
    TurnPhase.Development
]

export function roundHalfUp(value: number): number {
    return Math.floor(value + 0.5)
}
