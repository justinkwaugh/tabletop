import { assert } from '@tabletop/common'

export type SpreadsheetSortDirection = 'ascending' | 'descending'

export type SpreadsheetSort<Key extends string> = {
    key: Key
    direction: SpreadsheetSortDirection
}

export function nextSpreadsheetSort<Key extends string>(
    current: SpreadsheetSort<Key> | undefined,
    key: Key
): SpreadsheetSort<Key> | undefined {
    if (current?.key !== key) return { key, direction: 'descending' }
    return current.direction === 'descending' ? { key, direction: 'ascending' } : undefined
}

export function spreadsheetSortDirection<Key extends string>(
    sort: SpreadsheetSort<Key> | undefined,
    key: Key
): SpreadsheetSortDirection | undefined {
    return sort?.key === key ? sort.direction : undefined
}

export type SpreadsheetSortColumn<Item> = {
    value: (item: Item) => number | undefined
    tieOrder?: (a: Item, b: Item) => number
}

export function sortedForSpreadsheet<Item, Key extends string>(
    items: readonly Item[],
    sort: SpreadsheetSort<Key> | undefined,
    columns: Readonly<Record<Key, SpreadsheetSortColumn<NoInfer<Item>>>>
): readonly Item[] {
    if (!sort) return items
    const { value, tieOrder } = columns[sort.key]
    const sign = sort.direction === 'ascending' ? 1 : -1
    return items.toSorted((a, b) => {
        const left = value(a)
        const right = value(b)
        const order =
            left === undefined || right === undefined
                ? Number(left === undefined) - Number(right === undefined)
                : sign * (left - right)
        return order || (tieOrder?.(a, b) ?? 0)
    })
}

export function orderedAs<Id>(order: readonly Id[]): (a: Id, b: Id) => number {
    return (a, b) => order.indexOf(a) - order.indexOf(b)
}

export function seatOrderFrom(
    playerIds: readonly string[],
    firstPlayerId: string | undefined
): string[] {
    if (firstPlayerId === undefined) return [...playerIds]
    const index = playerIds.indexOf(firstPlayerId)
    assert(index >= 0, 'The first seat must belong to a player in the game')
    return [...playerIds.slice(index), ...playerIds.slice(0, index)]
}
