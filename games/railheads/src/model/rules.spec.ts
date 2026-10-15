import { describe, expect, it } from 'vitest'
import { sameCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isEndRound } from '../actions/endRound.js'
import { isResolveIndustryAuction } from '../actions/resolveIndustryAuction.js'
import { edition } from '../editions/editions.js'
import { ActionSpaceId, CompanyId, EditionId, Industry, printedHex } from '../editions/types.js'
import { Table } from '../testing/table.js'
import { finalRoundReduction, pileCoins, selectionCost } from './economy.js'
import { IndustryBoost, PlacementKind, trackAt } from './track.js'

const BERLIN = printedHex(12, 14)
const NORTH_OF_BERLIN = printedHex(12, 12)
const NORTH_WEST_OF_BERLIN = printedHex(11, 13)
const ANVIL_EAST_OF_BERLIN = printedHex(13, 13)
const STUTTGART = printedHex(5, 31)

// p0 opens; every opening share goes to the named buyer at its minimum.
const BUYERS = {
    [CompanyId.KPEV]: 'p0',
    [CompanyId.GBSE]: 'p1',
    [CompanyId.KSSE]: 'p2',
    [CompanyId.KWSE]: 'p3',
    [CompanyId.KBSB]: 'p1'
}

function openedTable(config: Record<string, boolean | string> = {}): Table {
    const table = new Table(4, config)
    table.playInitialAuction(BUYERS)
    return table
}

function choose(table: Table, space: ActionSpaceId) {
    table.act(table.active, { type: ActionType.ChooseAction, space })
}

describe('choosing an action space', () => {
    it('costs one coin more each time with three players', () => {
        expect([0, 1, 2, 3].map((n) => selectionCost(n, 3))).toEqual([1, 2, 3, 4])
        expect([1, 2, 3, 4].map((n) => pileCoins(n, 3))).toEqual([1, 3, 6, 10])
    })

    it('doubles the previous cost with four or five players', () => {
        for (const count of [4, 5]) {
            expect([0, 1, 2, 3].map((n) => selectionCost(n, count))).toEqual([1, 1, 2, 4])
            expect([1, 2, 3, 4].map((n) => pileCoins(n, count))).toEqual([1, 2, 4, 8])
        }
    })

    it('moves the coins from the Round Timer onto the space', () => {
        const table = openedTable()
        choose(table, ActionSpaceId.LayTrackII)
        expect(table.state.roundTimer).toBe(14)
        table.act(table.active, { type: ActionType.LayTrack, placements: [] })
        choose(table, ActionSpaceId.LayTrackII)
        expect(table.state.roundTimer).toBe(13)
        expect(table.hydrated.spaceCoins(ActionSpaceId.LayTrackII)).toBe(2)
        expect(table.hydrated.spaceCost(ActionSpaceId.LayTrackII)).toBe(2)
    })

    it('lets the next player consolidate the coins on a space, but not an empty one', () => {
        const table = openedTable()
        choose(table, ActionSpaceId.LayTrackII)
        table.act(table.active, { type: ActionType.LayTrack, placements: [] })
        const player = table.active
        const cash = table.hydrated.getPlayerState(player).cash
        expect(() =>
            table.act(player, { type: ActionType.Consolidate, space: ActionSpaceId.IssueShare })
        ).toThrow()
        table.act(player, { type: ActionType.Consolidate, space: ActionSpaceId.LayTrackII })
        expect(table.hydrated.getPlayerState(player).cash).toBe(cash + 1)
        expect(table.hydrated.actionSpace(ActionSpaceId.LayTrackII).selections).toBe(0)
        expect(table.state.roundTimer).toBe(14)
    })

    it('offers Lay Track I and III only to a shareholder', () => {
        const table = new Table(4)
        table.playInitialAuction({
            [CompanyId.KPEV]: 'p0',
            [CompanyId.GBSE]: 'p1',
            [CompanyId.KSSE]: 'p2',
            [CompanyId.KWSE]: 'p0',
            [CompanyId.KBSB]: 'p2'
        })
        const spaces = table.hydrated.availableSpaces('p3')
        expect(spaces).toContain(ActionSpaceId.LayTrackII)
        expect(spaces).not.toContain(ActionSpaceId.LayTrackI)
        expect(spaces).not.toContain(ActionSpaceId.LayTrackIII)
    })
})

