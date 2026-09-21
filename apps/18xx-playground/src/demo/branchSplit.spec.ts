import { describe, expect, it } from 'vitest'
import {
    Definition as Top,
    TheOldPrinceBranchSplit,
    TheOldPrinceBranches
} from '@tabletop/the-old-prince'
import { Definition as Shikoku } from '@tabletop/shikoku-1889'
import {
    getCompany,
    sameOwner,
    sharesOwned,
    type Owner,
    type EighteenXXState
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
const alex = { kind: 'player', playerId: 'alex' } as const
const blair = { kind: 'player', playerId: 'blair' } as const
const bank = { kind: 'bank' } as const
const union = { kind: 'company', companyId: 'UB' } as const
const treasury = { kind: 'company', companyId: 'So' } as const
const request = { playerId: 'alex', parentId: 'So', branchId: 'branch:BB', marketSpaceId: '3:1' }
function preview(state = example(Top, 'split').state) {
    const result = new TheOldPrinceBranchSplit(state).evaluate(request)
    expect(result.reason).toBeUndefined()
    if (!result.details) throw new Error(result.reason)
    return result.details
}
function allocate(state: EighteenXXState, owners: { owner: Owner; poolId?: string }[]) {
    for (const [index, allocation] of owners.entries()) {
        const certificate = state.certificates.find((c) => c.id === `So:share:${index + 1}`)
        if (!certificate || certificate.retired) throw new Error('Missing parent share')
        certificate.owner = allocation.owner
        delete certificate.poolId
        if (allocation.poolId) certificate.poolId = allocation.poolId
    }
}
it('previews the 50/30/20 split with exact certificate identities and no canonical changes', () => {
    const { state } = example(Top, 'split')
    const before = structuredClone(state)
    const details = preview(state)
    expect(
        details.ownership.map((row) => [
            row.owner,
            row.beforeShares,
            row.exchangedShares,
            row.parentShares,
            row.childShares
        ])
    ).toEqual([
        [alex, 5, 2, 3, 2],
        [blair, 3, 1, 2, 1],
        [bank, 2, 1, 1, 7],
        [treasury, 0, 0, 4, 0]
    ])
    expect(details.childFunding).toBe(560)
    expect(details.childFloated).toBe(false)
    expect(details.sharesUntilFlotation).toBe(3)
    expect(details.certificateTransfers.filter((t) => t.poolId === 'treasury:So')).toHaveLength(4)
    expect(details.certificateTransfers).toContainEqual({
        certificateId: 'branch:BB:president',
        owner: alex
    })
    expect(details.certificateTransfers.some((t) => t.certificateId === 'So:president')).toBe(false)
    expect(new Set(details.certificateTransfers.map((t) => t.certificateId)).size).toBe(
        details.certificateTransfers.length
    )
    expect(details.parentCash).toBe(120)
    expect(details.parentTrains.map((t) => t.definitionId)).toEqual(['3H'])
    expect(details.hunsletCertificateId).toBe('HS:charter')
    expect(
        details.stations.filter((s) => s.protectedHome).map((s) => s.station.position.locationId)
    ).toEqual(['T12'])
    expect(details.stations.filter((s) => !s.protectedHome)).toHaveLength(2)
    expect(preview(state)).toEqual(details)
    expect(state).toEqual(before)
})
it('rounds players and Union Bank independently and preserves reserved exchange shares', () => {
    const { state } = example(Top, 'split')
    allocate(state, [
        { owner: alex },
        { owner: alex },
        { owner: blair },
        { owner: union },
        { owner: union },
        { owner: union },
        { owner: bank, poolId: 'market' },
        { owner: bank, poolId: 'reserved' }
    ])
    const details = preview(state)
    expect(details.ownership.find((row) => sameOwner(row.owner, alex))?.childShares).toBe(2)
    expect(details.ownership.find((row) => sameOwner(row.owner, union))?.childShares).toBe(1)
    expect(details.ownership.find((row) => row.reserved)).toMatchObject({
        beforeShares: 1,
        exchangedShares: 0,
        parentShares: 1,
        childShares: 0
    })
    expect(details.certificateTransfers.some((t) => t.certificateId === 'So:share:8')).toBe(false)
    expect(details.ownership.find((row) => sameOwner(row.owner, treasury))?.parentShares).toBe(3)
})
it('retains existing treasury shares and rounds eligible Bank shares across pools together', () => {
    const { state } = example(Top, 'split')
    state.certificatePools.push({ id: 'ipo', name: 'IPO', owner: bank })
    allocate(state, [
        { owner: alex },
        { owner: alex },
        { owner: bank, poolId: 'market' },
        { owner: bank, poolId: 'ipo' },
        { owner: treasury, poolId: 'treasury:So' },
        { owner: treasury, poolId: 'treasury:So' },
        { owner: bank, poolId: 'reserved' },
        { owner: bank, poolId: 'reserved' }
    ])
    const details = preview(state)
    expect(
        details.ownership.find((row) => row.owner.kind === 'bank' && !row.reserved)
    ).toMatchObject({ beforeShares: 2, exchangedShares: 1, parentShares: 1, childShares: 8 })
    expect(details.ownership.find((row) => sameOwner(row.owner, treasury))).toMatchObject({
        beforeShares: 2,
        exchangedShares: 0,
        parentShares: 5
    })
    expect(
        details.certificateTransfers.some((t) =>
            ['So:share:5', 'So:share:6'].includes(t.certificateId)
        )
    ).toBe(false)
})
it('does not combine a player’s shares with Union Bank for split eligibility', () => {
    const { state } = example(Top, 'split')
    allocate(state, [
        { owner: alex },
        { owner: union },
        { owner: bank, poolId: 'market' },
        { owner: blair },
        { owner: blair },
        { owner: bank, poolId: 'market' },
        { owner: bank, poolId: 'market' },
        { owner: bank, poolId: 'market' }
    ])
    expect(sharesOwned(state, 'So', alex)).toBe(3)
    expect(new TheOldPrinceBranchSplit(state).evaluate(request).reason).toMatch(
        /four parent shares/
    )
    getCompany(state, 'So').president = union
    expect(new TheOldPrinceBranchSplit(state).evaluate(request).reason).toMatch(/president/)
})
describe('split eligibility', () => {
    it.each([
        [
            'unfloated',
            (state: EighteenXXState) => {
                getCompany(state, 'So').floated = false
            }
        ],
        [
            'closed',
            (state: EighteenXXState) => {
                getCompany(state, 'So').closed = true
            }
        ],
        [
            'wrong president',
            (state: EighteenXXState) => {
                getCompany(state, 'So').president = blair
            }
        ],
        [
            'one station',
            (state: EighteenXXState) => {
                state.stations = state.stations.filter(
                    (s) => s.companyId !== 'So' || s.id === 'So:home'
                )
            }
        ],
        [
            'bought',
            (state: EighteenXXState) => {
                state.stockRound.turn.bought = true
            }
        ],
        [
            'other turn',
            (state: EighteenXXState) => {
                state.activePlayerIds = ['blair']
            }
        ],
        [
            'outside stock round',
            (state: EighteenXXState) => {
                state.machineState = 'BuyingTrains'
            }
        ],
        [
            'full chart',
            (state: EighteenXXState) => {
                state.tranches = state.tranches.slice(0, 1)
            }
        ],
        [
            'locked tranche',
            (state: EighteenXXState) => {
                getCompany(state, 'So').operated = false
            }
        ]
    ])('rejects %s', (_name, change) => {
        const { state } = example(Top, 'split')
        change(state)
        expect(new TheOldPrinceBranchSplit(state).evaluate(request).reason).toBeDefined()
    })
    it('rejects PEIR, geographic companies as branches, and branches already started', () => {
        const { state } = example(Top, 'split')
        const model = new TheOldPrinceBranchSplit(state)
        expect(model.evaluate({ ...request, parentId: 'PEIR' }).reason).toBeDefined()
        expect(model.evaluate({ ...request, branchId: 'ML' }).reason).toBeDefined()
        getCompany(state, 'branch:BB').started = true
        expect(model.evaluate(request).reason).toBeDefined()
    })
})
it.each([
    ['3H', [80, 74, 65, 58]],
    ['5H', [74, 65, 58]],
    ['3+', [65, 58]],
    ['7', [58]]
])('applies phase %s prices to branch funding', (phase, prices) => {
    const { state } = example(Top, 'split')
    state.phaseId = phase
    const model = new TheOldPrinceBranchSplit(state)
    expect(model.prices().map((p) => p.price)).toEqual(prices)
    for (const price of model.prices())
        expect(model.evaluate({ ...request, marketSpaceId: price.id }).details?.childFunding).toBe(
            price.price * 7
        )
    expect(model.evaluate({ ...request, marketSpaceId: '1:1' }).reason).toBeDefined()
})
it('conserves each company’s share units across the preview transfers', () => {
    const { state } = example(Top, 'split')
    const details = preview(state)
    for (const transfer of details.certificateTransfers) {
        const certificate = state.certificates.find((c) => c.id === transfer.certificateId)
        if (!certificate || certificate.retired) throw new Error('Missing transfer certificate')
        certificate.owner = transfer.owner
        delete certificate.poolId
        if (transfer.poolId) certificate.poolId = transfer.poolId
    }
    for (const row of details.ownership) {
        expect(sharesOwned(state, 'So', row.owner)).toBe(row.parentShares)
        expect(sharesOwned(state, 'branch:BB', row.owner)).toBe(row.childShares)
    }
    expect(details.ownership.reduce((sum, row) => sum + row.parentShares, 0)).toBe(10)
    expect(details.ownership.reduce((sum, row) => sum + row.childShares, 0)).toBe(10)
})
it('registers six distinct branch charters in TOP setup and none in 1889', () => {
    const top = example(Top, 'opening').state
    for (const branch of TheOldPrinceBranches) {
        expect(getCompany(top, branch.id).started).toBe(false)
        expect(top.certificates.filter((c) => c.companyId === branch.id)).toHaveLength(9)
        expect(top.stations.filter((s) => s.companyId === branch.id)).toHaveLength(4)
    }
    expect(new Set(top.companies.map((c) => c.id)).size).toBe(top.companies.length)
    expect(
        example(Shikoku).state.companies.some((c) =>
            TheOldPrinceBranches.some((branch) => branch.id === c.id)
        )
    ).toBe(false)
})
