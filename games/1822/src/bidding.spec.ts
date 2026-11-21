import { describe, expect, it } from 'vitest'
import { committedCash, evaluateBids, leadingBid, trainsOwnedBy, presidentOf } from '@tabletop/18xx'
import { Random, botMove } from '../test/bot.js'
import { boxLot, kit, type Table } from '../test/kit.js'
import { cashOf, company, player } from '../test/positions.js'
import { FirstConcessionId, FirstMinorId, concessionId } from './companies.js'
import { bidBoxId1822, minorStart1822 } from './lots.js'
import { FirstPrivateId } from './privates.js'
import { BidBoxRules1822 } from './stock.js'
import { Market1822 } from './stockMarket.js'
import { TrainDepot1822 } from './trains.js'

/** The player on turn bids, and ends their turn if it has not ended itself. */
function bid(game: Table, bids: { lotId: string; amount: number }[]): string {
    const playerId = game.player
    game.act('PlaceBids', { bids }, playerId)
    if (game.state.machineState === 'StockRound' && game.player === playerId)
        game.act('FinishStockTurn', {}, playerId)
    return playerId
}
const pass = (game: Table) => game.act('FinishStockTurn', {}, game.player)

describe('setting up (§2.1)', () => {
    it('fills four minor, three concession and three private boxes with the fixed certificates first', () => {
        const { state } = kit.table(4, 3)
        expect(state.bidBoxes.boxes).toHaveLength(10)
        expect(boxLot(state, bidBoxId1822('minor', 1))).toBe(FirstMinorId)
        expect(boxLot(state, bidBoxId1822('concession', 1))).toBe(FirstConcessionId)
        expect(boxLot(state, bidBoxId1822('private', 1))).toBe(FirstPrivateId)
        expect(state.bidBoxes.stacks.map((stack) => stack.lotIds.length)).toEqual([20, 7, 15])
        expect(state.machineState).toBe('StockRound')
        expect(state.phaseId).toBe('1')
    })

    it.each([
        [3, 700],
        [4, 525],
        [5, 420],
        [6, 350],
        [7, 300]
    ])('gives each of %i players £%i from a bank of £12,000', (count, cash) => {
        const { state } = kit.table(count, 5)
        expect(state.players.map((entry) => cashOf(state, player(entry.playerId)))).toEqual(
            Array.from({ length: count }, () => cash)
        )
        const bank = state.cash.find((entry) => entry.owner.kind === 'bank')
        expect(bank?.amount).toBe(12_000 - count * cash)
    })
})

