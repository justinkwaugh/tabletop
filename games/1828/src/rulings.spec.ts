import { describe, expect, it, vi } from 'vitest'
import { turnOrderFrom } from '@tabletop/common'
import {
    ReserveBidAuction,
    controllingOwner,
    furtherShareAllowed,
    getCompany,
    placeStockMarker,
    privateStationPositions,
    removeStockMarker,
    sharesOwned,
    stateWith,
    trainsOverLimit,
    type Owner
} from '@tabletop/18xx'
import { edit, floatCompany, kit, openAuction, setCash, type Table } from '../test/kit.js'
import {
    AccessRightRules1828,
    CoalAccess,
    coalHolders,
    coalfieldsMarkers,
    takeTunnelCoal
} from './coal.js'
import { Privates1828 } from './companies.js'
import { directorPrivateId } from './ids.js'
import { cobourgRuns, oneRunPerRevenue } from './cobourg.js'
import {
    mergerCanSucceed,
    mergerChoices,
    mergerDirector,
    mergerStep,
    mergerTrading,
    offeredMergers,
    pendingSetAside,
    systemMarketSpace,
    withDecision,
    withSetAside
} from './merger.js'
import { singleShareChoices } from './mergerOffers.js'
import { TunnelLocationId } from './map.js'
import { mohawkOffers } from './mohawkOffers.js'
import { IpoPoolId1828 } from './names.js'
import { PrivateRules1828, TransferRules1828, dumpsTrainSeller } from './operating.js'
import { AuctionRules1828 } from './opening.js'
import { RouteRules1828 } from './routes.js'
import type { HydratedState1828, Merger1828, State1828 } from './state.js'
import { StationRules1828 } from './stations.js'
import { ShareTrading1828, StockRoundRules1828, StockRules1828 } from './stock.js'
import { Market1828, stockPrice } from './stockMarket.js'
import { shellsOpen } from './shells.js'
import { ShellsClosedMark, TrainShellMarks, trainBoughtFromMark, trainShells } from './systems.js'
import { TileSet1828, TunnelTileId } from './tiles.js'
import { TrackRules1828 } from './track.js'
import { CobourgTrainId, TrainDepot1828 } from './trains.js'
import { TrainRules1828 } from './trainRules.js'

const player = (playerId: string): Owner => ({ kind: 'player', playerId })
const spaceAt = (row: number, column: number) => Market1828.space(`${row}:${column}`)

describe('the stock market (§12.2)', () => {
    it('moves a marker up at the top of a column to the right', () => {
        expect(Market1828.move('0:3', 'up', 1).id).toBe('0:4')
    })
    it('leaves $67 on the floor of its column', () => {
        expect(Market1828.move('13:7', 'down', 1).id).toBe('13:7')
    })
    it('moves a dividend at the end of a row up, and a loss at its start down', () => {
        const market = { stacks: [{ spaceId: '1:14', companyIds: ['A'] }] }
        expect(Market1828.dividendMove(market, 'A', true).toMarketSpaceId).toBe('0:14')
        const left = { stacks: [{ spaceId: '3:0', companyIds: ['A'] }] }
        expect(Market1828.dividendMove(left, 'A', false).toMarketSpaceId).toBe('4:0')
    })
})

describe('the system price (§7.5.2 step 2; BGG thread 2284660)', () => {
    it('makes two $67 companies $94', () => {
        expect(systemMarketSpace(spaceAt(13, 7), spaceAt(13, 7)).price).toBe(94)
    })
    it('makes $86 and $79 $117, up the leftmost column', () => {
        expect(systemMarketSpace(spaceAt(7, 4), spaceAt(9, 5))).toMatchObject({
            price: 117,
            row: 3,
            column: 4
        })
    })
    it('makes $94 and $82 in one column $119', () => {
        expect(systemMarketSpace(spaceAt(5, 3), spaceAt(7, 3)).price).toBe(119)
    })
    it('runs along the top row past its leftmost column', () => {
        expect(systemMarketSpace(spaceAt(1, 9), spaceAt(13, 1)).price).toBe(240)
    })
})

describe('the opening auction (§6)', () => {
    function auctionOf(game: Table) {
        return new ReserveBidAuction(game.hydrated, AuctionRules1828)
    }
    it('sells a row of two only once the other lot has a bid, then resolves that bid', () => {
        const game = kit.table(4, 3)
        expect(auctionOf(game).buyOnlyLotIds()).toEqual([])
        const first = game.player
        game.act('ReserveBid', { lotId: 'STCT', amount: 25 })
        expect(auctionOf(game).buyOnlyLotIds()).toEqual(['SVN'])
        game.act('BuyAuctionLot', { lotId: 'SVN', expectedPrice: 20 })
        const awards = game.state.openingAuction?.awards ?? []
        expect(awards.map((award) => [award.lotId, award.price])).toEqual([
            ['SVN', 20],
            ['STCT', 25]
        ])
        expect(awards[1].playerId).toBe(first)
    })
    it('opens the row being auctioned when all pass with a dearer private contested', () => {
        const game = kit.table(4, 3)
        game.act('ReserveBid', { lotId: 'DH', amount: 85 })
        game.act('ReserveBid', { lotId: 'DH', amount: 90 })
        for (let pass = 0; pass < 4; pass++) game.act('PassAuction')
        expect(game.state.openingAuction?.bidding?.lotId).toBe('DH')
        const rows = auctionOf(game).priceRows()
        expect(rows.find((row) => row.lotIds.includes('DH'))?.status).toBe('open')
        expect(rows.find((row) => row.lotIds.includes('SVN'))?.status).toBe('later')
    })
    it('reports each price row and how much of it is still to sell', () => {
        const game = kit.table(4, 3)
        const summary = () =>
            auctionOf(game)
                .priceRows()
                .slice(0, 2)
                .map(({ price, status, remaining, unbid }) => [price, status, remaining, unbid])
        expect(summary()).toEqual([
            [20, 'open', 2, 2],
            [40, 'later', 1, 1]
        ])
        game.act('ReserveBid', { lotId: 'STCT', amount: 25 })
        expect(summary()[0]).toEqual([20, 'open', 2, 1])
        game.act('BuyAuctionLot', { lotId: 'SVN', expectedPrice: 20 })
        expect(summary()).toEqual([
            [20, 'sold', 0, 0],
            [40, 'open', 1, 1]
        ])
    })
    it('keeps one bid on a $250 private, an overbid releasing the earlier', () => {
        const game = kit.table(4, 3)
        const lotId = game.state.companies.find(
            (company) =>
                company.kind === 'private' && /^[A-Z]+P$/.test(company.id) && company.id !== 'CP'
        )?.id
        if (!lotId) throw new Error('A $250 private is in play')
        game.act('ReserveBid', { lotId, amount: 255 })
        game.act('ReserveBid', { lotId, amount: 260 })
        const bids = game.state.openingAuction?.reservations.filter((bid) => bid.lotId === lotId)
        expect(bids?.map((bid) => bid.amount)).toEqual([260])
    })
    it('resolves every bid and pays the privates when all pass (§6.1)', () => {
        const game = kit.table(3, 5)
        game.act('ReserveBid', { lotId: 'CA', amount: 165 })
        const bidder = game.state.openingAuction?.reservations[0].playerId
        for (let pass = 0; pass < 3; pass++) game.act('PassAuction')
        const award = game.state.openingAuction?.awards.find((entry) => entry.lotId === 'CA')
        expect(award).toMatchObject({ playerId: bidder, price: 165 })
        expect(game.state.openingAuction?.completed).toBe(false)
    })
    it('ends with every private sold, a $250 buyer setting a yellow par', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        expect(game.state.machineState).toBe('StockRound')
        const parred = game.state.companies.filter((company) => company.parPrice)
        expect(parred.length).toBe(5)
        for (const company of parred) expect([67, 71, 79]).toContain(company.parPrice)
    })
})

