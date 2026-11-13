import { describe, expect, it } from 'vitest'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isEndRound } from '../actions/endRound.js'
import { edition } from '../editions/editions.js'
import {
    creditSuisseDividend,
    loanLimit,
    totalSubsidiesPerShare
} from '../editions/switzerland/rules.js'
import {
    ActionSpaceId,
    CompanyId,
    EditionId,
    Industry,
    InvestmentItem,
    printedPointyHex as hex
} from '../editions/types.js'
import { Table } from '../testing/table.js'
import type { TrackHex } from './components.js'
import { PlacementKind } from './track.js'

const SWITZERLAND = { edition: EditionId.Switzerland }
const ALTDORF = hex(8, 28)
const GOTTHARD = hex(10, 28)
const GOTTHARD_NORTH = hex(9, 27)
const SOUTH_OF_GOTTHARD = hex(12, 30)
const HILLSIDE_BESIDE_ALTDORF = hex(9, 29)

// p0 opens; p1 buys the MOB share and the Start Player token with it.
const BUYERS = {
    [CompanyId.SNB]: 'p0',
    [CompanyId.AB]: 'p1',
    [CompanyId.PB]: 'p2',
    [CompanyId.RHB]: 'p3',
    [CompanyId.MOB]: 'p1'
}

function openedTable(): Table {
    const table = new Table(4, SWITZERLAND)
    table.playInitialAuction(BUYERS)
    return table
}

function choose(table: Table, space: ActionSpaceId) {
    table.act(table.active, { type: ActionType.ChooseAction, space })
}

// p1 holds a PB share and the PB has track at Altdorf, beside the Gotthard's north portal.
function atAltdorf(table: Table, treasury = 30) {
    table.edit((state) => {
        state.company(CompanyId.PB).owners.push('p1')
        state.company(CompanyId.PB).treasury = treasury
        state.track.push({ coords: ALTDORF, discs: [CompanyId.PB] })
    })
}

function targets(table: Table, space: ActionSpaceId.LayTrackI | ActionSpaceId.LayTrackIII) {
    return table.hydrated.placementTargets('p1', space, CompanyId.PB)
}

function includes(list: readonly { coords: AxialCoordinates }[], coords: AxialCoordinates) {
    return list.some((target) => sameCoordinates(target.coords, coords))
}

describe('Switzerland setup', () => {
    it('starts every company with two loans and $10, and the players with the rulebook’s cash', () => {
        const state = new Table(4, SWITZERLAND).hydrated
        expect(
            state.companies.map((company) => [company.id, company.loans, company.treasury])
        ).toEqual([
            [CompanyId.SNB, 2, 10],
            [CompanyId.AB, 2, 10],
            [CompanyId.PB, 2, 10],
            [CompanyId.RHB, 2, 10],
            [CompanyId.MOB, 2, 10]
        ])
        expect(state.companies.map((company) => company.revenue)).toEqual([5, 3, 3, 5, 3])
        expect(state.players.every((player) => player.cash === 23)).toBe(true)
        expect(state.partnerSupply).toBe(10)
        for (const [count, cash] of [
            [3, 30],
            [5, 18]
        ]) {
            expect(new Table(count, SWITZERLAND).hydrated.players[0].cash).toBe(cash)
        }
    })

    it('gives the MOB buyer the first turn', () => {
        const table = openedTable()
        expect(table.hydrated.turnManager.turnOrder[0]).toBe('p1')
        expect(table.active).toBe('p1')
    })

    it('reads sixteen Industry Sites, four of each, and six tunnels', () => {
        const { map } = edition(EditionId.Switzerland).definition
        expect(map.industrySites).toHaveLength(16)
        expect(map.tolls?.map((toll) => [toll.id, toll.hexes.length, toll.stars])).toEqual([
            ['lotschberg', 2, 4],
            ['sanetsch', 1, 2],
            ['st-bernard', 1, 2],
            ['gotthard', 3, 6],
            ['albula', 1, 2],
            ['vereina', 1, 2]
        ])
    })
})

