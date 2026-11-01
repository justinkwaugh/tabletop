import { PlanKind, type FieldSale, type Plan, type Variety } from '@tabletop/dicke-kartoffeln'

// Each click or entry while planning is one manual edit; Undo takes back the latest.
export type PlanEdit =
    | { kind: 'take'; fieldId: number }
    | { kind: 'plough'; fieldId: number }
    | { kind: 'seed'; fieldId: number; variety?: Variety }
    | { kind: 'fertilize'; fieldId: number }
    | { kind: 'spray'; fieldId: number }
    | { kind: 'offer'; fieldId: number; norm: number; bio: number }
    | { kind: 'offers'; sales: FieldSale[] }
    | { kind: 'spread'; fieldId: number }

export type PlanDraft = { key: string; edits: PlanEdit[] }

type FieldEditKind = 'take' | 'plough' | 'fertilize' | 'spray' | 'spread'

function counts(edits: readonly PlanEdit[], kind: FieldEditKind): Map<number, number> {
    const result = new Map<number, number>()
    for (const edit of edits) {
        if (edit.kind === kind && 'fieldId' in edit) {
            result.set(edit.fieldId, (result.get(edit.fieldId) ?? 0) + 1)
        }
    }
    return result
}

function toggled(edits: readonly PlanEdit[], kind: FieldEditKind): number[] {
    return [...counts(edits, kind)]
        .filter(([, times]) => times % 2 === 1)
        .map(([fieldId]) => fieldId)
        .toSorted((a, b) => a - b)
}

function transfers(edits: readonly PlanEdit[], kind: 'take' | 'spread') {
    return [...counts(edits, kind)]
        .map(([fieldId, worms]) => ({ fieldId, worms }))
        .toSorted((a, b) => a.fieldId - b.fieldId)
}

function latestSeeds(edits: readonly PlanEdit[]) {
    const seeds = new Map<number, Variety | undefined>()
    for (const edit of edits) {
        if (edit.kind === 'seed') seeds.set(edit.fieldId, edit.variety)
    }
    return [...seeds]
        .flatMap(([fieldId, variety]) => (variety ? [{ fieldId, variety }] : []))
        .toSorted((a, b) => a.fieldId - b.fieldId)
}

function latestOffers(edits: readonly PlanEdit[]): FieldSale[] {
    const offers = new Map<number, FieldSale>()
    for (const edit of edits) {
        if (edit.kind === 'offer') offers.set(edit.fieldId, edit)
        if (edit.kind === 'offers') {
            for (const sale of edit.sales) offers.set(sale.fieldId, sale)
        }
    }
    return [...offers.values()]
        .filter((offer) => offer.norm + offer.bio > 0)
        .map(({ fieldId, norm, bio }) => ({ fieldId, norm, bio }))
        .toSorted((a, b) => a.fieldId - b.fieldId)
}

export function draftPlan(kind: PlanKind, edits: readonly PlanEdit[]): Plan {
    switch (kind) {
        case PlanKind.TakeCompost:
            return { kind, takes: transfers(edits, 'take') }
        case PlanKind.Cultivate:
            return { kind, fieldIds: toggled(edits, 'plough') }
        case PlanKind.Sow:
            return { kind, seeds: latestSeeds(edits) }
        case PlanKind.Fertilize:
            return { kind, fieldIds: toggled(edits, 'fertilize') }
        case PlanKind.Spray:
            return { kind, fieldIds: toggled(edits, 'spray') }
        case PlanKind.RegisterSales:
            return { kind, sales: latestOffers(edits) }
        case PlanKind.SpreadCompost:
            return { kind, placements: transfers(edits, 'spread') }
    }
}