/** A position for merger arithmetic: the two companies' shares as given, both floated earlier. */
function mergerPosition(holdings: {
    survivor: Record<string, number>
    absorbed: Record<string, number>
    pool?: { survivor?: number; absorbed?: number }
}): { game: Table; merger: Merger1828 } {
    const game = kit.table(4, 7)
    openAuction(game)
    while (game.player !== 'p1') game.act('FinishStockTurn')
    const [survivorId, absorbedId] = ['BO', 'CO']
    edit(game, (state) => {
        for (const [companyId, holders] of [
            [survivorId, holdings.survivor],
            [absorbedId, holdings.absorbed]
        ] as const) {
            const company = state.companies.find((entry) => entry.id === companyId)
            if (!company) throw new Error('Unknown company')
            Object.assign(company, { started: true, floated: true, funded: true, parPrice: 67 })
            company.president = { kind: 'player', playerId: Object.keys(holders)[0] }
            state.stockMarket.stacks.push({ spaceId: '13:7', companyIds: [companyId] })
            const certificates = state.certificates.filter(
                (certificate) => certificate.companyId === companyId
            )
            const owners: { owner: State1828['certificates'][number]['owner']; poolId?: string }[] =
                []
            for (const [playerId, shares] of Object.entries(holders))
                for (let index = 0; index < shares; index++)
                    owners.push({ owner: { kind: 'player', playerId } })
            const pooled =
                companyId === survivorId
                    ? (holdings.pool?.survivor ?? 0)
                    : (holdings.pool?.absorbed ?? 0)
            for (let index = 0; index < pooled; index++)
                owners.push({ owner: { kind: 'bank' }, poolId: 'open-market' })
            // The president's certificate takes the first holder's first two shares.
            const [president, ...singles] = certificates
            president.owner = owners[0].owner
            delete president.poolId
            const rest = owners.slice(2)
            singles.forEach((certificate, index) => {
                const holder = rest[index] ?? {
                    owner: { kind: 'bank' },
                    poolId: 'initial-offering'
                }
                certificate.owner = holder.owner
                if (holder.poolId) certificate.poolId = holder.poolId
                else delete certificate.poolId
            })
        }
        state.stockMarket.stacks = state.stockMarket.stacks.reduce<
            State1828['stockMarket']['stacks']
        >((stacks, stack) => {
            const same = stacks.find((entry) => entry.spaceId === stack.spaceId)
            if (same) same.companyIds.push(...stack.companyIds)
            else stacks.push(stack)
            return stacks
        }, [])
    })
    const merger: Merger1828 = {
        survivorId,
        absorbedId,
        stage: 'shares',
        blockedStationIds: [],
        setAsides: [],
        decisions: []
    }
    return { game, merger }
}

describe('merger share trading (§7.5.2, §7.5.2.1)', () => {
    it('follows the designer’s worked example (BGG thread 2457287)', () => {
        const { game, merger } = mergerPosition({
            survivor: { p1: 9, p2: 1 },
            absorbed: { p1: 6, p2: 1 },
            pool: { absorbed: 3 }
        })
        const decided = { ...merger, decisions: [{ playerId: 'p1', tradeUp: true }] }
        const trading = mergerTrading(game.hydrated, decided)
        expect(trading.pairs).toMatchObject({ p1: 7, p2: 1 })
        expect(trading.deciderId).toBeUndefined()
        expect(trading.poolShares).toBe(1)
        expect(trading.ipoShares).toBe(0)
        const director = mergerDirector(game.hydrated, decided, trading)
        expect(director).toMatchObject({ directorId: 'p1', shares: { p1: 7, p2: 1 } })
    })
    it('lets an earlier single take the last system share (BGG thread 2732606)', () => {
        const { game, merger } = mergerPosition({
            survivor: { p1: 6, p2: 2, p3: 2 },
            absorbed: { p1: 6, p2: 1, p3: 1, p4: 2 }
        })
        const first = mergerTrading(game.hydrated, merger)
        expect(first.deciderId).toBe('p2')
        const traded = mergerTrading(game.hydrated, {
            ...merger,
            decisions: [{ playerId: 'p2', tradeUp: true }]
        })
        expect(traded.deciderId).toBeUndefined()
        expect(traded.singles.find((single) => single.playerId === 'p3')).toMatchObject({
            tradeUp: false,
            chosen: false
        })
        const declined = mergerTrading(game.hydrated, {
            ...merger,
            decisions: [{ playerId: 'p2', tradeUp: false }]
        })
        expect(declined.deciderId).toBe('p3')
    })
    it('fails when no one can keep the director’s certificate and donate a share', () => {
        const { game, merger } = mergerPosition({
            survivor: { p1: 2, p2: 2, p3: 2 },
            absorbed: { p1: 2, p2: 2, p3: 2 }
        })
        const director = mergerDirector(game.hydrated, merger, mergerTrading(game.hydrated, merger))
        expect(director).toHaveProperty('failure')
    })
})

describe('a merger played through (§7.5.2)', () => {
    it('forms a system whose director donates a share to its treasury', () => {
        const game = kit.table(3, 11)
        openAuction(game)
        edit(game, (state) => {
            for (const { playerId } of state.players)
                setCash(state, { kind: 'player', playerId }, 3000)
        })
        const director = game.player
        /** The director acts on each of their turns; the others pass. */
        const onDirectorsTurn = (act: () => void) => {
            while (game.player !== director) game.act('FinishStockTurn')
            act()
            game.act('FinishStockTurn')
        }
        for (const companyId of ['BO', 'CO']) {
            onDirectorsTurn(() =>
                game.act('StartCompany', {
                    buyer: player(director),
                    companyId,
                    marketSpaceId: '13:7',
                    expectedPrice: 134
                })
            )
            for (let share = 0; share < 4; share++)
                onDirectorsTurn(() => kit.buyIpo(game, companyId, 67))
            expect(getCompany(game.state, companyId).floated).toBe(true)
        }
        while (game.player !== director) game.act('FinishStockTurn')
        game.act('ProposeMerger', { survivorId: 'BO', absorbedId: 'CO' })
        expect(game.state.merger).toBeUndefined()
        const formed = game.actions.find((action) => action.type === 'FormSystem')
        expect(formed).toBeDefined()
        expect(getCompany(game.state, 'CO').closed).toBe(true)
        expect(game.state.systems.BO?.absorbedId).toBe('CO')
        expect(sharesOwned(game.state, 'BO', player(director))).toBe(5)
        expect(sharesOwned(game.state, 'BO', { kind: 'company', companyId: 'BO' })).toBe(1)
        expect(game.state.certificates.filter((entry) => entry.companyId === 'CO')).toEqual([])
        // Two $67 companies make a $94 system with both treasuries (§7.5.2 step 3).
        expect(Market1828.companySpace(game.state.stockMarket, 'BO').price).toBe(94)
        const treasury = game.state.cash.find(
            (entry) => entry.owner.kind === 'company' && entry.owner.companyId === 'BO'
        )
        expect(treasury?.amount).toBe(1340)
        // Its IPO shares sell at that price, not at either company's par (§7.3).
        const ipoShare = game.state.certificates.find(
            (entry) =>
                entry.companyId === 'BO' &&
                entry.owner.kind === 'bank' &&
                entry.poolId === IpoPoolId1828
        )
        expect(ipoShare).toBeDefined()
        if (ipoShare?.kind !== 'share') return
        expect(
            ShareTrading1828.purchaseTerms(game.hydrated, ipoShare, player(director))
        ).toMatchObject({ price: 94 })
    })
})