describe('Swiss track', () => {
    it('builds a whole tunnel with one disc on Lay Track III, for $4 a hex and its toll chit', () => {
        const table = openedTable()
        atAltdorf(table)
        expect(includes(targets(table, ActionSpaceId.LayTrackI), GOTTHARD)).toBe(false)
        expect(includes(targets(table, ActionSpaceId.LayTrackIII), GOTTHARD_NORTH)).toBe(false)
        const tunnel = targets(table, ActionSpaceId.LayTrackIII).find((target) =>
            sameCoordinates(target.coords, GOTTHARD)
        )
        expect(tunnel?.cost).toBe(12)
        choose(table, ActionSpaceId.LayTrackIII)
        table.act('p1', {
            type: ActionType.LayTrack,
            placements: [{ companyId: CompanyId.PB, coords: GOTTHARD, kind: PlacementKind.Disc }]
        })
        const state = table.hydrated
        expect(state.company(CompanyId.PB).treasury).toBe(18)
        expect(state.company(CompanyId.PB).revenue).toBe(3)
        expect(state.getPlayerState('p1').tolls).toEqual(['gotthard'])
        expect(includes(targets(table, ActionSpaceId.LayTrackI), SOUTH_OF_GOTTHARD)).toBe(true)
    })

    it('lets one Lay Track action build a single tunnel', () => {
        const table = openedTable()
        atAltdorf(table)
        const tunnelsAfterOne = table.hydrated.placementTargets(
            'p1',
            ActionSpaceId.LayTrackIII,
            CompanyId.PB,
            1
        )
        expect(includes(tunnelsAfterOne, GOTTHARD)).toBe(false)
    })

    it('prices hillside at $3 and a crossing cube on it at $2, paid to the crossed company', () => {
        const table = openedTable()
        atAltdorf(table)
        const hill = targets(table, ActionSpaceId.LayTrackI).find((target) =>
            sameCoordinates(target.coords, HILLSIDE_BESIDE_ALTDORF)
        )
        expect(hill?.cost).toBe(3)
        table.edit((state) => {
            state.track.push({ coords: HILLSIDE_BESIDE_ALTDORF, discs: [CompanyId.SNB] })
            state.track.push({ coords: GOTTHARD, discs: [CompanyId.SNB] })
        })
        const cubes = targets(table, ActionSpaceId.LayTrackI)
        const hillCube = cubes.find((target) =>
            sameCoordinates(target.coords, HILLSIDE_BESIDE_ALTDORF)
        )
        const tunnelCube = cubes.find((target) => sameCoordinates(target.coords, GOTTHARD))
        expect([hillCube?.kind, hillCube?.cost]).toEqual([PlacementKind.Cube, 2])
        expect([tunnelCube?.kind, tunnelCube?.cost]).toEqual([PlacementKind.Cube, 6])
    })
})

