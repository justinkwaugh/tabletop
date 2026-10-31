import { MarketId, Quality, marketDefinition, type DemandRange } from '@tabletop/dicke-kartoffeln'

export function marks(amount: number): string {
    return `${amount.toLocaleString('en-US')} M`
}

export function demandText(range: DemandRange): string {
    if (range.max === undefined) return `${range.min}+`
    return range.max === range.min ? `${range.min}` : `${range.min}–${range.max}`
}

export function marketName(id: MarketId): string {
    const { variety, quality } = marketDefinition(id)
    return `${variety}-${quality === Quality.Bio ? 'Bio' : 'Norm'}`
}

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`
}

export function fieldList(fieldIds: readonly number[]): string {
    const sorted = fieldIds.toSorted((a, b) => a - b)
    if (sorted.length === 1) return `field ${sorted[0]}`
    return `fields ${sorted.slice(0, -1).join(', ')} and ${sorted.at(-1)}`
}