describe('mergers that cannot succeed (§7.5.2.2)', () => {
    /** Tries every set-aside and single-share decision still open. */
    function someChoiceSucceeds(state: HydratedState1828, merger: Merger1828): boolean {
        const settingAside = pendingSetAside(state, merger)
        if (settingAside)
            return [merger.survivorId, merger.absorbedId].some((companyId) =>
                someChoiceSucceeds(state, withSetAside(merger, settingAside, companyId))
            )
        const trading = mergerTrading(state, merger)
        const { deciderId } = trading
        if (!deciderId) return !('failure' in mergerDirector(state, merger, trading))
        return [true, false].some((tradeUp) =>
            someChoiceSucceeds(state, withDecision(merger, deciderId, tradeUp))
        )
    }

    it('agrees with trying every remaining choice', () => {
        let seed = 1828
        const next = (limit: number) => {
            seed = (seed * 48271) % 2147483647
            return seed % limit
        }
        const spaces = Market1828.spaces
        const players = ['p1', 'p2', 'p3', 'p4']
        const deal = (total: number, first: number) => {
            const held: Record<string, number> = { p1: first }
            for (let dealt = first; dealt < total; dealt++) {
                const playerId = players[next(players.length)]
                held[playerId] = (held[playerId] ?? 0) + 1
            }
            return held
        }
        const outcomes = new Set<boolean>()
        let swapDecided = 0
        for (let position = 0; position < 24; position++) {
            const { game, merger } = mergerPosition({
                survivor: deal(4 + next(6), 2),
                absorbed: deal(3 + next(7), 2)
            })
            for (let variant = 0; variant < 12; variant++) {
                let survivorSpace = spaces[next(spaces.length)]
                let absorbedSpace = spaces[next(spaces.length)]
                // A system can price below its dearer company, where a swap costs the most.
                while (
                    variant % 3 === 0 &&
                    systemMarketSpace(survivorSpace, absorbedSpace).price >= absorbedSpace.price
                ) {
                    survivorSpace = spaces[next(spaces.length)]
                    absorbedSpace = spaces[next(spaces.length)]
                }
                edit(game, (state) => {
                    for (const [companyId, space] of [
                        ['BO', survivorSpace],
                        ['CO', absorbedSpace]
                    ] as const) {
                        removeStockMarker(state.stockMarket, companyId)
                        placeStockMarker(state.stockMarket, companyId, space.id)
                    }
                    for (const playerId of players)
                        setCash(state, { kind: 'player', playerId }, next(4) * next(150))
                })
                const state = game.hydrated
                let current = merger
                for (;;) {
                    const expected = someChoiceSucceeds(state, current)
                    outcomes.add(expected)
                    expect(mergerCanSucceed(state, current)).toBe(expected)
                    const settingAside = pendingSetAside(state, current)
                    const { deciderId, systemPrice } = mergerTrading(state, current)
                    if (settingAside) {
                        const companyId = next(2) ? current.survivorId : current.absorbedId
                        current = withSetAside(current, settingAside, companyId)
                    } else if (deciderId) {
                        if (systemPrice < stockPrice(state, current.absorbedId)) swapDecided++
                        current = withDecision(current, deciderId, next(2) === 0)
                    } else break
                }
            }
        }
        expect(outcomes).toEqual(new Set([true, false]))
        expect(swapDecided).toBeGreaterThan(0)
    })

    /** The acting player holds five shares, so needs to trade up a single to direct the system. */
    function fiveShares(cash: number): Table {
        const { game } = mergerPosition({ survivor: { p1: 3 }, absorbed: { p1: 2 } })
        edit(game, (state) => setCash(state, { kind: 'player', playerId: 'p1' }, cash))
        while (game.player !== 'p1') game.act('FinishStockTurn')
        return game
    }
    const offered = (game: Table) =>
        offeredMergers(game.hydrated, 'p1').filter(
            ({ survivorId, absorbedId }) => survivorId === 'BO' && absorbedId === 'CO'
        )

    it('sees that another player’s set-aside can spare the one who would direct a swap', () => {
        const { game: table } = mergerPosition({ survivor: { p1: 2 }, absorbed: { p1: 2 } })
        const [first, second, third, fourth] = turnOrderFrom(
            table.state.turnManager.turnOrder,
            'p1'
        )
        const { game, merger } = mergerPosition({
            survivor: { [fourth]: 2, [second]: 1, [third]: 1 },
            absorbed: { [fourth]: 3, [first]: 2, [second]: 2, [third]: 2 }
        })
        edit(game, (state) => {
            for (const [companyId, spaceId] of [
                ['BO', '1:0'],
                ['CO', '1:14']
            ] as const) {
                removeStockMarker(state.stockMarket, companyId)
                placeStockMarker(state.stockMarket, companyId, spaceId)
            }
            // Enough to trade the $112 share up to the $412 system, not to pay a swap to $443.
            setCash(state, { kind: 'player', playerId: fourth }, 300)
        })
        const settled = [third, fourth].reduce(
            (current, playerId) => withSetAside(current, playerId, 'BO'),
            merger
        )
        expect(mergerCanSucceed(game.hydrated, settled)).toBe(true)
        expect(mergerCanSucceed(game.hydrated, withSetAside(settled, second, 'CO'))).toBe(false)
    })
    it('offers a merger the acting player can afford to complete', () => {
        expect(offered(fiveShares(27))).toHaveLength(1)
    })
    it('does not offer one whose trade-up no one can pay for', () => {
        expect(offered(fiveShares(26))).toHaveLength(0)
    })
    it('still accepts a legal merger that cannot succeed, which fails as a pass', () => {
        const game = fiveShares(26)
        expect(offered(game)).toHaveLength(0)
        expect(game.valid('p1')).not.toContain('ProposeMerger')
        expect(
            mergerChoices(game.hydrated, 'p1').some(
                ({ survivorId, absorbedId }) => survivorId === 'BO' && absorbedId === 'CO'
            )
        ).toBe(true)
        game.act('ProposeMerger', { survivorId: 'BO', absorbedId: 'CO' })
        expect(game.state.merger).toBeUndefined()
        expect(game.state.systems.BO).toBeUndefined()
        const formed = game.actions.findLast((action) => action.type === 'FormSystem')
        expect(formed?.metadata).toHaveProperty('failure')
        expect(game.state.stockRound.passedPlayerIds).toContain('p1')
    })
    it('holds a standing purchase until the merger is over', () => {
        const game = fiveShares(1000)
        game.act('ProposeMerger', { survivorId: 'BO', absorbedId: 'CO' })
        const cash = game.state.cash.find(
            ({ owner }) => owner.kind === 'player' && owner.playerId === 'p1'
        )?.amount
        game.act(
            'SetStockInstruction',
            {
                outOfTurn: true,
                supersedable: true,
                instruction: {
                    kind: 'buy',
                    companyId: 'CO',
                    preferredPoolId: IpoPoolId1828,
                    until: { kind: 'shares', count: 9 },
                    thenPass: false
                }
            },
            'p1'
        )
        expect(game.state.merger).toBeDefined()
        expect(
            game.state.cash.find(({ owner }) => owner.kind === 'player' && owner.playerId === 'p1')
                ?.amount
        ).toBe(cash)
    })
    it('leaves only the single-share decision that lets the system form', () => {
        const game = fiveShares(1000)
        game.act('ProposeMerger', { survivorId: 'BO', absorbedId: 'CO' })
        const { merger } = game.hydrated
        if (!merger) throw new Error('The merger awaits the single share')
        expect(singleShareChoices(game.hydrated, merger)).toEqual({
            tradeUp: true,
            sell: false,
            sellFails: true
        })
        game.act('DecideMergerShare', { tradeUp: true }, 'p1')
        expect(game.state.merger).toBeUndefined()
        expect(game.state.systems.BO?.absorbedId).toBe('CO')
        // A merger is the turn's one purchase-or-merge action, even in the gray area (§7.1).
        edit(game, (state) => {
            removeStockMarker(state.stockMarket, 'BO')
            placeStockMarker(state.stockMarket, 'BO', '9:0')
            getCompany(state, 'BO').president = {
                kind: 'player',
                playerId: state.activePlayerIds[0]
            }
        })
        const certificate = game.state.certificates.find(
            (entry) => entry.companyId === 'BO' && entry.owner.kind === 'bank'
        )
        if (certificate?.kind !== 'share') throw new Error('The system has bank shares')
        expect(furtherShareAllowed(game.hydrated, certificate, StockRules1828)).toBe(false)
        expect(
            StockRules1828.multipleBuys?.allowsAnother(game.hydrated, certificate, [
                { kind: 'share', companyId: 'BO' }
            ])
        ).toBe(true)
    })
    it('lets a holder who never agreed sink the merger, which ends the turn as a pass', () => {
        const { game } = mergerPosition({
            survivor: { p1: 3, p2: 3 },
            absorbed: { p3: 2, p2: 2 }
        })
        edit(game, (state) => {
            for (const playerId of ['p1', 'p2', 'p3'])
                setCash(state, { kind: 'player', playerId }, 1000)
        })
        while (game.player !== 'p1') game.act('FinishStockTurn')
        expect(offered(game)).toHaveLength(1)
        game.act('ProposeMerger', { survivorId: 'BO', absorbedId: 'CO' })
        game.act('AnswerMerger', { accept: true }, 'p3')
        const { merger } = game.hydrated
        if (!merger) throw new Error('The merger awaits the single share')
        expect(singleShareChoices(game.hydrated, merger)).toEqual({
            tradeUp: true,
            sell: true,
            sellFails: true
        })
        game.act('DecideMergerShare', { tradeUp: false }, 'p2')
        expect(game.state.merger).toBeUndefined()
        expect(game.state.systems.BO).toBeUndefined()
        expect(sharesOwned(game.state, 'CO', player('p2'))).toBe(2)
        expect(game.player).not.toBe('p1')
        expect(game.state.stockRound.passedPlayerIds).toContain('p1')
        const formed = game.actions.findLast((action) => action.type === 'FormSystem')
        expect(formed?.metadata).toHaveProperty('failure')
    })
    it('keeps the M&H’s exchange out of a merger under way', () => {
        const { game } = mergerPosition({ survivor: { p1: 6 }, absorbed: { p2: 2 } })
        edit(game, (state) => {
            const charter = state.certificates.find((entry) => entry.id === 'MH:charter')
            if (!charter) throw new Error('The M&H has a charter')
            charter.owner = { kind: 'player', playerId: 'p2' }
        })
        while (game.player !== 'p1') game.act('FinishStockTurn')
        game.act('ProposeMerger', { survivorId: 'BO', absorbedId: 'CO' })
        expect(game.player).toBe('p2')
        const valid = game.valid('p2')
        expect(valid).toContain('AnswerMerger')
        expect(valid).not.toContain('ExchangePrivate')
        expect(valid).not.toContain('ExchangeMohawkForDirectorship')
    })
})

