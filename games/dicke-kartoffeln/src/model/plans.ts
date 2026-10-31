import * as Type from 'typebox'
import { Variety } from '../components/potatoes.js'
import { MachineState } from '../definition/states.js'

// What each farmer decides in a simultaneous round. Plans stay sealed until every farmer has
// committed, then are revealed and carried out together.
export enum PlanKind {
    TakeCompost = 'TakeCompost',
    Cultivate = 'Cultivate',
    Sow = 'Sow',
    Fertilize = 'Fertilize',
    Spray = 'Spray',
    RegisterSales = 'RegisterSales',
    SpreadCompost = 'SpreadCompost'
}

export type WormTransfer = Type.Static<typeof WormTransfer>
export const WormTransfer = Type.Object({
    fieldId: Type.Number(),
    worms: Type.Number()
})

export type Seeding = Type.Static<typeof Seeding>
export const Seeding = Type.Object({
    fieldId: Type.Number(),
    variety: Type.Enum(Variety)
})

export type SaleQuantities = Type.Static<typeof SaleQuantities>
export const SaleQuantities = Type.Object({
    norm: Type.Number(),
    bio: Type.Number()
})

export type FieldSale = Type.Static<typeof FieldSale>
export const FieldSale = Type.Object({
    fieldId: Type.Number(),
    norm: Type.Number(),
    bio: Type.Number()
})

export type TakeCompostPlan = Type.Static<typeof TakeCompostPlan>
export const TakeCompostPlan = Type.Object({
    kind: Type.Literal(PlanKind.TakeCompost),
    takes: Type.Array(WormTransfer)
})

export type CultivatePlan = Type.Static<typeof CultivatePlan>
export const CultivatePlan = Type.Object({
    kind: Type.Literal(PlanKind.Cultivate),
    fieldIds: Type.Array(Type.Number())
})

export type SowPlan = Type.Static<typeof SowPlan>
export const SowPlan = Type.Object({
    kind: Type.Literal(PlanKind.Sow),
    seeds: Type.Array(Seeding)
})

export type FertilizePlan = Type.Static<typeof FertilizePlan>
export const FertilizePlan = Type.Object({
    kind: Type.Literal(PlanKind.Fertilize),
    fieldIds: Type.Array(Type.Number())
})

export type SprayPlan = Type.Static<typeof SprayPlan>
export const SprayPlan = Type.Object({
    kind: Type.Literal(PlanKind.Spray),
    fieldIds: Type.Array(Type.Number())
})

export type RegisterSalesPlan = Type.Static<typeof RegisterSalesPlan>
export const RegisterSalesPlan = Type.Object({
    kind: Type.Literal(PlanKind.RegisterSales),
    sales: Type.Array(FieldSale)
})

// Worms from compost pile 2 not spread on a field are sold to the bank.
export type SpreadCompostPlan = Type.Static<typeof SpreadCompostPlan>
export const SpreadCompostPlan = Type.Object({
    kind: Type.Literal(PlanKind.SpreadCompost),
    placements: Type.Array(WormTransfer)
})

export type Plan = Type.Static<typeof Plan>
export const Plan = Type.Union([
    TakeCompostPlan,
    CultivatePlan,
    SowPlan,
    FertilizePlan,
    SprayPlan,
    RegisterSalesPlan,
    SpreadCompostPlan
])

export type PlanOutcome = Type.Static<typeof PlanOutcome>
export const PlanOutcome = Type.Object({
    playerId: Type.String(),
    plan: Plan,
    cost: Type.Number(),
    income: Type.Number(),
    loansTaken: Type.Number()
})

export type PlanningState =
    | MachineState.TakingCompost
    | MachineState.Cultivating
    | MachineState.Sowing
    | MachineState.Fertilizing
    | MachineState.Spraying
    | MachineState.RegisteringSales
    | MachineState.SpreadingCompost

const PLAN_KIND_BY_STATE: Record<PlanningState, PlanKind> = {
    [MachineState.TakingCompost]: PlanKind.TakeCompost,
    [MachineState.Cultivating]: PlanKind.Cultivate,
    [MachineState.Sowing]: PlanKind.Sow,
    [MachineState.Fertilizing]: PlanKind.Fertilize,
    [MachineState.Spraying]: PlanKind.Spray,
    [MachineState.RegisteringSales]: PlanKind.RegisterSales,
    [MachineState.SpreadingCompost]: PlanKind.SpreadCompost
}

export const PLANNING_STATES = Object.keys(PLAN_KIND_BY_STATE).filter(isPlanningState)

export function isPlanningState(state: string): state is PlanningState {
    return Object.hasOwn(PLAN_KIND_BY_STATE, state)
}

export function planKindFor(state: PlanningState): PlanKind {
    return PLAN_KIND_BY_STATE[state]
}

export function emptyPlan(kind: PlanKind): Plan {
    switch (kind) {
        case PlanKind.TakeCompost:
            return { kind, takes: [] }
        case PlanKind.Cultivate:
        case PlanKind.Fertilize:
        case PlanKind.Spray:
            return { kind, fieldIds: [] }
        case PlanKind.Sow:
            return { kind, seeds: [] }
        case PlanKind.RegisterSales:
            return { kind, sales: [] }
        case PlanKind.SpreadCompost:
            return { kind, placements: [] }
    }
}
