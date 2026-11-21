import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import {
    EighteenUSACharters,
    EighteenUSACorporations,
    EighteenUSAMarket,
    EighteenUSAPrivates,
    ImportExportHubToken,
    LoanSupply,
    MetropolisCandidates,
    RedAreaIds,
    RedAreaTokens,
    Subsidies,
    SubsidyCityIds,
    assignRedAreaTokens,
    assignSubsidies,
    certificateLimit,
    guaranteedPrivateIds,
    isAcquisitionSpace,
    isLiquidationSpace,
    isSafeParSpace,
    loanInterestRate,
    loanTiers,
    resourceSubsidyKinds,
    selectMetropolises,
    selectPrivates,
    startingCash
} from './index.js'

const prng = (seed: number) => new Prng({ seed, invocations: 0 })
const faceValue = (id: string) =>
    EighteenUSAPrivates.find((item) => item.id === id)?.faceValue ?? Number.NaN

describe('the stock market', () => {
    const prices = EighteenUSAMarket.spaces.map((space) => space.price)

    it('is one row from liquidation through 800', () => {
        expect(prices).toHaveLength(70)
        expect(prices.slice(0, 9)).toEqual([0, 0, 0, 0, 42, 44, 46, 48, 50])
        expect(prices.at(-1)).toBe(800)
        expect(isLiquidationSpace(EighteenUSAMarket.spaces[0])).toBe(true)
        expect(EighteenUSAMarket.spaces.slice(1, 4).every(isAcquisitionSpace)).toBe(true)
    })

    it('marks the par range and its safe spaces', () => {
        const par = EighteenUSAMarket.spaces.filter(
            (space) => space.color === 'pink' || isSafeParSpace(space)
        )
        expect([par[0].price, par.at(-1)?.price]).toEqual([50, 200])
        expect(par).toHaveLength(28)
        expect(EighteenUSAMarket.spaces.filter(isSafeParSpace).map((space) => space.price)).toEqual(
            [53, 74, 120]
        )
    })

    it('moves along the row and never into liquidation', () => {
        const [liquidation, acquisition] = EighteenUSAMarket.spaces
        expect(acquisition.moves).toEqual({
            right: EighteenUSAMarket.spaces[2].id,
            up: EighteenUSAMarket.spaces[2].id
        })
        expect(liquidation.moves.left).toBeUndefined()
        expect(EighteenUSAMarket.spaces.at(-1)?.moves.right).toBeUndefined()
    })
})

describe('players and loans', () => {
    it('gives the rulebook’s starting cash and certificate limits', () => {
        const counts = [2, 3, 4, 5, 6, 7]
        expect(counts.map(startingCash)).toEqual([630, 420, 315, 300, 250, 225])
        expect(counts.map(certificateLimit)).toEqual([32, 21, 16, 16, 13, 11])
    })

    it('lends 70 loans on either side of the Bank of New York', () => {
        const total = (playerCount: number) =>
            loanTiers(playerCount).reduce((sum, tier) => sum + tier.loans, 0)
        expect([2, 4, 5, 7].map(total)).toEqual([70, 70, 70, 70].map(() => LoanSupply))
        expect(
            loanTiers(4)
                .map((tier) => tier.rate)
                .at(-1)
        ).toBe(70)
        expect(loanTiers(5).slice(0, 2)).toEqual([
            { rate: 5, loans: 4 },
            { rate: 10, loans: 6 }
        ])
        expect(loanTiers(5).at(-1)).toEqual({ rate: 60, loans: 6 })
    })

    it('charges the rate of the row the loans have reached', () => {
        expect([0, 5, 6, 70].map((taken) => loanInterestRate(loanTiers(3), taken))).toEqual([
            5, 5, 10, 70
        ])
        expect([0, 4, 5, 10, 11, 70].map((taken) => loanInterestRate(loanTiers(6), taken))).toEqual(
            [5, 5, 10, 10, 15, 60]
        )
    })
})