describe('choosing the single share to set aside (§7.5.2 step 4)', () => {
    function oddHolder(): { game: Table } {
        const { game } = mergerPosition({ survivor: { p1: 3 }, absorbed: { p1: 2 } })
        edit(game, (state) => {
            setCash(state, { kind: 'player', playerId: 'p1' }, 1000)
            state.stockMarket.stacks = [
                { spaceId: '13:7', companyIds: ['BO'] },
                { spaceId: '11:6', companyIds: ['CO'] }
            ]
        })
        while (game.player !== 'p1') game.act('FinishStockTurn')
        return { game }
    }
    it('lets a holder of both companies choose, and prices the single by that choice', () => {
        const { game } = oddHolder()
        game.act('ProposeMerger', { survivorId: 'BO', absorbedId: 'CO' })
        expect(game.valid('p1')).toContain('ChooseSetAsideShare')
        game.act('ChooseSetAsideShare', { companyId: 'BO' }, 'p1')
        const { merger } = game.hydrated
        if (!merger) throw new Error('The merger goes on')
        expect(merger.setAsides).toEqual([{ playerId: 'p1', companyId: 'BO' }])
        expect(mergerStep(game.hydrated, merger)).toBe('share')
    })
})

describe('system shells (§8.3.5.1, §15.4)', () => {
    function system(trains: string[]): { game: Table; state: State1828; bought: string } {
        const game = kit.table(4, 7)
        openAuction(game)
        let bought = ''
        edit(game, (state) => {
            const ids = trains.map((definitionId) => kit.giveTrain(state, 'BO', definitionId))
            bought = ids.at(-1) ?? ''
            state.systems.BO = { absorbedId: 'CO', shellTrainIds: [ids.slice(0, -1), []] }
            getCompany(state, 'CO').closed = true
            getCompany(state, 'BO').president = player('p1')
        })
        return { game, state: game.state, bought }
    }
    it('counts a new train in the shell it goes to, not the full one', () => {
        const { game, bought } = system(['2', '2', '2', '2', '2'])
        expect(
            trainShells(game.hydrated, 'BO').map((shell) => shell.map((train) => train.id))[1]
        ).toEqual([bought])
    })
    it('puts it in the shell the director named', () => {
        const { game } = system(['2', '2'])
        expect(trainShells(game.hydrated, 'BO').map((shell) => shell.length)).toEqual([1, 1])
        edit(game, (state) => {
            state.turnMarks = [TrainShellMarks[0]]
        })
        expect(trainShells(game.hydrated, 'BO').map((shell) => shell.length)).toEqual([2, 0])
    })
    it('funds a train only into the empty shell (§8.3.5.1)', () => {
        const { game, bought } = system(['2'])
        edit(game, (state) => {
            state.turnMarks = [TrainShellMarks[0]]
        })
        const required = vi.spyOn(TrainRules1828, 'mayRequireTrain').mockReturnValue(true)
        expect(
            TransferRules1828.purchaseFunding?.(game.hydrated, 'BO', {
                kind: 'train',
                trainId: bought
            })
        ).toBeUndefined()
        required.mockRestore()
    })
    it('keeps a seller of a train from being dumped in the same turn (thread 2368855)', () => {
        const { game } = system(['2', '2'])
        edit(game, (state) => {
            state.turnMarks = [trainBoughtFromMark('NYC')]
        })
        expect(dumpsTrainSeller(game.hydrated, [{ companyId: 'NYC', presidency: {} }])).toBe(true)
        expect(dumpsTrainSeller(game.hydrated, [{ companyId: 'NYC' }])).toBe(false)
        expect(dumpsTrainSeller(game.hydrated, [{ companyId: 'PRR', presidency: {} }])).toBe(false)
    })
    it('closes the shells once a train has come from another company', () => {
        const { game } = system(['2', '2'])
        const step = (turnMarks: string[]) =>
            stateWith(game.hydrated, {
                machineState: 'BuyingTrains',
                trainPurchaseStep: { companyId: 'BO', purchasedTrainIds: [] },
                operatingSet: {
                    number: 1,
                    roundNumber: 1,
                    roundCount: 1,
                    companyOrder: ['BO'],
                    completedCompanyIds: [],
                    privateIncomePaid: true,
                    completed: false
                },
                turnMarks
            })
        expect(shellsOpen(step([]), 'BO')).toBe(true)
        expect(shellsOpen(step([ShellsClosedMark]), 'BO')).toBe(false)
    })
    it('forgets a train that rusts or is sold, so one bought back is placed again', () => {
        const { game, bought } = system(['2', '2', '2'])
        const state = game.hydrated
        const [rusted, sold] = state.systems.BO.shellTrainIds[0]
        TrainRules1828.afterTrainsDepart?.(state, [
            {
                trainId: rusted,
                definitionId: '2',
                cause: 'rust',
                owner: { kind: 'company', companyId: 'BO' }
            }
        ])
        expect(state.systems.BO.shellTrainIds[0]).toEqual([sold])
        TransferRules1828.afterPurchase(state, {
            id: 'offer',
            seller: { kind: 'company', companyId: 'BO' },
            price: 1,
            buyerPlayerId: 'p2',
            sellerPlayerId: 'p1',
            buyer: { kind: 'company', companyId: 'NYC' },
            asset: { kind: 'train', trainId: sold }
        })
        expect(state.systems.BO.shellTrainIds).toEqual([[], []])
        expect(bought).not.toBe(sold)
    })
    it('funds another company’s train for an empty shell', () => {
        const { game, bought } = system(['2'])
        const required = vi.spyOn(TrainRules1828, 'mayRequireTrain').mockReturnValue(true)
        expect(
            TransferRules1828.purchaseFunding?.(game.hydrated, 'BO', {
                kind: 'train',
                trainId: bought
            })
        ).toMatchObject({ contributors: [{ kind: 'player' }] })
        required.mockRestore()
    })
})

