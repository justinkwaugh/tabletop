import { expect, it } from 'vitest'
import {
    chooseSplitParent,
    chooseSplitBranch,
    chooseSplitPrice,
    backSplitSelection,
    hasSplitSelection,
    splitRequest,
    type BranchSplitSelection
} from '../../../../games/the-old-prince-ui/src/lib/branchSplitSelection.js'
function selected(): BranchSplitSelection {
    return chooseSplitPrice(chooseSplitBranch(chooseSplitParent({}, 'So'), 'branch:BB'), '3:1')
}
it('reselecting a parent or branch clears dependent selections', () => {
    expect(chooseSplitParent(selected(), 'ML')).toEqual({
        parentId: { value: 'ML', source: 'manual' }
    })
    expect(chooseSplitBranch(selected(), 'branch:CB')).toEqual({
        parentId: { value: 'So', source: 'manual' },
        branchId: { value: 'branch:CB', source: 'manual' }
    })
})
it('Back removes one manual stage at a time without changing the original draft', () => {
    const original = selected()
    const priceRemoved = backSplitSelection(original)
    expect(priceRemoved.marketSpaceId).toBeUndefined()
    expect(priceRemoved.branchId?.value).toBe('branch:BB')
    expect(backSplitSelection(priceRemoved).branchId).toBeUndefined()
    expect(backSplitSelection(backSplitSelection(priceRemoved))).toEqual({})
    expect(original).toEqual(selected())
    expect(backSplitSelection({})).toEqual({})
})
it('only a complete draft produces a request and auto-only values do not consume Undo', () => {
    expect(splitRequest(chooseSplitParent({}, 'So'), 'alex')).toBeUndefined()
    expect(splitRequest(selected(), 'alex')).toEqual({
        playerId: 'alex',
        parentId: 'So',
        branchId: 'branch:BB',
        marketSpaceId: '3:1'
    })
    expect(hasSplitSelection(selected())).toBe(true)
    expect(hasSplitSelection({})).toBe(false)
    expect(hasSplitSelection({ parentId: { source: 'auto', value: 'So' } })).toBe(false)
})

it('clears allocations when earlier choices change and returns to the financial preview with Back', async () => {
    const { chooseSplitAllocation } =
        await import('../../../../games/the-old-prince-ui/src/lib/branchSplitSelection.js')
    const allocation = {
        stationIds: ['So:station:1'],
        homeStationId: 'So:station:1',
        trainIds: [],
        cash: 10,
        hunslet: false
    }
    const draft = chooseSplitAllocation(selected(), allocation)
    expect(backSplitSelection(draft)).toEqual(selected())
    expect(chooseSplitPrice(draft, '5:1').allocation).toBeUndefined()
    expect(chooseSplitBranch(draft, 'branch:CB').allocation).toBeUndefined()
    expect(chooseSplitParent(draft, 'ML').allocation).toBeUndefined()
})