describe('Swiss loans', () => {
    it('takes a second loan only while the treasury stays under $20', () => {
        const table = openedTable()
        atAltdorf(table, 13)
        expect(table.hydrated.loanRange(ActionSpaceId.LayTrackI, CompanyId.PB)).toEqual({
            take: 2,
            repay: 1
        })
        expect(table.hydrated.loanRange(ActionSpaceId.LayTrackII, CompanyId.PB)).toEqual({
            take: 0,
            repay: 0
        })
        table.edit((state) => {
            state.company(CompanyId.PB).treasury = 16
        })
        expect(table.hydrated.loanRange(ActionSpaceId.LayTrackIII, CompanyId.PB).take).toBe(1)
    })

    it('takes out loans before the track is built', () => {
        const table = openedTable()
        atAltdorf(table, 6)
        choose(table, ActionSpaceId.LayTrackIII)
        table.act('p1', {
            type: ActionType.LayTrack,
            loan: { companyId: CompanyId.PB, change: 2 },
            placements: [{ companyId: CompanyId.PB, coords: GOTTHARD, kind: PlacementKind.Disc }]
        })
        const company = table.hydrated.company(CompanyId.PB)
        expect([company.loans, company.treasury]).toEqual([4, 6 + 10 - 12])
    })

    it('repays a loan for $10', () => {
        const table = openedTable()
        atAltdorf(table, 25)
        choose(table, ActionSpaceId.LayTrackI)
        table.act('p1', {
            type: ActionType.LayTrack,
            loan: { companyId: CompanyId.PB, change: -2 },
            placements: []
        })
        const company = table.hydrated.company(CompanyId.PB)
        expect([company.loans, company.treasury]).toEqual([0, 5])
    })

    it('rejects a loan for a company the action does not build for', () => {
        const table = openedTable()
        atAltdorf(table, 6)
        choose(table, ActionSpaceId.LayTrackII)
        expect(() =>
            table.act('p1', {
                type: ActionType.LayTrack,
                loan: { companyId: CompanyId.PB, change: 1 },
                placements: []
            })
        ).toThrow()
    })

    it('charges interest after the payout: a revenue step per loan', () => {
        const table = openedTable()
        table.edit((state) => {
            state.roundTimer = 1
            state.company(CompanyId.SNB).revenue = 20
            state.company(CompanyId.SNB).loans = 4
        })
        choose(table, ActionSpaceId.LayTrackII)
        table.act('p1', { type: ActionType.LayTrack, placements: [] })
        const endRound = table.processed.find(isEndRound)
        expect(endRound?.metadata?.rates.companies[0]).toEqual({
            companyId: CompanyId.SNB,
            perShare: 20
        })
        expect(endRound?.metadata?.interest?.[0]).toEqual({
            companyId: CompanyId.SNB,
            from: 20,
            to: 16
        })
        expect(table.hydrated.company(CompanyId.SNB).revenue).toBe(16)
    })
})

describe('Swiss Industry Investment', () => {
    function bids(table: Table, amounts: Record<string, number>) {
        choose(table, ActionSpaceId.IndustryInvestment)
        table.act('p1', { type: ActionType.InvestInIndustry, industry: Industry.Grain })
        for (const [playerId, amount] of Object.entries(amounts)) {
            table.act(playerId, { type: ActionType.PlaceSealedBid, amount })
        }
    }

    it('lets the winner choose, then offers the other item down the bids', () => {
        const table = openedTable()
        const before = table.hydrated.players.map((player) => player.cash)
        bids(table, { p1: 6, p2: 7, p3: 0, p0: 5 })
        expect(table.state.machineState).toBe(MachineState.ClaimingInvestment)
        expect(table.active).toBe('p2')
        expect(() => table.act('p2', { type: ActionType.DeclineInvestment })).toThrow()
        table.act('p2', { type: ActionType.ClaimInvestment, item: InvestmentItem.CreditSuisse })
        expect(table.active).toBe('p1')
        table.act('p1', { type: ActionType.ClaimInvestment, item: InvestmentItem.Industry })
        const state = table.hydrated
        expect(state.machineState).toBe(MachineState.ChoosingAction)
        expect(state.getPlayerState('p2').creditSuisse).toBe(1)
        expect(state.getPlayerState('p2').cash).toBe(before[2] - 7)
        expect(state.getPlayerState('p1').industryTokens).toContain(Industry.Grain)
        expect(state.getPlayerState('p1').cash).toBe(before[1] - 6)
        expect(state.partnerSupply).toBe(9)
        expect(state.industry(Industry.Grain).level).toBe(2)
    })

    it('skips bids too low for the leftover and returns it unsold', () => {
        const table = openedTable()
        bids(table, { p1: 5, p2: 0, p3: 3, p0: 0 })
        table.act('p1', { type: ActionType.ClaimInvestment, item: InvestmentItem.CreditSuisse })
        expect(table.active).toBe('p3')
        table.act('p3', { type: ActionType.DeclineInvestment })
        const state = table.hydrated
        expect(state.investmentClaim).toBeUndefined()
        expect(state.industry(Industry.Grain).level).toBe(1)
        expect(state.industry(Industry.Grain).available).toBe(3)
        expect(state.machineState).toBe(MachineState.ChoosingAction)
    })

    it('returns an unclaimed Credit Suisse share to the supply', () => {
        const table = openedTable()
        bids(table, { p1: 2, p2: 0, p3: 0, p0: 0 })
        expect(() =>
            table.act('p1', { type: ActionType.ClaimInvestment, item: InvestmentItem.CreditSuisse })
        ).toThrow()
        table.act('p1', { type: ActionType.ClaimInvestment, item: InvestmentItem.Industry })
        expect(table.hydrated.partnerSupply).toBe(10)
        expect(table.hydrated.investmentClaim).toBeUndefined()
    })
})