describe('stations and names', () => {
    it('counts the C&P’s replaced station as the round’s station (§8.3.2)', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        floatCompany(game, 'BO')
        kit.passStockRound(game)
        game.act('FinishTrack', { companyId: 'CPRY' })
        while (game.state.trackStep?.companyId !== 'BO')
            game.act('FinishOperatingTurn', { companyId: game.state.trackStep?.companyId })
        edit(game, (state) => {
            state.turnMarks = ['cobourg-station']
            getCompany(state, 'CPRY').closed = true
        })
        game.act('ReplaceCobourgStation', { companyId: 'BO', replace: true })
        expect(game.state.stationStep?.placedStationIds).toHaveLength(1)
        expect(
            privateStationPositions(game.hydrated, StationRules1828, {
                companyId: 'BO',
                locationId: 'F20'
            })
        ).toEqual([])
    })
    it('places the Erie’s home as soon as a tile reaches Buffalo/Dunkirk (§13.3.2)', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        kit.passStockRound(game)
        const operating = game.player
        const director = game.state.players.find(({ playerId }) => playerId !== operating)
        if (!director) throw new Error('Another player directs the Erie')
        edit(game, (state) => {
            Object.assign(getCompany(state, 'ERIE'), {
                started: true,
                floated: true,
                parPrice: 67,
                president: { kind: 'player', playerId: director.playerId }
            })
            placeStockMarker(state.stockMarket, 'ERIE', kit.spaceAt(67))
            const certificate = state.certificates.find(
                (entry) => entry.companyId === 'ERIE' && entry.kind === 'share' && entry.president
            )
            if (!certificate) throw new Error('The Erie has a director’s certificate')
            certificate.owner = { kind: 'player', playerId: director.playerId }
            delete certificate.poolId
            state.tileInventory = TileSet1828.createInventory([
                { locationId: 'E15', definitionId: '18xx:59', rotation: 0 }
            ])
            state.trackStep?.lays.push({ locationId: 'E15' })
        })
        const choice = StationRules1828.homeChoice?.(game.hydrated)
        expect(choice?.companyId).toBe('ERIE')
        expect(game.player).toBe(operating)
        game.state = { ...game.state, activePlayerIds: [director.playerId] }
        expect(game.valid(director.playerId)).toContain('ChooseHomeStation')
        const [position] = choice?.positions ?? []
        game.act('ChooseHomeStation', { companyId: 'ERIE', ...position }, director.playerId)
        expect(
            game.state.stations.some(
                (station) => station.companyId === 'ERIE' && station.status === 'placed'
            )
        ).toBe(true)
    })
    it('lets the D&H be used in the station step (§13.2.2.4)', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        floatCompany(game, 'BO')
        kit.passStockRound(game)
        game.act('FinishTrack', { companyId: 'CPRY' })
        while (game.state.trackStep?.companyId !== 'BO')
            game.act('FinishOperatingTurn', { companyId: game.state.trackStep?.companyId })
        edit(game, (state) => {
            const charter = state.certificates.find((entry) => entry.id === 'DH:charter')
            if (!charter) throw new Error('The D&H has a charter')
            charter.owner = { kind: 'company', companyId: 'BO' }
            setCash(state, { kind: 'company', companyId: 'BO' }, 1000)
        })
        game.act('FinishTrack', { companyId: 'BO' })
        expect(game.state.machineState).toBe('PlacingStation')
        expect(game.valid()).toContain('LayPrivateTile')
    })
    it('keeps the C&P’s train and coal markers from it (§13.2.2.5, §16.1)', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        const train = game.state.trainInventory.trains.find(
            (entry) => entry.definitionId === CobourgTrainId
        )
        if (!train) throw new Error('The C&P has its train')
        expect(
            TransferRules1828.priceRange(game.hydrated, 'BO', { kind: 'train', trainId: train.id })
        ).toBeUndefined()
        expect(AccessRightRules1828.purchaseTerms(game.hydrated, 'CPRY', player('p1'))).toEqual({
            reason: 'Only share companies acquire coal markers.'
        })
    })
    it('returns the tunnel’s marker to the Coalfields if the C&P builds it (§16.1)', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        expect(coalfieldsMarkers(game.hydrated)).toBe(2)
        edit(game, (state) => {
            const piece = TileSet1828.pieces.find(({ faceDefinitionIds }) =>
                faceDefinitionIds.includes(TunnelTileId)
            )
            if (!piece) throw new Error('The tile set has the tunnel’s tile')
            state.tileInventory.placements[TunnelLocationId] = {
                pieceId: piece.id,
                definitionId: TunnelTileId,
                rotation: 0
            }
            expect(takeTunnelCoal(state, 'CPRY')).toBe('returned')
        })
        expect(coalfieldsMarkers(game.hydrated)).toBe(3)
        expect(coalHolders(game.hydrated)).toEqual([])
    })
    it('offers no D&H station once the round’s station is placed (§8.3.2)', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        edit(game, (state) => {
            state.stationStep = { companyId: 'BO', placedStationIds: ['BO:home'], completed: false }
        })
        expect(
            privateStationPositions(game.hydrated, StationRules1828, {
                companyId: 'BO',
                locationId: 'F20'
            })
        ).toEqual([])
    })
    it('names the $250 privates as §13.2.3 lists them', () => {
        const name = (companyId: string) =>
            Privates1828.find((entry) => entry.id === directorPrivateId(companyId))?.name
        expect(name('CPR')).toBe('Canadian Pacific')
        expect(name('MC')).toBe('Michigan Central')
        expect(name('NW')).toBe('Norfolk & Western')
    })
    it('sells a company’s shares of one turn together (§7.2)', () => {
        expect(StockRules1828.repeatSales).toBe('extend-block')
    })
})