describe('the initial auction', () => {
    it('offers the K.P.E.V. first at its $5 dividend, free to the opener when nobody bids', () => {
        const table = new Table(4)
        const auction = table.hydrated.shareAuction
        expect(auction?.companyId).toBe(CompanyId.KPEV)
        expect(auction?.minimum).toBe(5)
        const industry = auction?.industry
        expect(industry).toBeDefined()
        for (const playerId of ['p0', 'p1', 'p2', 'p3']) {
            table.act(playerId, { type: ActionType.PassBid })
        }
        const state = table.hydrated
        expect(state.company(CompanyId.KPEV).owners).toEqual(['p0'])
        expect(state.company(CompanyId.KPEV).treasury).toBe(0)
        expect(state.getPlayerState('p0').industryTokens).toEqual([industry])
        expect(state.shareAuction?.companyId).toBe(CompanyId.GBSE)
        expect(state.shareAuction?.minimum).toBe(3)
        expect(state.shareAuction?.bidding.auctioneerId).toBe('p0')
    })

    it('has the buyer open the next auction and pays the bid into the treasury', () => {
        const table = new Table(4)
        table.act('p0', { type: ActionType.PassBid })
        table.act('p1', { type: ActionType.PlaceBid, amount: 7 })
        table.act('p2', { type: ActionType.PassBid })
        table.act('p3', { type: ActionType.PassBid })
        const state = table.hydrated
        expect(state.company(CompanyId.KPEV).treasury).toBe(7)
        expect(state.getPlayerState('p1').cash).toBe(23)
        expect(state.shareAuction?.bidding.auctioneerId).toBe('p1')
        expect(table.active).toBe('p1')
    })

    it('gives the K.B.S.B. buyer the Start Player token and the first turn', () => {
        const table = openedTable()
        const state = table.hydrated
        expect(state.startPlayerId).toBe('p1')
        expect(state.machineState).toBe(MachineState.ChoosingAction)
        expect(table.active).toBe('p1')
        expect(state.round()).toBe(1)
        expect(state.roundTimer).toBe(15)
        expect(state.players.reduce((sum, player) => sum + player.industryTokens.length, 0)).toBe(4)
        expect(state.getPlayerState('p1').industryTokens).toHaveLength(1)
    })
})

describe('Issue Share', () => {
    it('opens at the dividend the share would earn and sells to the highest bidder', () => {
        const table = openedTable()
        choose(table, ActionSpaceId.IssueShare)
        expect(table.hydrated.minimumBid(CompanyId.KPEV)).toBe(3)
        expect(() =>
            table.act('p1', { type: ActionType.IssueShare, companyId: CompanyId.KPEV, amount: 2 })
        ).toThrow()
        table.act('p1', { type: ActionType.IssueShare, companyId: CompanyId.KPEV, amount: 3 })
        table.act('p2', { type: ActionType.PlaceBid, amount: 6 })
        table.act('p3', { type: ActionType.PassBid })
        table.act('p0', { type: ActionType.PassBid })
        table.act('p1', { type: ActionType.PassBid })
        const state = table.hydrated
        expect(state.company(CompanyId.KPEV).owners).toEqual(['p0', 'p2'])
        expect(state.company(CompanyId.KPEV).treasury).toBe(5 + 6)
        expect(state.dividendPerShare(CompanyId.KPEV)).toBe(3)
        expect(table.active).toBe('p2')
    })
})

