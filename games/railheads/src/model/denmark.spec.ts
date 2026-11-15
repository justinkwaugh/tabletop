import { describe, expect, it } from 'vitest'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { isEndRound } from '../actions/endRound.js'
import { edition } from '../editions/editions.js'
import { wealthTax } from '../editions/denmark/rules.js'
import {
    ActionSpaceId,
    CompanyId,
    EditionId,
    Industry,
    InvestmentItem,
    printedHex
} from '../editions/types.js'
import { Table } from '../testing/table.js'
import { PlacementKind } from './track.js'

const DENMARK = { edition: EditionId.Denmark }
// Rows first, as the board's doubled rows read.
const hex = (row: number, col: number): AxialCoordinates => printedHex(col, row)
const GREAT_BELT = hex(30, 12)

// p0 opens; p1 buys the DSJ share with the Start Player token and a Government Bond.
const BUYERS = {
    [CompanyId.SFJ]: 'p0',
    [CompanyId.AAAJ]: 'p1',
    [CompanyId.AHB]: 'p2',
    [CompanyId.JFJ]: 'p3',
    [CompanyId.DSJ]: 'p1'
}

function openedTable(): Table {
    const table = new Table(4, DENMARK)
    table.playInitialAuction(BUYERS)
    return table
}

function choose(table: Table, space: ActionSpaceId) {
    table.act(table.active, { type: ActionType.ChooseAction, space })
}

describe('Denmark setup', () => {
    it('opens Copenhagen at +7 and sells the DSJ share with the token and a bond', () => {
        const fresh = new Table(4, DENMARK).hydrated
        expect(fresh.company(CompanyId.DSJ).revenue).toBe(7)
        expect(fresh.companies.every((company) => company.treasury === 10)).toBe(true)
        expect(fresh.players.every((player) => player.cash === 30)).toBe(true)
        expect([fresh.partnerSupply, fresh.stateTreasury]).toEqual([12, 0])
        const state = openedTable().hydrated
        expect(state.getPlayerState('p1').bonds).toBe(1)
        expect(state.turnManager.turnOrder[0]).toBe('p1')
        expect(state.company(CompanyId.DSJ).treasury).toBe(10 + 7)
    })

    it('reads twelve Industry Sites, three of each, and thirteen bridges', () => {
        const { map } = edition(EditionId.Denmark).definition
        expect(map.industrySites).toHaveLength(12)
        expect(map.tolls).toHaveLength(13)
        expect(map.tolls?.reduce((sum, toll) => sum + toll.stars, 0)).toBe(22)
    })
})

describe('Danish bridges', () => {
    it('are built only on Lay Track III, for $6 and the toll chit', () => {
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.SFJ).owners.push('p1')
        })
        const on = (space: ActionSpaceId.LayTrackI | ActionSpaceId.LayTrackIII) =>
            table.hydrated
                .placementTargets('p1', space, CompanyId.SFJ)
                .find((target) => sameCoordinates(target.coords, GREAT_BELT))
        expect(on(ActionSpaceId.LayTrackI)).toBeUndefined()
        expect(on(ActionSpaceId.LayTrackIII)?.cost).toBe(6)
        choose(table, ActionSpaceId.LayTrackIII)
        table.act('p1', {
            type: ActionType.LayTrack,
            placements: [{ companyId: CompanyId.SFJ, coords: GREAT_BELT, kind: PlacementKind.Disc }]
        })
        expect(table.hydrated.getPlayerState('p1').tolls).toEqual(['great-belt-east'])
    })

    it('take a crossing cube for half the bridge’s price', () => {
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.SFJ).owners.push('p1')
            state.track.push({ coords: GREAT_BELT, discs: [CompanyId.DSJ] })
        })
        const cube = table.hydrated
            .placementTargets('p1', ActionSpaceId.LayTrackI, CompanyId.SFJ)
            .find((target) => sameCoordinates(target.coords, GREAT_BELT))
        expect([cube?.kind, cube?.cost]).toEqual([PlacementKind.Cube, 3])
    })

    it('price a town disc at $4 plus $2 a disc beneath', () => {
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.SFJ).owners.push('p1')
            state.track.push({ coords: hex(30, 10), discs: [CompanyId.SFJ] })
            state.track.push({ coords: hex(28, 10), discs: [CompanyId.DSJ] })
        })
        const odense = table.hydrated
            .placementTargets('p1', ActionSpaceId.LayTrackI, CompanyId.SFJ)
            .find((target) => sameCoordinates(target.coords, hex(28, 10)))
        expect(odense?.cost).toBe(6)
    })
})

describe('the Danish round end', () => {
    it('taxes cash into the State Treasury before the payout, then applies obsolescence', () => {
        expect([5, 6, 15, 16, 30, 40, 60, 61, 90].map(wealthTax)).toEqual([
            0, 1, 2, 4, 7, 10, 15, 20, 30
        ])
        const table = openedTable()
        table.edit((state) => {
            state.roundTimer = 1
            state.getPlayerState('p0').cash = 25
            state.company(CompanyId.SFJ).revenue = 25
        })
        choose(table, ActionSpaceId.LayTrackII)
        table.act('p1', { type: ActionType.LayTrack, placements: [] })
        const endRound = table.processed.find(isEndRound)
        const taxes = endRound?.metadata?.taxes ?? []
        expect(taxes[0]).toEqual({ playerId: 'p0', amount: 7 })
        const state = table.hydrated
        expect(state.stateTreasury).toBe(taxes.reduce((sum, tax) => sum + tax.amount, 0))
        expect(state.getPlayerState('p0').cash).toBe(
            25 - 7 + (endRound?.metadata?.income[0].amount ?? 0)
        )
        expect(state.company(CompanyId.SFJ).revenue).toBe(21)
    })
})

describe('Government Bonds', () => {
    function bids(table: Table, amounts: Record<string, number>) {
        choose(table, ActionSpaceId.IndustryInvestment)
        table.act('p1', { type: ActionType.InvestInIndustry, industry: Industry.Cloth })
        for (const [playerId, amount] of Object.entries(amounts)) {
            table.act(playerId, { type: ActionType.PlaceSealedBid, amount })
        }
    }

    it('send their price to a company the buyer names, or to the State Treasury', () => {
        const table = openedTable()
        const ahb = table.hydrated.company(CompanyId.AHB).treasury
        bids(table, { p1: 3, p2: 4, p3: 1, p0: 0 })
        table.act('p2', {
            type: ActionType.ClaimInvestment,
            item: InvestmentItem.Bond,
            fundedCompanyId: CompanyId.AHB
        })
        table.act('p1', { type: ActionType.ClaimInvestment, item: InvestmentItem.Industry })
        const state = table.hydrated
        expect(state.company(CompanyId.AHB).treasury).toBe(ahb + 4)
        expect(state.getPlayerState('p2').bonds).toBe(1)
        expect(state.stateTreasury).toBe(0)
        expect(state.partnerSupply).toBe(11)
    })

    it('share the State Treasury at the end, rounded up', () => {
        const table = openedTable()
        table.edit((state) => {
            state.stateTreasury = 25
            state.getPlayerState('p2').bonds = 2
        })
        const rates = table.hydrated.finalPayouts()
        expect(rates.perBond).toBe(Math.ceil(25 / 3))
        expect(rates.perTollStar).toBe(2)
        expect(rates.perCreditSuisse).toBeUndefined()
        expect(rates.companies.every((rate) => rate.perShare === 0)).toBe(true)
    })
})