describe('sold-out rises (§12.2)', () => {
    it('adds a row for a director holding 80% and another in the gray area', () => {
        const { game } = mergerPosition({ survivor: { p1: 8, p2: 2 }, absorbed: { p1: 6 } })
        edit(game, (state) => {
            state.stockMarket.stacks = [
                { spaceId: '9:0', companyIds: ['BO'] },
                { spaceId: '13:7', companyIds: ['CO'] }
            ]
        })
        expect(StockRoundRules1828.soldOutRises?.(game.hydrated, 'BO')).toBe(3)
    })
})

describe('trains and routes (§15)', () => {
    it('doubles a 3+D’s stops and pays an 8E nothing for towns', () => {
        const game = kit.table(4, 7)
        const doubled = TrainDepot1828.trainDefinition('3+D')
        const express = TrainDepot1828.trainDefinition('8E')
        const center = { locationId: 'C19', nodeId: 'town' }
        expect(RouteRules1828.stopRevenue?.(game.hydrated, 'BO', center, 10, doubled)).toBe(20)
        expect(RouteRules1828.stopRevenue?.(game.hydrated, 'BO', center, 10, express)).toBe(0)
        expect(
            RouteRules1828.stopRevenue?.(
                game.hydrated,
                'BO',
                { locationId: 'D18', nodeId: 'city' },
                20,
                express
            )
        ).toBe(20)
    })
    it('discards from a system shell over the limit, though both shells hold no more than twice it', () => {
        const { game } = mergerPosition({ survivor: { p1: 6 }, absorbed: { p2: 6 } })
        edit(game, (state) => {
            const ids = state.trainInventory.trains
                .filter((train) => train.definitionId === '6')
                .slice(0, 3)
            for (const train of ids)
                Object.assign(train, {
                    status: 'owned',
                    owner: { kind: 'company', companyId: 'BO' }
                })
            getCompany(state, 'CO').closed = true
            state.systems = {
                BO: { absorbedId: 'CO', shellTrainIds: [ids.map((train) => train.id), []] }
            }
            state.phaseId = '6'
        })
        expect(TrainRules1828.trainLimit(game.hydrated, 'BO')).toBe(4)
        expect(trainsOverLimit(game.hydrated, TrainRules1828, 'BO').length).toBe(3)
    })
})