describe('corporations and privates', () => {
    it('charters twenty two-share corporations', () => {
        expect(EighteenUSACorporations).toHaveLength(20)
        expect(new Set(EighteenUSACorporations.map((company) => company.id)).size).toBe(20)
        for (const company of EighteenUSACorporations)
            expect(EighteenUSACharters.shareCount(company.id)).toBe(2)
    })

    it('lists the thirty privates at their face values', () => {
        expect(EighteenUSAPrivates.map((item) => item.id)).toEqual(
            Array.from({ length: 30 }, (_, index) => `P${index + 1}`)
        )
        const byValue = Map.groupBy(EighteenUSAPrivates, (item) => item.faceValue)
        expect(
            [...byValue].map(([value, items]) => [value, items.length]).sort((a, b) => a[0] - b[0])
        ).toEqual([
            [30, 3],
            [40, 8],
            [60, 7],
            [80, 5],
            [90, 5],
            [120, 2]
        ])
    })

    it('draws the guaranteed privates and the rulebook’s count of each face value', () => {
        for (const playerCount of [2, 4, 5, 7])
            for (const seed of [1, 2, 3]) {
                const chosen = selectPrivates(playerCount, prng(seed))
                expect(chosen).toEqual(expect.arrayContaining(guaranteedPrivateIds(playerCount)))
                const drawn = chosen.filter((id) => !guaranteedPrivateIds(playerCount).includes(id))
                expect(
                    [30, 40, 60, 80, 90, 120].map(
                        (value) => drawn.filter((id) => faceValue(id) === value).length
                    )
                ).toEqual([1, 2, 3, 2, 2, 1])
                expect(chosen).toHaveLength(playerCount >= 5 ? 16 : 15)
            }
        expect(selectPrivates(4, prng(7))).toEqual(selectPrivates(4, prng(7)))
    })
})

describe('random setup', () => {
    it('chooses three of the six metropolises', () => {
        const { metropolisIds, remainingIds } = selectMetropolises(prng(5))
        expect(metropolisIds).toHaveLength(3)
        expect([...metropolisIds, ...remainingIds].sort()).toEqual(
            MetropolisCandidates.map((city) => city.locationId).sort()
        )
        expect(selectMetropolises(prng(5))).toEqual({ metropolisIds, remainingIds })
        const seen = new Set(
            [1, 2, 3, 4, 5, 6, 7, 8].flatMap((seed) => selectMetropolises(prng(seed)).metropolisIds)
        )
        expect(seen.size).toBe(6)
    })

    it('deals fourteen of the sixteen subsidy tiles to the subsidy cities', () => {
        expect(Subsidies).toHaveLength(16)
        expect(Subsidies.filter((subsidy) => subsidy.effect.kind === 'none')).toHaveLength(7)
        expect(
            Subsidies.flatMap((subsidy) =>
                subsidy.effect.kind === 'cash' ? [subsidy.effect.amount] : []
            )
        ).toEqual([30, 30, 40, 50])
        const assignment = assignSubsidies(prng(9))
        expect(Object.keys(assignment).sort()).toEqual([...SubsidyCityIds].sort())
        expect(new Set(Object.values(assignment)).size).toBe(14)
        expect(assignSubsidies(prng(9))).toEqual(assignment)
    })

    it('offers the resources whose privates are not all in play', () => {
        expect(resourceSubsidyKinds(['P12', 'P18', 'P24', 'P28'])).toEqual([])
        expect(resourceSubsidyKinds(['P12', 'P18', 'P24'])).toEqual(['coal'])
        expect(resourceSubsidyKinds(['P1', 'P2', 'P3', 'P4'])).toEqual(['coal', 'oil', 'ore'])
    })

    it('deals a different value token to each red area', () => {
        expect(RedAreaTokens).toHaveLength(10)
        expect(RedAreaTokens.map((token) => token.id)).not.toContain(ImportExportHubToken.id)
        const assignment = assignRedAreaTokens(prng(11))
        expect(Object.keys(assignment)).toEqual([...RedAreaIds])
        expect(new Set(Object.values(assignment)).size).toBe(7)
        expect(assignRedAreaTokens(prng(11))).toEqual(assignment)
    })
})
