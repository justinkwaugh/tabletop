import * as Type from 'typebox'
import { MESSAGE_EFFECTS, YieldScope, type MessageId } from '../components/messages.js'
import { Quality, Variety, chartYield, marketId } from '../components/potatoes.js'
import { isOrganic, type FieldState } from './playerState.js'

export type FieldHarvest = Type.Static<typeof FieldHarvest>
export const FieldHarvest = Type.Object({
    fieldId: Type.Number(),
    variety: Type.Enum(Variety),
    fertilized: Type.Boolean(),
    organic: Type.Boolean(),
    worms: Type.Number(),
    chart: Type.Number(),
    adjustment: Type.Number(),
    sacks: Type.Number()
})

// A field's crop from the "Erträge" chart, changed by this year's message. A field without
// worms is biologically dead and yields nothing at all.
export function harvestField(field: FieldState, message?: MessageId): FieldHarvest | undefined {
    if (field.seed === undefined) {
        return undefined
    }
    const fertilized = field.fertilizer > 0
    const organic = isOrganic(field)
    const chart = chartYield(field.seed, fertilized, field.worms)
    const adjustment = message ? messageAdjustment(field, field.seed, organic, message) : 0
    return {
        fieldId: field.id,
        variety: field.seed,
        fertilized,
        organic,
        worms: field.worms,
        chart,
        adjustment,
        sacks: field.worms === 0 ? 0 : Math.max(0, chart + adjustment)
    }
}

function messageAdjustment(
    field: FieldState,
    variety: Variety,
    organic: boolean,
    message: MessageId
): number {
    const category = marketId(variety, organic ? Quality.Bio : Quality.Norm)
    let adjustment = 0
    for (const effect of MESSAGE_EFFECTS[message]) {
        if (effect.kind === 'Yield' && appliesTo(effect.scope, field)) {
            adjustment += effect.changes[category] ?? 0
        }
    }
    return adjustment
}

function appliesTo(scope: YieldScope, field: FieldState): boolean {
    switch (scope) {
        case YieldScope.AllFields:
            return true
        case YieldScope.Unsprayed:
            return !field.poison
        case YieldScope.Unfertilized:
            return field.fertilizer === 0
    }
}