describe('the Virginia Coalfields (§14.3.1.1, §16)', () => {
    it('is closed to a company without a coal marker', () => {
        const game = kit.table(4, 7)
        const center = { locationId: 'K11', nodeId: 'city' }
        expect(CoalAccess.open(game.hydrated, 'CO', center)).toBe(false)
        edit(game, (state) => {
            state.accessRights = [{ rightId: 'coal', companyId: 'CO' }]
        })
        expect(CoalAccess.open(game.hydrated, 'CO', center)).toBe(true)
    })
    it('takes only tile #4 in the tunnel', () => {
        const game = kit.table(4, 7)
        const reason = TrackRules1828.restriction(game.hydrated, {
            companyId: 'CO',
            locationId: 'K13',
            definitionId: '18xx:3',
            rotation: 0,
            nodeMapping: {}
        })
        expect(reason).toMatch(/#4/)
    })
})

describe('setup (§4)', () => {
    it.each([
        [3, 4, 800],
        [4, 5, 700],
        [5, 6, 620]
    ])('deals %i players %i $250 privates and $%i each', (players, privates, cash) => {
        const game = kit.table(players, 7)
        const drawn = game.state.companies.filter(
            (company) =>
                company.kind === 'private' && /^[A-Z]+P$/.test(company.id) && company.id !== 'CP'
        )
        expect(drawn.length).toBe(privates)
        const account = game.state.cash.find(
            (entry) => entry.owner.kind === 'player' && entry.owner.playerId === 'p1'
        )
        expect(account?.amount).toBe(cash)
    })
    it('drops a red train with three or four players', () => {
        const count = (game: Table) =>
            game.state.trainInventory.trains.filter((train) => train.definitionId === '6').length
        expect(count(kit.table(4, 7))).toBe(3)
        expect(count(kit.table(5, 7))).toBe(4)
    })
    it('keeps a friendly $250 private in the beginners’ game', () => {
        for (let seed = 1; seed <= 12; seed++) {
            const game = kit.table(3, seed, { beginnerPrivates: true })
            const ids = game.state.companies.map((company) => company.id)
            expect(ids.some((id) => ['GTP', 'NWP', 'OSHP'].includes(id))).toBe(true)
        }
    })
    it('starts the C&P with its station in Peterborough and its own train', () => {
        const game = kit.table(4, 7)
        const station = game.state.stations.find((entry) => entry.companyId === 'CPRY')
        expect(station).toMatchObject({ status: 'placed', position: { locationId: 'C15' } })
        expect(
            game.state.trainInventory.trains.some(
                (train) =>
                    train.status === 'owned' &&
                    train.owner.kind === 'company' &&
                    train.owner.companyId === 'CPRY'
            )
        ).toBe(true)
    })
})

describe('player cash checks', () => {
    it('lets a test set cash', () => {
        const game = kit.table(4, 7)
        edit(game, (state) => setCash(state, { kind: 'player', playerId: 'p1' }, 5))
        expect(
            game.state.cash.find(
                (entry) => entry.owner.kind === 'player' && entry.owner.playerId === 'p1'
            )?.amount
        ).toBe(5)
        expect(player('p1').kind).toBe('player')
    })
})

describe('the Cobourg & Peterborough (§13.2.2.5)', () => {
    /** The C&P's tile laid in its first operating round. */
    function cobourgLaid(locationId: string, definitionId: string, edges: number[]): Table {
        const game = kit.table(4, 7)
        openAuction(game)
        kit.passStockRound(game)
        expect(game.state.trackStep?.companyId).toBe('CPRY')
        kit.lay(game, locationId, definitionId, edges)
        return game
    }
    const treasury = (game: Table) =>
        game.state.cash.find(
            (entry) => entry.owner.kind === 'company' && entry.owner.companyId === 'CPRY'
        )?.amount

    it('pays half of the run its owner chooses, half to its treasury', () => {
        // An east–west straight in C17 runs Peterborough to Kingston: $15 each (designer, BGG
        // thread 2162379).
        const game = cobourgLaid('C17', '18xx:9', [1, 4])
        const runs = cobourgRuns(game.hydrated)
        expect(runs.map((run) => run.revenue)).toEqual([30])
        expect(game.valid()).toContain('ChooseCobourgRun')
        game.act('ChooseCobourgRun', { stops: runs[0].stops })
        expect(game.actions.at(-1)?.type).not.toBe('RunTrains')
        expect(treasury(game)).toBe(15)
    })
    /** Sets the C&P's Autorun, as its owner's tap does. */
    function autorun(game: Table, playerId: string): void {
        game.act(
            'SetRunInstruction',
            {
                outOfTurn: true,
                supersedable: true,
                supersessionScope: 'companyId',
                companyId: 'CPRY',
                instruction: { payout: 'pay', run: { routes: [], key: 'cobourg' } }
            },
            playerId
        )
    }
    /** The C&P's tile in Barrie, track already joining it to Peterborough: $50 or $40. */
    function twoRunChoice(): Table {
        const game = kit.table(4, 7)
        openAuction(game)
        kit.passStockRound(game)
        const owner = game.player
        edit(game, (state) => {
            setCash(state, { kind: 'player', playerId: owner }, 1000)
            setCash(state, { kind: 'company', companyId: 'CPRY' }, 1000)
            state.tileInventory = TileSet1828.createInventory(
                kit
                    .trackAlong(['C15', 'C13', 'B14'])
                    .filter((placement) => placement.locationId === 'C13')
            )
        })
        kit.lay(game, 'B14', '18xx:57', [0, 3])
        return game
    }
    it('lets its owner take a lesser run (§13.2.2.5)', () => {
        const game = twoRunChoice()
        const runs = cobourgRuns(game.hydrated)
        expect(runs.map((run) => run.revenue)).toEqual([50, 40])
        const before = treasury(game) ?? 0
        game.act('ChooseCobourgRun', { stops: runs[1].stops })
        expect((treasury(game) ?? 0) - before).toBe(20)
    })
    it('under Autorun waits for its owner’s tile, then takes the run through it', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        kit.passStockRound(game)
        autorun(game, game.player)
        expect(game.state.trackStep?.companyId).toBe('CPRY')
        expect(game.valid()).toContain('LayTile')
        kit.lay(game, 'C17', '18xx:9', [1, 4])
        const run = game.actions.find((action) => action.type === 'RunCobourg')
        expect(run?.metadata).toMatchObject({ revenue: 30 })
        expect(treasury(game)).toBe(15)
    })
    it('under Autorun takes the best of its runs', () => {
        const game = twoRunChoice()
        const before = treasury(game) ?? 0
        autorun(game, game.player)
        const run = game.actions.findLast((action) => action.type === 'RunCobourg')
        expect(run?.metadata).toMatchObject({ revenue: 50 })
        expect((treasury(game) ?? 0) - before).toBe(25)
    })
    it('keeps one of the runs that pay the same', () => {
        const run = (revenue: number, locationId: string) => ({
            stops: [{ locationId, nodeId: 'city' }],
            revenue,
            paths: [],
            payments: []
        })
        const runs = [run(50, 'A'), run(50, 'B'), run(40, 'C')]
        expect(oneRunPerRevenue(runs)).toEqual([runs[0], runs[2]])
    })
    it('gives each run the track it follows', () => {
        const runs = cobourgRuns(twoRunChoice().hydrated)
        expect(runs.every((run) => run.paths.length > 0)).toBe(true)
        expect(runs[0].payments.reduce((sum, { amount }) => sum + amount, 0)).toBe(runs[0].revenue)
    })
    it('offers a run whose tile lies off one end (§13.2.2.5)', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        kit.passStockRound(game)
        edit(game, (state) => {
            state.tileInventory = TileSet1828.createInventory(
                kit
                    .trackAlong(['C15', 'C17', 'C19'])
                    .filter((placement) => placement.locationId === 'C17')
            )
        })
        kit.lay(game, 'C13', '18xx:7', [4, 5])
        expect(cobourgRuns(game.hydrated).map((run) => run.revenue)).toEqual([30])
    })
    it('pays nothing without a run through its tile', () => {
        // A curve west of Peterborough into Hamilton's untracked hex reaches no second stop.
        const game = cobourgLaid('C13', '18xx:7', [4, 5])
        const run = game.actions.find((action) => action.type === 'RunCobourg')
        expect(run?.metadata).toMatchObject({ revenue: 0, payments: [] })
        expect(treasury(game)).toBe(0)
    })
})