describe('Industry Investment', () => {
    function investedTable(industry = Industry.Grain): Table {
        const table = openedTable()
        choose(table, ActionSpaceId.IndustryInvestment)
        table.act('p1', { type: ActionType.InvestInIndustry, industry })
        return table
    }

    function bids(table: Table, amounts: Record<string, number>) {
        for (const [playerId, amount] of Object.entries(amounts)) {
            table.act(playerId, { type: ActionType.PlaceSealedBid, amount })
        }
        const resolution = table.processed.find(isResolveIndustryAuction)
        expect(resolution?.revealsInfo).toBe(true)
        return resolution?.metadata?.sale
    }

    it('raises the industry a step and takes sealed bids from everyone at once', () => {
        const table = investedTable()
        const state = table.hydrated
        expect(state.industry(Industry.Grain).level).toBe(2)
        expect(state.machineState).toBe(MachineState.SealedBidding)
        expect(state.activePlayerIds.toSorted()).toEqual(['p0', 'p1', 'p2', 'p3'])
    })

    it('sells to the highest bid at the second highest', () => {
        const table = investedTable()
        const cash = table.hydrated.getPlayerState('p1').cash
        const sale = bids(table, { p0: 4, p1: 5, p2: 3, p3: 0 })
        expect(sale?.buyerId).toBe('p1')
        expect(sale?.price).toBe(4)
        expect(table.hydrated.getPlayerState('p1').cash).toBe(cash - 4)
        expect(table.hydrated.getPlayerState('p1').tokensOf(Industry.Grain)).toBeGreaterThan(0)
        expect(table.hydrated.industry(Industry.Grain).available).toBe(2)
    })

    it('gives a tie to the investor, then the tied player next clockwise, at the tied bid', () => {
        expect(bids(investedTable(), { p0: 0, p1: 4, p2: 4, p3: 0 })).toMatchObject({
            buyerId: 'p1',
            price: 4
        })
        expect(bids(investedTable(), { p0: 6, p1: 2, p2: 0, p3: 6 })).toMatchObject({
            buyerId: 'p3',
            price: 6
        })
    })

    it('charges the new level when every other bid is zero', () => {
        expect(bids(investedTable(), { p0: 0, p1: 9, p2: 0, p3: 0 })).toMatchObject({
            buyerId: 'p1',
            price: 2
        })
    })

    it('refuses a zero bid from the investor and a bid below the level from anyone', () => {
        const table = investedTable()
        expect(() => table.act('p1', { type: ActionType.PlaceSealedBid, amount: 0 })).toThrow()
        expect(() => table.act('p2', { type: ActionType.PlaceSealedBid, amount: 1 })).toThrow()
    })

    it('leaves out players who cannot afford the level', () => {
        const table = openedTable()
        table.edit((state) => {
            state.getPlayerState('p2').cash = 1
        })
        choose(table, ActionSpaceId.IndustryInvestment)
        table.act('p1', { type: ActionType.InvestInIndustry, industry: Industry.Cloth })
        expect(table.state.activePlayerIds.toSorted()).toEqual(['p0', 'p1', 'p3'])
    })
})