describe('bidding (§4.9)', () => {
    it('opens at face value in multiples of £5 and must top the highest bid', () => {
        const game = kit.table(4, 3)
        const state = game.hydrated
        const [first, second] = state.turnManager.turnOrder
        const bids = (playerId: string, lotId: string, amount: number) =>
            evaluateBids(state, BidBoxRules1822, playerId, [{ lotId, amount }])
        expect(bids(first, FirstMinorId, 95).reason).toBeDefined()
        expect(bids(first, FirstMinorId, 102).reason).toBeDefined()
        expect(bids(first, FirstMinorId, 100).bids).toHaveLength(1)
        expect(bids(first, FirstPrivateId, 0).bids).toHaveLength(1)
        bid(game, [{ lotId: FirstMinorId, amount: 100 }])
        const after = game.hydrated
        expect(
            evaluateBids(after, BidBoxRules1822, second, [{ lotId: FirstMinorId, amount: 100 }])
                .reason
        ).toBeDefined()
        expect(
            evaluateBids(after, BidBoxRules1822, second, [{ lotId: FirstMinorId, amount: 105 }])
                .bids
        ).toBeDefined()
    })

    it('places a turn’s bids one at a time, up to three, and the third ends the turn', () => {
        const game = kit.table(4, 3)
        const [first, second] = game.state.turnManager.turnOrder
        game.act('PlaceBids', { bids: [{ lotId: FirstMinorId, amount: 100 }] }, first)
        expect(game.player).toBe(first)
        expect(game.valid(first)).toEqual(expect.arrayContaining(['PlaceBids', 'FinishStockTurn']))
        expect(game.valid(first)).not.toContain('BuyShares')
        game.act('PlaceBids', { bids: [{ lotId: FirstPrivateId, amount: 0 }] }, first)
        expect(game.player).toBe(first)
        game.act('PlaceBids', { bids: [{ lotId: FirstConcessionId, amount: 100 }] }, first)
        expect(game.player).toBe(second)
        expect(game.state.bidBoxes.bids.filter((entry) => entry.playerId === first)).toHaveLength(3)
        // The count was the first player's turn's alone: the next turn bids from none.
        expect(game.state.bidBoxes.turnBids).toBeUndefined()
        game.act('PlaceBids', { bids: [{ lotId: FirstMinorId, amount: 105 }] }, second)
        expect(game.player).toBe(second)
        expect(game.state.bidBoxes.turnBids).toBe(1)
    })

    it('ends a turn of fewer bids when the player is done', () => {
        const game = kit.table(4, 3)
        const [first, second] = game.state.turnManager.turnOrder
        game.act('PlaceBids', { bids: [{ lotId: FirstMinorId, amount: 100 }] }, first)
        game.act('FinishStockTurn', {}, first)
        expect(game.player).toBe(second)
        expect(game.state.stockRound.passedPlayerIds).not.toContain(first)
    })

    it('lets a player raise only a bid that was topped, and never past their cash', () => {
        const game = kit.table(4, 3)
        const [first, second] = game.state.turnManager.turnOrder
        bid(game, [{ lotId: FirstMinorId, amount: 100 }])
        bid(game, [{ lotId: FirstMinorId, amount: 120 }])
        const state = game.hydrated
        expect(leadingBid(state, FirstMinorId)?.playerId).toBe(second)
        expect(committedCash(state, first)).toBe(0)
        expect(committedCash(state, second)).toBe(120)
        expect(
            evaluateBids(state, BidBoxRules1822, second, [{ lotId: FirstMinorId, amount: 125 }])
                .reason
        ).toMatch(/raised only/)
        expect(
            evaluateBids(state, BidBoxRules1822, second, [
                { lotId: FirstConcessionId, amount: 410 }
            ]).reason
        ).toMatch(/cash in hand/)
    })

    it('allows three bids a turn and as many lots as the player has tokens', () => {
        const game = kit.table(4, 3)
        const state = game.hydrated
        const [first] = state.turnManager.turnOrder
        const lots = state.bidBoxes.boxes.map((box) => box.lotId)
        const minimum = (lotId: string) => BidBoxRules1822.openingBid(state, lotId)
        const four = lots.slice(0, 4).map((lotId) => ({ lotId, amount: minimum(lotId) }))
        expect(evaluateBids(state, BidBoxRules1822, first, four).reason).toMatch(/3 bids/)
        expect(BidBoxRules1822.tokens(state, first)).toBe(5)
    })
})