describe('the Mohawk & Hudson (§13.2.2.6)', () => {
    it('trades with one share’s par for a director’s certificate on a stock turn', () => {
        const game = kit.table(4, 7)
        openAuction(game)
        const owner = game.state.certificates.find((entry) => entry.id === 'MH:charter')?.owner
        if (owner?.kind !== 'player') throw new Error('A player owns the M&H')
        edit(game, (state) => {
            state.turnManager.turnOrder = [
                owner.playerId,
                ...state.turnManager.turnOrder.filter((id) => id !== owner.playerId)
            ]
        })
        while (game.player !== owner.playerId) game.act('FinishStockTurn')
        const before = game.state.cash.find(
            (entry) => entry.owner.kind === 'player' && entry.owner.playerId === owner.playerId
        )?.amount
        game.act('ExchangeMohawkForDirectorship', {
            companyId: 'NYC',
            marketSpaceId: '13:7',
            expectedPrice: 67
        })
        expect(getCompany(game.state, 'MH').closed).toBe(true)
        expect(getCompany(game.state, 'NYC')).toMatchObject({ started: true, parPrice: 67 })
        expect(sharesOwned(game.state, 'NYC', player(owner.playerId))).toBe(2)
        const after = game.state.cash.find(
            (entry) => entry.owner.kind === 'player' && entry.owner.playerId === owner.playerId
        )?.amount
        expect((before ?? 0) - (after ?? 0)).toBe(67)
        // The exchange was the turn's purchase; with nothing to sell in the first round, the turn ends.
        expect(game.player).not.toBe(owner.playerId)
    })

    describe('in an operating round', () => {
        const IpoPool = 'initial-offering'
        const first = 'BM'
        /** An operating round with `first` to run after the C&P, and `floating` one share short. */
        function round(floatingPrice = 67) {
            const game = kit.table(4, 7)
            openAuction(game)
            const ownerOf = (id: string) => {
                const owner = game.state.certificates.find(
                    (entry) => entry.id === `${id}:charter`
                )?.owner
                if (owner?.kind !== 'player') throw new Error('A player owns it')
                return owner.playerId
            }
            const mohawk = ownerOf('MH')
            const floating = game.state.companies.find(
                (company) => company.kind === 'major' && company.started
            )?.id
            if (!floating) throw new Error('A $250 private started a company')
            const other = game.state.players.find(({ playerId }) => playerId !== mohawk)?.playerId
            if (!other) throw new Error('Another player')
            edit(game, (state) => {
                kit.operated(state, first, other, { price: 67 })
                state.certificates
                    .filter(
                        (entry) =>
                            entry.kind === 'share' &&
                            entry.companyId === floating &&
                            entry.poolId === IpoPool
                    )
                    .slice(0, 2)
                    .forEach((entry) => {
                        entry.owner = { kind: 'player', playerId: other }
                        delete entry.poolId
                    })
                if (floatingPrice !== 67) {
                    const space = Market1828.spaces.find(
                        (entry) => entry.price === floatingPrice && entry.color === 'yellow'
                    )
                    if (!space) throw new Error('No such par')
                    removeStockMarker(state.stockMarket, floating)
                    placeStockMarker(state.stockMarket, floating, space.id)
                }
            })
            kit.passStockRound(game)
            return { game, mohawk, floating }
        }
        function exchangeShare(game: Table, mohawk: string, floating: string) {
            const offer = mohawkOffers(game.hydrated, mohawk).shares.find(
                (entry) => entry.companyId === floating && entry.poolId === IpoPool
            )
            if (!offer) throw new Error('No share on offer')
            const active = game.state.activePlayerIds.includes(mohawk)
            game.act(
                active ? 'ExchangePrivate' : 'ExchangePrivateOutOfTurn',
                {
                    privateCompanyId: 'MH',
                    certificateId: offer.certificateId,
                    ...(active ? {} : { outOfTurn: true, sequenced: true })
                },
                mohawk
            )
            return offer
        }
        const order = (game: Table) => game.state.operatingSet?.companyOrder ?? []
        const skipCobourg = (game: Table) => {
            while (game.state.trackStep?.companyId === 'CPRY')
                game.act('FinishTrack', { companyId: 'CPRY' })
        }

        it('lets a company floated on the C&P’s turn operate that round', () => {
            const { game, mohawk, floating } = round()
            expect(game.state.trackStep?.companyId).toBe('CPRY')
            expect(exchangeShare(game, mohawk, floating).float).toBe('this-round')
            expect(getCompany(game.state, floating).floated).toBe(true)
            expect(order(game)).toContain(floating)
            expect(order(game)[0]).toBe('CPRY')
            expect(game.state.trackStep?.companyId).toBe('CPRY')
        })
        it('puts a dearer company ahead of the first company before it acts', () => {
            const { game, mohawk, floating } = round(79)
            skipCobourg(game)
            expect(game.state.trackStep?.companyId).toBe(first)
            expect(exchangeShare(game, mohawk, floating).float).toBe('this-round')
            expect(game.state.trackStep?.companyId).toBe(floating)
            expect(order(game).indexOf(floating)).toBeLessThan(order(game).indexOf(first))
        })
        it('holds the company for the next round once the first company has acted', () => {
            const { game, mohawk, floating } = round(79)
            skipCobourg(game)
            game.act('FinishTrack', { companyId: first })
            expect(exchangeShare(game, mohawk, floating).float).toBe('next-round')
            expect(getCompany(game.state, floating).floated).toBe(true)
            expect(order(game)).not.toContain(floating)
        })
        it('is not held back by another player’s standing instruction', () => {
            const { game, mohawk, floating } = round(79)
            skipCobourg(game)
            const owner = controllingOwner(game.state, 'CPRY')
            if (!owner) throw new Error('A player runs the C&P')
            game.act(
                'SetRunInstruction',
                {
                    outOfTurn: true,
                    supersedable: true,
                    supersessionScope: 'companyId',
                    companyId: 'CPRY',
                    instruction: { payout: 'pay', run: { routes: [], key: 'cobourg' } }
                },
                owner.playerId
            )
            expect(exchangeShare(game, mohawk, floating).float).toBe('this-round')
        })
        it('takes half a directorship off its owner’s turn, paying one share’s par', () => {
            const { game, mohawk } = round()
            expect(game.state.activePlayerIds).not.toContain(mohawk)
            const offer = mohawkOffers(game.hydrated, mohawk).directorships.find(
                (entry) => entry.companyId === 'NYC'
            )
            const par = offer?.pars[0]
            if (!par) throw new Error('No directorship on offer')
            const cash = (state: State1828) =>
                state.cash.find(
                    (entry) => entry.owner.kind === 'player' && entry.owner.playerId === mohawk
                )?.amount ?? 0
            const before = cash(game.state)
            game.act(
                'ExchangeMohawkForDirectorshipOutOfTurn',
                {
                    companyId: 'NYC',
                    marketSpaceId: par.marketSpaceId,
                    expectedPrice: par.price,
                    outOfTurn: true,
                    sequenced: true
                },
                mohawk
            )
            expect(sharesOwned(game.state, 'NYC', player(mohawk))).toBe(2)
            expect(before - cash(game.state)).toBe(par.price)
            expect(getCompany(game.state, 'MH').closed).toBe(true)
            expect(game.state.stockRound.turn.bought).toBeFalsy()
        })
        it('keeps a share that would change the director buying a train (§8.3.5.2)', () => {
            const { game, mohawk } = round()
            skipCobourg(game)
            const shareOf = (state: State1828) =>
                state.certificates.find(
                    (entry) =>
                        entry.kind === 'share' &&
                        entry.companyId === first &&
                        entry.poolId === IpoPool
                )
            const offered = (machineState: string) =>
                PrivateRules1828.exchangeTerms(
                    stateWith(game.hydrated, { machineState }),
                    'MH'
                )?.certificateIds.includes(shareOf(game.state)?.id ?? '')
            edit(game, (state) => {
                state.certificates
                    .filter(
                        (entry) =>
                            entry.kind === 'share' && entry.companyId === first && !entry.president
                    )
                    .forEach((entry, index) => {
                        if (index < 2) {
                            entry.owner = { kind: 'player', playerId: mohawk }
                            delete entry.poolId
                        } else {
                            entry.owner = { kind: 'bank' }
                            entry.poolId = IpoPool
                        }
                    })
            })
            expect(offered('BuyingTrains')).toBe(true)
            expect(offered('FundingTrain')).toBe(false)
        })
    })
})