describe('Lay Track', () => {
    it('extends a shareholder’s company from its network, paying from the treasury', () => {
        const table = openedTable()
        choose(table, ActionSpaceId.LayTrackIII)
        table.edit((state) => {
            state.company(CompanyId.KBSB).treasury = 0
        })
        expect(table.hydrated.buildableCompanies('p1', ActionSpaceId.LayTrackIII)).toEqual([
            CompanyId.GBSE,
            CompanyId.KBSB
        ])
        const treasury = table.hydrated.company(CompanyId.GBSE).treasury
        const north = printedHex(4, 28)
        table.act('p1', {
            type: ActionType.LayTrack,
            placements: [{ companyId: CompanyId.GBSE, coords: north, kind: PlacementKind.Disc }]
        })
        const state = table.hydrated
        expect(state.company(CompanyId.GBSE).treasury).toBe(treasury - 2)
        expect(trackAt(state.track, north)?.discs).toEqual([CompanyId.GBSE])
    })

    it('limits a site to as many discs as the round number', () => {
        const table = openedTable()
        choose(table, ActionSpaceId.LayTrackIII)
        expect(
            table.hydrated
                .placementTargets('p1', ActionSpaceId.LayTrackIII, CompanyId.GBSE)
                .some((target) => sameCoordinates(target.coords, STUTTGART))
        ).toBe(false)
        table.edit((state) => {
            state.rounds.endRound(state.actionCount)
            state.rounds.startRound(state.actionCount)
            state.company(CompanyId.GBSE).treasury = 10
        })
        const target = table.hydrated
            .placementTargets('p1', ActionSpaceId.LayTrackIII, CompanyId.GBSE)
            .find((candidate) => sameCoordinates(candidate.coords, STUTTGART))
        expect(target?.cost).toBe(4)
        table.act('p1', {
            type: ActionType.LayTrack,
            placements: [{ companyId: CompanyId.GBSE, coords: STUTTGART, kind: PlacementKind.Disc }]
        })
        expect(trackAt(table.state.track, STUTTGART)?.discs).toEqual([
            CompanyId.KWSE,
            CompanyId.GBSE
        ])
        expect(table.hydrated.company(CompanyId.GBSE).revenue).toBe(6)
    })

    it('raises revenue by a city’s +5 and an industry’s new level', () => {
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.KPEV).owners.push('p1')
            state.company(CompanyId.KPEV).treasury = 20
            state.industry(Industry.Anvil).level = 3
        })
        choose(table, ActionSpaceId.LayTrackIII)
        table.act('p1', {
            type: ActionType.LayTrack,
            placements: [
                {
                    companyId: CompanyId.KPEV,
                    coords: ANVIL_EAST_OF_BERLIN,
                    kind: PlacementKind.Disc
                }
            ]
        })
        const state = table.hydrated
        expect(state.industry(Industry.Anvil).level).toBe(4)
        expect(state.company(CompanyId.KPEV).revenue).toBe(5 + 4)
        expect(state.company(CompanyId.KPEV).treasury).toBe(16)
    })

    it('lets Lay Track I cross another company’s countryside disc, paying it $1', () => {
        const table = openedTable()
        table.edit((state) => {
            state.track.push({ coords: NORTH_OF_BERLIN, discs: [CompanyId.KPEV] })
            state.track.push({ coords: NORTH_WEST_OF_BERLIN, discs: [CompanyId.GBSE] })
            state.company(CompanyId.GBSE).treasury = 10
        })
        const kpevTreasury = table.hydrated.company(CompanyId.KPEV).treasury
        expect(
            table.hydrated
                .placementTargets('p1', ActionSpaceId.LayTrackIII, CompanyId.GBSE)
                .some((target) => target.kind === PlacementKind.Cube)
        ).toBe(false)
        const builder = 'p1'
        choose(table, ActionSpaceId.LayTrackI)
        table.act(builder, {
            type: ActionType.LayTrack,
            placements: [
                { companyId: CompanyId.GBSE, coords: NORTH_OF_BERLIN, kind: PlacementKind.Cube }
            ]
        })
        const state = table.hydrated
        expect(trackAt(state.track, NORTH_OF_BERLIN)?.cube).toBe(CompanyId.GBSE)
        expect(state.company(CompanyId.GBSE).treasury).toBe(9)
        expect(state.company(CompanyId.KPEV).treasury).toBe(kpevTreasury + 1)
        expect(
            state
                .placementTargets(builder, ActionSpaceId.LayTrackI, CompanyId.GBSE)
                .some((target) => sameCoordinates(target.coords, NORTH_WEST_OF_BERLIN))
        ).toBe(false)
    })

    it('lets Lay Track II build two discs each for two companies, half price without a share', () => {
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.KPEV).treasury = 10
            state.company(CompanyId.KSSE).treasury = 10
        })
        choose(table, ActionSpaceId.LayTrackII)
        const placements = [
            { companyId: CompanyId.KPEV, coords: NORTH_OF_BERLIN, kind: PlacementKind.Disc },
            { companyId: CompanyId.KPEV, coords: ANVIL_EAST_OF_BERLIN, kind: PlacementKind.Disc },
            { companyId: CompanyId.KSSE, coords: printedHex(11, 17), kind: PlacementKind.Disc }
        ]
        expect(() =>
            table.act('p1', {
                type: ActionType.LayTrack,
                placements: [
                    ...placements,
                    {
                        companyId: CompanyId.GBSE,
                        coords: printedHex(4, 28),
                        kind: PlacementKind.Disc
                    }
                ]
            })
        ).toThrow()
        table.act('p1', { type: ActionType.LayTrack, placements })
        const state = table.hydrated
        expect(state.company(CompanyId.KPEV).treasury).toBe(10 - 1 - 2)
        expect(state.company(CompanyId.KSSE).treasury).toBe(10 - 1)
    })

    it('needs every disc to join the company’s network', () => {
        const table = openedTable()
        choose(table, ActionSpaceId.LayTrackIII)
        expect(() =>
            table.act('p1', {
                type: ActionType.LayTrack,
                placements: [
                    {
                        companyId: CompanyId.GBSE,
                        coords: printedHex(4, 26),
                        kind: PlacementKind.Disc
                    }
                ]
            })
        ).toThrow()
    })

    it('Off the Rails lets an industry rise two steps instead of raising revenue', () => {
        const table = openedTable({ offTheRails: true })
        table.edit((state) => {
            state.company(CompanyId.KPEV).owners.push('p1')
            state.company(CompanyId.KPEV).treasury = 20
        })
        choose(table, ActionSpaceId.LayTrackIII)
        const disc = {
            companyId: CompanyId.KPEV,
            coords: ANVIL_EAST_OF_BERLIN,
            kind: PlacementKind.Disc
        }
        expect(() => table.act('p1', { type: ActionType.LayTrack, placements: [disc] })).toThrow()
        table.act('p1', {
            type: ActionType.LayTrack,
            placements: [{ ...disc, boost: IndustryBoost.Development }]
        })
        expect(table.hydrated.industry(Industry.Anvil).level).toBe(3)
        expect(table.hydrated.company(CompanyId.KPEV).revenue).toBe(5)
    })
})

