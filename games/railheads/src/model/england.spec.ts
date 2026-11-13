import { describe, expect, it } from 'vitest'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { edition } from '../editions/editions.js'
import {
    ActionSpaceId,
    CompanyId,
    EditionId,
    INDUSTRIES,
    printedHex,
    type LayTrackSpace
} from '../editions/types.js'
import { Table } from '../testing/table.js'
import { PlacementKind } from './track.js'

const ENGLAND = { edition: EditionId.EnglandWales }
const hex = (row: number, col: number): AxialCoordinates => printedHex(col, row)
const LIVERPOOL = hex(7, 9)
const LONDON = hex(24, 16)
const READING = hex(24, 14)
const BESIDE_LANCASTER = hex(3, 11)
const MIDLANDS_CHAIN = [hex(3, 11), hex(4, 12), hex(5, 11), hex(6, 12), hex(6, 10)]
const EAST_OF_LANCASTER = hex(2, 12)

// p0 opens; p1 buys the Underground share and the First Player token with it.
const BUYERS = {
    [CompanyId.LMS]: 'p0',
    [CompanyId.LNER]: 'p1',
    [CompanyId.SR]: 'p2',
    [CompanyId.GWR]: 'p3',
    [CompanyId.UERL]: 'p1'
}

function openedTable(): Table {
    const table = new Table(4, ENGLAND)
    table.playInitialAuction(BUYERS)
    return table
}

function choose(table: Table, space: ActionSpaceId) {
    table.act(table.active, { type: ActionType.ChooseAction, space })
}

function lmsTarget(table: Table, space: LayTrackSpace, coords: AxialCoordinates) {
    return table.hydrated
        .placementTargets('p1', space, CompanyId.LMS)
        .find((target) => sameCoordinates(target.coords, coords))
}

describe('England & Wales setup', () => {
    it('opens five companies of five shares, the Underground in London at +7', () => {
        const state = openedTable().hydrated
        expect(state.companies.map((company) => [company.id, company.revenue])).toEqual([
            [CompanyId.LMS, 3],
            [CompanyId.LNER, 3],
            [CompanyId.SR, 5],
            [CompanyId.GWR, 5],
            [CompanyId.UERL, 7]
        ])
        expect(state.unsoldShares(CompanyId.LMS)).toBe(4)
        expect(state.discsLeft(CompanyId.UERL)).toBe(14)
        expect(state.turnManager.turnOrder[0]).toBe('p1')
        expect(state.tubeConnections).toEqual([])
    })

    it('reads sixteen Industry Sites, four of each, and four designated regions', () => {
        const { map } = edition(EditionId.EnglandWales).definition
        for (const industry of INDUSTRIES) {
            expect(map.industrySites.filter((site) => site.industry === industry)).toHaveLength(4)
        }
        expect(map.regions.map((region) => region.id)).toEqual([
            'Midlands',
            'East',
            'West',
            'South'
        ])
        expect(edition(EditionId.EnglandWales).map.hex(LONDON).regionId).toBeUndefined()
    })
})

describe('English track prices', () => {
    function withTreasury(table: Table) {
        table.edit((state) => {
            state.company(CompanyId.LMS).treasury = 40
        })
    }

    it('price a disc by the Lay Track space, half on Lay Track I without a share', () => {
        const table = openedTable()
        withTreasury(table)
        expect(lmsTarget(table, ActionSpaceId.LayTrackI, BESIDE_LANCASTER)?.cost).toBe(1)
        table.edit((state) => {
            state.company(CompanyId.LMS).owners.push('p1')
        })
        expect(
            (
                [
                    ActionSpaceId.LayTrackI,
                    ActionSpaceId.LayTrackII,
                    ActionSpaceId.LayTrackIII
                ] as const
            ).map((space) => lmsTarget(table, space, BESIDE_LANCASTER)?.cost)
        ).toEqual([2, 3, 4])
    })

    it('double a disc on one disc and triple it on two, as only London allows', () => {
        const table = openedTable()
        withTreasury(table)
        table.edit((state) => {
            state.company(CompanyId.LMS).owners.push('p1')
            state.track.push({ coords: hex(6, 10), discs: [CompanyId.LMS] })
            state.track.push({ coords: LIVERPOOL, discs: [CompanyId.LNER] })
            state.track.push({ coords: hex(23, 15), discs: [CompanyId.LMS] })
            state.track
                .find((track) => sameCoordinates(track.coords, LONDON))
                ?.discs.push(CompanyId.LNER)
        })
        expect(lmsTarget(table, ActionSpaceId.LayTrackIII, LIVERPOOL)?.cost).toBe(8)
        expect(lmsTarget(table, ActionSpaceId.LayTrackIII, LONDON)?.cost).toBe(12)
        table.edit((state) => {
            state.track.push({ coords: READING, discs: [CompanyId.LNER, CompanyId.SR] })
        })
        expect(lmsTarget(table, ActionSpaceId.LayTrackIII, READING)).toBeUndefined()
    })

    it('sell crossing cubes for $2 on Lay Track II and $1 on III, none on I', () => {
        const table = openedTable()
        withTreasury(table)
        table.edit((state) => {
            state.company(CompanyId.LMS).owners.push('p1')
            state.track.push({ coords: BESIDE_LANCASTER, discs: [CompanyId.LNER] })
        })
        const cube = (space: LayTrackSpace) => {
            const target = lmsTarget(table, space, BESIDE_LANCASTER)
            return target && [target.kind, target.cost]
        }
        expect(cube(ActionSpaceId.LayTrackI)).toBeUndefined()
        expect(cube(ActionSpaceId.LayTrackII)).toEqual([PlacementKind.Cube, 2])
        expect(cube(ActionSpaceId.LayTrackIII)).toEqual([PlacementKind.Cube, 1])
    })
})

