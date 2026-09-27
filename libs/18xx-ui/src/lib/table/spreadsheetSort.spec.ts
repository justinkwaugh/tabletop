import { expect, it } from 'vitest'
import {
    nextSpreadsheetSort,
    orderedAs,
    seatOrderFrom,
    sortedForSpreadsheet
} from './spreadsheetSort.js'

it('cycles a header through ascending, descending and unsorted', () => {
    const ascending = nextSpreadsheetSort(undefined, 'cash')
    expect(ascending).toEqual({ key: 'cash', direction: 'ascending' })
    const descending = nextSpreadsheetSort(ascending, 'cash')
    expect(descending).toEqual({ key: 'cash', direction: 'descending' })
    expect(nextSpreadsheetSort(descending, 'cash')).toBeUndefined()
})

it('starts a different header ascending', () => {
    expect(nextSpreadsheetSort({ key: 'cash', direction: 'descending' }, 'netWorth')).toEqual({
        key: 'netWorth',
        direction: 'ascending'
    })
})

it('keeps ties in item order and missing values last in either direction', () => {
    const items = [
        { id: 'A', value: 20 },
        { id: 'B', value: undefined },
        { id: 'C', value: 10 },
        { id: 'D', value: 20 }
    ]
    const columns = { value: { value: (item: (typeof items)[number]) => item.value } }
    const ids = (direction: 'ascending' | 'descending') =>
        sortedForSpreadsheet(items, { key: 'value', direction }, columns).map((item) => item.id)
    expect(ids('ascending')).toEqual(['C', 'A', 'D', 'B'])
    expect(ids('descending')).toEqual(['A', 'D', 'C', 'B'])
    expect(sortedForSpreadsheet(items, undefined, columns)).toBe(items)
})

it('orders ties by the column tie order in either direction', () => {
    const items = [
        { id: 'A', value: 20 },
        { id: 'B', value: 10 },
        { id: 'C', value: 20 }
    ]
    const tieOrder = orderedAs(['C', 'B', 'A'])
    const columns = {
        value: {
            value: (item: (typeof items)[number]) => item.value,
            tieOrder: (a: (typeof items)[number], b: (typeof items)[number]) => tieOrder(a.id, b.id)
        }
    }
    const ids = (direction: 'ascending' | 'descending') =>
        sortedForSpreadsheet(items, { key: 'value', direction }, columns).map((item) => item.id)
    expect(ids('ascending')).toEqual(['B', 'C', 'A'])
    expect(ids('descending')).toEqual(['C', 'A', 'B'])
})

it('rotates the seat order so the viewer comes first', () => {
    expect(seatOrderFrom(['a', 'b', 'c', 'd'], 'c')).toEqual(['c', 'd', 'a', 'b'])
    expect(seatOrderFrom(['a', 'b', 'c'], undefined)).toEqual(['a', 'b', 'c'])
    expect(() => seatOrderFrom(['a', 'b'], 'z')).toThrow()
})