describe('the end of a round', () => {
    it('pays out, passes the Start Player token, applies obsolescence and refills the timer', () => {
        const table = openedTable()
        table.edit((state) => {
            state.roundTimer = 1
            state.company(CompanyId.KPEV).revenue = 25
            state.industry(Industry.Brick).level = 3
        })
        const before = table.hydrated
        const p0Tokens = before.getPlayerState('p0').industryTokens
        const p0Cash = before.getPlayerState('p0').cash
        choose(table, ActionSpaceId.LayTrackII)
        table.act('p1', { type: ActionType.LayTrack, placements: [] })
        const endRound = table.processed.find(isEndRound)
        expect(endRound?.metadata?.rates.companies).toContainEqual({
            companyId: CompanyId.KPEV,
            perShare: 25
        })
        const tokenIncome = p0Tokens.reduce(
            (sum, industry) => sum + (industry === Industry.Brick ? 3 : 1),
            0
        )
        const state = table.hydrated
        expect(state.getPlayerState('p0').cash).toBe(p0Cash + 25 + tokenIncome)
        expect(state.company(CompanyId.KPEV).revenue).toBe(25 - 6)
        expect(state.company(CompanyId.KSSE).revenue).toBe(5)
        expect(state.startPlayerId).toBe('p2')
        expect(table.active).toBe('p2')
        expect(state.round()).toBe(2)
        expect(state.roundTimer).toBe(15)
        expect(state.consolidatableSpaces()).toEqual([])
    })

    it('drops revenue by the band printed on the Revenue Track', () => {
        const germany = edition(EditionId.Germany)
        expect(
            [10, 11, 20, 21, 30, 31, 41, 51, 60, 75].map((revenue) =>
                germany.obsolescenceDrop(revenue)
            )
        ).toEqual([0, 3, 3, 6, 6, 9, 12, 15, 15, 15])
    })

    it('shortens the final round by $1 for each company with one share left and $2 with none', () => {
        expect(finalRoundReduction([3, 1, 0, 2, 1])).toBe(4)
        const table = openedTable()
        table.edit((state) => {
            state.company(CompanyId.KPEV).owners.push('p0', 'p1', 'p2')
            state.company(CompanyId.GBSE).owners.push('p0', 'p1')
            state.rounds.endRound(state.actionCount)
            state.rounds.startRound(state.actionCount)
            state.rounds.endRound(state.actionCount)
            state.rounds.startRound(state.actionCount)
        })
        expect(table.hydrated.roundTimerSize(4)).toBe(15 - 2 - 1)
        expect(table.hydrated.roundTimerSize(3)).toBe(15)
    })
})