describe('the designated region', () => {
    function layFive(coords: readonly AxialCoordinates[]) {
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.LMS).owners.push('p1')
            state.company(CompanyId.LMS).treasury = 40
        })
        choose(table, ActionSpaceId.LayTrackIII)
        return () =>
            table.act('p1', {
                type: ActionType.LayTrack,
                placements: coords.map((at) => ({
                    companyId: CompanyId.LMS,
                    coords: at,
                    kind: PlacementKind.Disc
                }))
            })
    }

    it('allows a fifth disc on Lay Track III when every disc stays inside it', () => {
        expect(layFive(MIDLANDS_CHAIN)).not.toThrow()
    })

    it('lets a crossing cube outside it count among the five', () => {
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.LMS).owners.push('p1')
            state.company(CompanyId.LMS).treasury = 40
            state.track.push({ coords: EAST_OF_LANCASTER, discs: [CompanyId.LNER] })
        })
        choose(table, ActionSpaceId.LayTrackIII)
        const pieces = [
            ...MIDLANDS_CHAIN.slice(0, 4).map((coords) => ({
                companyId: CompanyId.LMS,
                coords,
                kind: PlacementKind.Disc
            })),
            { companyId: CompanyId.LMS, coords: EAST_OF_LANCASTER, kind: PlacementKind.Cube }
        ]
        expect(() =>
            table.act('p1', { type: ActionType.LayTrack, placements: pieces })
        ).not.toThrow()
    })

    it('allows only four when one disc leaves it', () => {
        expect(layFive([...MIDLANDS_CHAIN.slice(0, 4), EAST_OF_LANCASTER])).toThrow()
    })
})

describe('the Underground coupling', () => {
    it('pays both companies’ shareholders a dividend once, when the Underground builds', () => {
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.UERL).treasury = 20
            state.track.push({ coords: READING, discs: [CompanyId.LMS] })
            state.track.push({ coords: hex(23, 15), discs: [CompanyId.UERL] })
        })
        const before = table.hydrated.players.map((player) => player.cash)
        choose(table, ActionSpaceId.LayTrackIII)
        table.act('p1', {
            type: ActionType.LayTrack,
            placements: [{ companyId: CompanyId.UERL, coords: READING, kind: PlacementKind.Disc }]
        })
        const state = table.hydrated
        expect(state.company(CompanyId.UERL).revenue).toBe(10)
        expect(state.getPlayerState('p0').cash).toBe(before[0] + 3)
        expect(state.getPlayerState('p1').cash).toBe(before[1] + 10)
        expect(state.tubeConnections).toEqual([CompanyId.LMS])
    })

    it('pays only the Big Four company when it builds onto the Underground', () => {
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.LMS).owners.push('p1')
            state.company(CompanyId.LMS).treasury = 20
            state.track.push({ coords: hex(23, 15), discs: [CompanyId.LMS] })
        })
        const before = table.hydrated.players.map((player) => player.cash)
        choose(table, ActionSpaceId.LayTrackIII)
        table.act('p1', {
            type: ActionType.LayTrack,
            placements: [{ companyId: CompanyId.LMS, coords: LONDON, kind: PlacementKind.Disc }]
        })
        const state = table.hydrated
        // LMS revenue 3 + 7 for London, two shares sold.
        expect(state.getPlayerState('p0').cash).toBe(before[0] + 5)
        expect(state.getPlayerState('p1').cash).toBe(before[1] + 5)
        expect(state.tubeConnections).toEqual([CompanyId.LMS])
    })
})

describe('Running Rights', () => {
    it('pay a share $1 for each town, city and site outside the region, London excepted', () => {
        const table = openedTable()
        table.edit((state) => {
            for (const coords of [hex(3, 15), hex(5, 13), hex(21, 13), LONDON, hex(7, 11)]) {
                state.track.push({ coords, discs: [CompanyId.LMS] })
            }
        })
        const state = table.hydrated
        expect(state.endBonusPerShare(CompanyId.LMS)).toBe(2)
        expect(state.endBonusPerShare(CompanyId.UERL)).toBe(0)
    })
})