describe('the end of a stock round (§4.10)', () => {
    it.each([
        ['1', 115, 50, 100],
        ['2', 115, 50, 100],
        ['3', 115, 50, 115],
        ['1', 145, 50, 100],
        ['2', 145, 70, 140],
        ['3', 145, 70, 145],
        ['2', 250, 100, 200],
        ['3', 250, 100, 250]
    ])(
        'starts a minor bought in phase %s for £%i at £%i with £%i (Table 5)',
        (phase, bid, price, treasury) => {
            const start = minorStart1822(phase, bid)
            expect(Market1822.space(start.marketSpaceId).price).toBe(price)
            expect(start.treasury).toBe(treasury)
        }
    )

    it('sells each lot to its highest bidder, removes trains for unsold minors and refills the boxes', () => {
        const game = kit.table(4, 3)
        const [first, second, third, fourth] = game.state.turnManager.turnOrder
        const before = game.state
        const unsoldMinors = [2, 3, 4].map((box) => boxLot(before, bidBoxId1822('minor', box)))
        const secondConcession = boxLot(before, bidBoxId1822('concession', 2))
        bid(game, [{ lotId: FirstMinorId, amount: 100 }])
        bid(game, [
            { lotId: FirstMinorId, amount: 130 },
            { lotId: FirstPrivateId, amount: 0 }
        ])
        bid(game, [{ lotId: FirstConcessionId, amount: 100 }])
        for (let turn = 0; turn < 4; turn++) pass(game)
        const state = game.state
        // Phase 1: £50 with £100 whatever was bid (§3.3.5).
        const minor = state.companies.find((entry) => entry.id === FirstMinorId)
        expect(minor).toMatchObject({ floated: true, parPrice: 50 })
        expect(presidentOf(state, FirstMinorId)).toEqual(player(second))
        expect(cashOf(state, company(FirstMinorId))).toBe(100)
        // The operating round has begun: P1 has paid £5 and the concession £10 (§3.1.1, §3.2.4).
        expect(cashOf(state, player(second))).toBe(525 - 130 + 5)
        expect(cashOf(state, player(third))).toBe(525 - 100 + 10)
        expect(cashOf(state, player(first))).toBe(525)
        const owner = (companyId: string) =>
            state.certificates.find((entry) => entry.companyId === companyId)?.owner
        expect(owner(FirstPrivateId)).toEqual(player(second))
        expect(owner(FirstConcessionId)).toEqual(player(third))
        // Three minors drew no bid: three L/2 trains leave the bank; box 1 was sold (§4.10.3).
        expect(
            state.trainInventory.trains.filter(
                (train) => train.status === 'depot' && train.definitionId === 'L'
            )
        ).toHaveLength(22 - 3)
        // The unsold minors move down and the boxes are refilled (§4.10.4).
        expect([1, 2, 3].map((box) => boxLot(state, bidBoxId1822('minor', box)))).toEqual(
            unsoldMinors
        )
        expect(boxLot(state, bidBoxId1822('minor', 4))).toBeDefined()
        expect(boxLot(state, bidBoxId1822('concession', 1))).toBe(secondConcession)
        expect(state.bidBoxes.boxes).toHaveLength(10)
        // Most cash goes first next round, those level keeping their order (§4.10.5).
        expect(state.turnManager.turnOrder).toEqual([first, fourth, third, second])
        expect(trainsOwnedBy(state, company(FirstMinorId))).toHaveLength(0)
        // The round's settling and declarations were its own, dropped as it completed.
        expect(state.bidBoxes.settled).toBeUndefined()
        expect(state.cashDeclaration).toBeUndefined()
        expect(state.taxHavenBought).toBeUndefined()
    })

    it('removes a minor left unsold in box 1 with the next train in the bank', () => {
        const game = kit.table(4, 3)
        bid(game, [{ lotId: FirstConcessionId, amount: 100 }])
        for (let turn = 0; turn < 4; turn++) pass(game)
        const state = game.state
        expect(state.companies.find((entry) => entry.id === FirstMinorId)?.closed).toBe(true)
        expect(state.stationReservations.some((entry) => entry.companyId === FirstMinorId)).toBe(
            false
        )
        // Four unsold minors take four L/2 trains, and box 1's minor a fifth (§4.10.3).
        expect(TrainDepot1822.remaining(state.trainInventory, 'L')).toBe(22 - 5)
        expect(state.bidBoxes.boxes.some((box) => box.lotId === FirstMinorId)).toBe(false)
        expect(state.phaseId).toBe('1')
    })

    it('closes a gap left during the operating rounds as the next stock round starts (§4.5.2)', () => {
        const game = kit.table(4, 3)
        const random = new Random(3)
        const play = (until: () => boolean) => {
            for (let count = 0; count < 2000 && !until(); count++) {
                const next = botMove(game, random)
                game.act(next.type, next.fields, next.playerId)
            }
        }
        play(() => game.state.machineState !== 'StockRound')
        const state = structuredClone(game.state)
        const gone = boxLot(state, bidBoxId1822('minor', 1))
        state.bidBoxes.boxes = state.bidBoxes.boxes.filter((box) => box.lotId !== gone)
        game.state = state
        play(() => game.state.machineState === 'StockRound')
        const minors = game.state.bidBoxes.boxes.filter((box) => box.boxId.startsWith('minor'))
        expect(minors.map((box) => box.boxId)).toEqual(
            [1, 2, 3, 4].map((number) => bidBoxId1822('minor', number))
        )
        expect(minors.map((box) => box.lotId)).not.toContain(gone)
    })

    it('ends the game at once when the first stock round sells nothing (§1.3.1)', () => {
        const game = kit.table(3, 3)
        for (let turn = 0; turn < 3; turn++) pass(game)
        expect(game.state.machineState).toBe('GameOver')
    })

    it('keeps a concession until its holder converts it', () => {
        expect(concessionId('LNWR')).toBe(FirstConcessionId)
    })
})