describe('the end of the game', () => {
    it('pays each company’s Railroad Bonus from the sites where its disc is on top', () => {
        const table = openedTable()
        table.edit((state) => {
            state.track = [
                { coords: BERLIN, discs: [CompanyId.KPEV, CompanyId.KSSE, CompanyId.GBSE] },
                { coords: printedHex(11, 19), discs: [CompanyId.KSSE] },
                { coords: STUTTGART, discs: [CompanyId.KWSE, CompanyId.KSSE] },
                { coords: NORTH_OF_BERLIN, discs: [CompanyId.GBSE], cube: CompanyId.KSSE }
            ]
        })
        const state = table.hydrated
        expect(state.railroadBonus(CompanyId.GBSE)).toBe(2)
        expect(state.railroadBonus(CompanyId.KSSE)).toBe(1)
        expect(state.railroadBonus(CompanyId.KPEV)).toBe(0)
    })

    it('shares $6 per industry site reached among that industry’s tokens, rounded up', () => {
        const table = openedTable()
        table.edit((state) => {
            state.track.push({ coords: ANVIL_EAST_OF_BERLIN, discs: [CompanyId.KPEV] })
            state.track.push({ coords: printedHex(6, 0), discs: [CompanyId.KPEV] })
            for (const player of state.players) {
                player.industryTokens = player.industryTokens.filter(
                    (token) => token !== Industry.Anvil
                )
            }
            state.getPlayerState('p0').industryTokens.push(Industry.Anvil, Industry.Anvil)
            state.getPlayerState('p2').industryTokens.push(Industry.Anvil)
        })
        expect(table.hydrated.industrySitesReached(Industry.Anvil)).toBe(2)
        expect(table.hydrated.industryBonusPerToken(Industry.Anvil)).toBe(4)
    })

    it('ends after the fourth payout with the richest player winning', () => {
        const table = openedTable()
        table.edit((state) => {
            for (let round = 1; round < 4; round++) {
                state.rounds.endRound(state.actionCount)
                state.rounds.startRound(state.actionCount)
            }
            state.roundTimer = 1
        })
        choose(table, ActionSpaceId.LayTrackII)
        table.act('p1', { type: ActionType.LayTrack, placements: [] })
        const state = table.hydrated
        expect(state.machineState).toBe(MachineState.EndOfGame)
        const best = Math.max(...state.players.map((player) => player.cash))
        expect(
            state.winningPlayerIds.every((playerId) => state.getPlayerState(playerId).cash === best)
        ).toBe(true)
    })
})
