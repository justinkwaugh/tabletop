export enum TurnPhase {
    Build = 'Build',
    Combat = 'Combat',
    Cargo = 'Cargo',
    Movement = 'Movement',
    Exploration = 'Exploration',
    Development = 'Development',
    Initiative = 'Initiative',
    BaseProduction = 'BaseProduction',
    TradeGoods = 'TradeGoods'
}

export const TURN_PHASES: readonly TurnPhase[] = [
    TurnPhase.Build,
    TurnPhase.Cargo,
    TurnPhase.Movement,
    TurnPhase.Exploration,
    TurnPhase.Development
]

// Rulebook 1.0: combat is campaign-only, between building and cargo.
export const CAMPAIGN_TURN_PHASES: readonly TurnPhase[] = TURN_PHASES.toSpliced(
    TURN_PHASES.indexOf(TurnPhase.Build) + 1,
    0,
    TurnPhase.Combat
)

// Every phase but combat is a Parallel Span; combat is played on the Main Line throughout.
export type SpanPhase = Exclude<TurnPhase, TurnPhase.Combat>

export function roundHalfUp(value: number): number {
    return Math.floor(value + 0.5)
}