describe('Swiss game end', () => {
    const map = edition(EditionId.Switzerland).map
    const reach = (...coords: AxialCoordinates[]): TrackHex[] =>
        coords.map((at) => ({ coords: at, discs: [CompanyId.SNB] }))
    const context = (track: TrackHex[], revenue: number, loans: number) => ({
        companyId: CompanyId.SNB,
        revenue,
        loans,
        track,
        map
    })
    const FRANCE = hex(3, 11)
    const GERMANY = hex(2, 20)
    const AUSTRIA = hex(5, 39)
    const ITALY = [hex(14, 24), hex(15, 27)]

    it('multiplies the transalpine subsidies by the Italian factor', () => {
        expect(totalSubsidiesPerShare(context(reach(FRANCE, GERMANY), 30, 0))).toBe(0)
        expect(totalSubsidiesPerShare(context(reach(FRANCE, GERMANY, ITALY[0]), 30, 0))).toBe(12)
        expect(
            totalSubsidiesPerShare(context(reach(FRANCE, GERMANY, AUSTRIA, ...ITALY), 30, 0))
        ).toBe((6 + 6 + 4) * 2)
    })

    it('forfeits the subsidies above the Loan Limit', () => {
        const track = reach(FRANCE, ...ITALY)
        expect(loanLimit(10)).toBe(1)
        expect(loanLimit(11)).toBe(2)
        expect(totalSubsidiesPerShare(context(track, 10, 1))).toBe(12)
        expect(totalSubsidiesPerShare(context(track, 10, 2))).toBe(0)
    })

    it('pays Credit Suisse shares by every company’s loans, and toll chits at $2 a star', () => {
        expect([0, 1, 2, 3, 9, 10].map(creditSuisseDividend)).toEqual([0, 1, 1, 2, 5, 5])
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.SNB).loans = 3
            state.company(CompanyId.AB).loans = 0
            state.getPlayerState('p0').creditSuisse = 2
            state.getPlayerState('p0').tolls = ['gotthard']
        })
        const state = table.hydrated
        const rates = state.finalPayouts()
        expect(rates.perCreditSuisse).toBe(2 + 0 + 1 + 1 + 1)
        expect(rates.perTollStar).toBe(2)
        const shares = rates.companies.reduce(
            (sum, rate) => sum + rate.perShare * state.sharesHeld(rate.companyId, 'p0'),
            0
        )
        const tokens = state.getPlayerState('p0').industryTokens.length * 0
        expect(state.playerIncome('p0', rates)).toBe(shares + tokens + 2 * 5 + 6 * 2)
    })
})

describe('toll chits', () => {
    it('cash in for $1 a star, fewest stars first, when a payment needs them', () => {
        const table = openedTable()
        table.edit((state) => {
            state.getPlayerState('p0').cash = 2
            state.getPlayerState('p0').tolls = ['gotthard', 'albula']
        })
        const state = table.hydrated
        expect(state.spendingPower('p0')).toBe(10)
        expect(state.charge('p0', 4)).toEqual(['albula'])
        expect(state.getPlayerState('p0').cash).toBe(0)
        expect(state.getPlayerState('p0').tolls).toEqual(['gotthard'])
    })
})
