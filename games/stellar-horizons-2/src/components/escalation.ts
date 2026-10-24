import { TechField } from './techFields.js'

// The 39 escalation counters, transcribed from the Vassal module's fronts (rulebook 1.7, Player
// Guide 2.5). The numbered fronts are victory points; the red ones are penalties, each scoring
// -1 at the end; the two purple Earth production counters are bonuses.
export enum EscalationMarker {
    Points1 = 'Points1',
    Points2 = 'Points2',
    Points3 = 'Points3',
    Points4 = 'Points4',
    Points5 = 'Points5',
    EarthCash = 'EarthCash',
    NoAttack = 'NoAttack',
    Initiative20 = 'Initiative20',
    Initiative30 = 'Initiative30',
    Initiative40 = 'Initiative40',
    SettlementCost1 = 'SettlementCost1',
    SettlementCost2 = 'SettlementCost2',
    SaleCost1 = 'SaleCost1',
    SaleCost2 = 'SaleCost2',
    Migration20 = 'Migration20',
    Migration30 = 'Migration30',
    EarthEngineering = 'EarthEngineering',
    EarthPhysics = 'EarthPhysics'
}

export interface EscalationEffects {
    points?: number
    // Printed in red: -1 victory point at the end.
    penalty?: true
    earthCash?: number
    earthMarker?: TechField
    initiative?: number
    earthSettlementCost?: number
    saleChange?: number
    migrationChange?: number
    forbidsAttacks?: true
}

export interface EscalationDefinition {
    marker: EscalationMarker
    count: number
    // The printed text, line breaks as spaces.
    text: string
    effects: EscalationEffects
}

const M = EscalationMarker

function points(marker: EscalationMarker, value: number, count: number): EscalationDefinition {
    return { marker, count, text: `${value}`, effects: { points: value } }
}

function penalty(
    marker: EscalationMarker,
    count: number,
    text: string,
    effects: EscalationEffects
): EscalationDefinition {
    return { marker, count, text, effects: { ...effects, penalty: true } }
}

export const ESCALATION_MARKERS: readonly EscalationDefinition[] = [
    points(M.Points1, 1, 2),
    points(M.Points2, 2, 4),
    points(M.Points3, 3, 4),
    points(M.Points4, 4, 3),
    // The module's file is named "Escalation 6"; the counter prints 5.
    points(M.Points5, 5, 1),
    penalty(M.EarthCash, 4, 'Earth Production -$2B Cash', { earthCash: -2 }),
    penalty(M.NoAttack, 4, 'You Can’t Attack', { forbidsAttacks: true }),
    penalty(M.Initiative20, 2, 'Initiative Roll -20%', { initiative: -20 }),
    penalty(M.Initiative30, 1, 'Initiative Roll -30%', { initiative: -30 }),
    penalty(M.Initiative40, 1, 'Initiative Roll -40%', { initiative: -40 }),
    penalty(M.SettlementCost1, 4, 'Settlements cost +$1B on Earth', { earthSettlementCost: 1 }),
    penalty(M.SettlementCost2, 1, 'Settlements cost +$2B on Earth', { earthSettlementCost: 2 }),
    penalty(M.SaleCost1, 1, 'Earn -$1B per Trade Good Sold', { saleChange: -1 }),
    penalty(M.SaleCost2, 1, 'Earn -$2B per Trade Good Sold', { saleChange: -2 }),
    penalty(M.Migration20, 1, 'Migration Chance -20%', { migrationChange: -20 }),
    penalty(M.Migration30, 2, 'Migration Chance -30%', { migrationChange: -30 }),
    {
        marker: M.EarthEngineering,
        count: 2,
        text: 'Earth Production +1 Eng Marker',
        effects: { earthMarker: TechField.Engineering }
    },
    {
        marker: M.EarthPhysics,
        count: 1,
        text: 'Earth Production +1 Physics Marker',
        effects: { earthMarker: TechField.Physics }
    }
]

export function escalationDefinition(marker: EscalationMarker): EscalationDefinition {
    const definition = ESCALATION_MARKERS.find((candidate) => candidate.marker === marker)
    if (!definition) {
        throw new Error(`Unknown escalation marker ${marker}`)
    }
    return definition
}

export function fullEscalationPool(): EscalationMarker[] {
    return ESCALATION_MARKERS.flatMap((definition) =>
        Array.from({ length: definition.count }, () => definition.marker)
    )
}

export function escalationPoints(marker: EscalationMarker): number {
    const { effects } = escalationDefinition(marker)
    return (effects.points ?? 0) - (effects.penalty ? 1 : 0)
}
