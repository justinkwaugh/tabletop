import { AnomalyChallenge } from './anomalyCatalog.js'
import { SOL_SYSTEM_ID } from './systems.js'
import { TradeGood } from './tradeGoods.js'
import { WorldClass } from './worldTypes.js'

// Rulebook 5.1 and the module's 42 directive markers (`notes/vassal-inventory.md` 3.8 and
// appendix C.1). A6 has no image in the module, which reuses A5's; it is the science 9+ for 4 VP
// that completes the set (campaign plan, slice 6, Q2).
export enum DirectiveType {
    Anomaly = 'Anomaly',
    Combat = 'Combat',
    Production = 'Production',
    Survey = 'Survey',
    Trade = 'Trade',
    Terraform = 'Terraform'
}

export enum DirectiveAttack {
    Raid = 'Raid',
    FleetCombat = 'FleetCombat',
    Blockade = 'Blockade'
}

export enum DirectiveProduction {
    MiningCash = 'MiningCash',
    ResearchMarkers = 'ResearchMarkers',
    BaseProductionCash = 'BaseProductionCash'
}

export type DirectiveCondition =
    | { kind: DirectiveType.Anomaly; challenge: AnomalyChallenge; difficulty: number }
    // Against the Player with the most settlements at bases, other than the holder.
    | { kind: DirectiveType.Combat; attack: DirectiveAttack }
    // Totalled over the turn.
    | { kind: DirectiveType.Production; production: DirectiveProduction; amount: number }
    | { kind: DirectiveType.Survey; systemId: string }
    // Goods sold in the system over the turn, of one kind or any.
    | { kind: DirectiveType.Trade; systemId: string; count: number; good?: TradeGood }
    // A world terraformed into one of these classes.
    | { kind: DirectiveType.Terraform; classes: readonly WorldClass[] }

export interface DirectiveDefinition {
    id: string
    condition: DirectiveCondition
    points: number
}

export function directiveType(directive: DirectiveDefinition): DirectiveType {
    return directive.condition.kind
}

function anomaly(id: string, challenge: AnomalyChallenge, difficulty: number, points: number) {
    return {
        id,
        condition: { kind: DirectiveType.Anomaly, challenge, difficulty },
        points
    } as const
}

function combat(id: string, attack: DirectiveAttack, points: number) {
    return { id, condition: { kind: DirectiveType.Combat, attack }, points } as const
}

function production(id: string, kind: DirectiveProduction, amount: number, points: number) {
    return {
        id,
        condition: { kind: DirectiveType.Production, production: kind, amount },
        points
    } as const
}

function survey(id: string, systemId: string, points: number) {
    return { id, condition: { kind: DirectiveType.Survey, systemId }, points } as const
}

function trade(id: string, systemId: string, count: number, points: number, good?: TradeGood) {
    return {
        id,
        condition: { kind: DirectiveType.Trade, systemId, count, ...(good ? { good } : {}) },
        points
    } as const
}

function terraform(id: string, classes: readonly WorldClass[], points: number) {
    return { id, condition: { kind: DirectiveType.Terraform, classes }, points } as const
}

const { Combat: CombatChallenge, Science } = AnomalyChallenge
const { Raid, FleetCombat, Blockade } = DirectiveAttack
const { MiningCash, ResearchMarkers, BaseProductionCash } = DirectiveProduction
const { M, O, L, H, P } = WorldClass

export const DIRECTIVES: readonly DirectiveDefinition[] = [
    anomaly('a1', CombatChallenge, 5, 2),
    anomaly('a2', CombatChallenge, 7, 3),
    anomaly('a3', CombatChallenge, 9, 4),
    anomaly('a4', Science, 5, 2),
    anomaly('a5', Science, 7, 3),
    anomaly('a6', Science, 9, 4),
    combat('c1', Raid, 2),
    combat('c2', Raid, 2),
    combat('c3', FleetCombat, 3),
    combat('c4', FleetCombat, 3),
    combat('c5', Blockade, 2),
    combat('c6', Blockade, 2),
    production('p1', MiningCash, 3, 3),
    production('p2', MiningCash, 4, 4),
    production('p3', ResearchMarkers, 2, 4),
    production('p4', BaseProductionCash, 7, 2),
    production('p5', BaseProductionCash, 9, 3),
    production('p6', BaseProductionCash, 12, 4),
    survey('s1', 'sirius', 2),
    survey('s2', 'epsilon-eridani', 2),
    survey('s3', 'tau-ceti', 2),
    survey('s4', 'procyon', 2),
    survey('s5', 'vega', 3),
    survey('s6', 'arcturus', 4),
    survey('s7', 'alpha-mensae', 4),
    survey('s8', '72-herculis', 5),
    survey('s9', 'beta-aquilae', 5),
    survey('s10', '18-scorpii', 5),
    trade('t1', SOL_SYSTEM_ID, 2, 3),
    trade('t2', SOL_SYSTEM_ID, 3, 4),
    trade('t3', SOL_SYSTEM_ID, 2, 4, TradeGood.Ore),
    trade('t4', SOL_SYSTEM_ID, 2, 3),
    trade('t5', SOL_SYSTEM_ID, 1, 4, TradeGood.FineArt),
    trade('t6', SOL_SYSTEM_ID, 1, 3, TradeGood.RareMaterials),
    trade('t7', 'alpha-centauri', 2, 3),
    trade('t8', 'barnards-star', 2, 3),
    trade('t9', 'epsilon-eridani', 2, 3),
    terraform('tf1', [M], 7),
    terraform('tf2', [O, M], 6),
    terraform('tf3', [L, O, M], 5),
    terraform('tf4', [H, L, O, M], 4),
    terraform('tf5', [P, H, L, O, M], 3)
]

export function directiveDefinition(directiveId: string): DirectiveDefinition {
    const directive = DIRECTIVES.find((candidate) => candidate.id === directiveId)
    if (!directive) {
        throw new Error(`Unknown directive ${directiveId}`)
    }
    return directive
}

// Rulebook 5.1: each faction must fulfil a number of directives of the listed types, or lose 15
// points for each one short. With no types listed, any directive counts.
export interface DirectiveGoal {
    count: number
    types: readonly DirectiveType[]
}

export const DIRECTIVE_SHORTFALL_PENALTY = 15
export const DIRECTIVE_INFLUENCE = 1
export const DIRECTIVE_REDRAW_COST = 1
// Each Player draws 3 at the start and keeps 1; afterwards they draw 2 and keep 1.
export const FIRST_DIRECTIVE_DRAW = 3
export const DIRECTIVE_DRAW = 2

export function countsForGoal(goal: DirectiveGoal, directive: DirectiveDefinition): boolean {
    return goal.types.length === 0 || goal.types.includes(directiveType(directive))
}
