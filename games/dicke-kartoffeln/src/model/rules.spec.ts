import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    MarketBoardId,
    demandRange,
    shiftedDemand,
    shiftedPrice,
    startingPosition
} from '../components/marketBoards.js'
import {
    ContestAward,
    MESSAGE_SPACE_IDS,
    MessageId,
    MessageSpaceId,
    spaceForRoll
} from '../components/messages.js'
import { MarketId, Variety } from '../components/potatoes.js'
import { isReadMessage } from '../actions/readMessage.js'
import { isSellPotatoes } from '../actions/sellPotatoes.js'
import { isEndYear } from '../actions/endYear.js'
import { isRevealPlans } from '../actions/revealPlans.js'
import { MachineState } from '../definition/states.js'
import { Table } from '../testing/table.js'
import { harvestField } from './harvest.js'
import { recalculateMarket } from './market.js'
import { planProblem } from './planRules.js'
import { PlanKind, emptyPlan, isPlanningState, planKindFor } from './plans.js'
import type { FieldState, HydratedDickeKartoffelnPlayerState } from './playerState.js'
import { standings } from './scoring.js'
import { growSunflowers, organicIfKeptClean, reactSoil } from './soil.js'

function field(changes: Partial<FieldState> = {}): FieldState {
    return {
        id: 1,
        worms: 3,
        sunflowers: 1,
        skull: false,
        furrow: false,
        fertilizer: 0,
        poison: false,
        ...changes
    }
}

// Plays bot plans until the given planning round comes up again.
function playUntil(table: Table, round: MachineState) {
    table.playRound()
    for (let rounds = 0; table.state.machineState !== round; rounds++) {
        if (rounds > 40 || table.state.result) throw Error(`Never reached ${round}`)
        table.playRound()
    }
}

function player(table: Table, playerId: string): HydratedDickeKartoffelnPlayerState {
    return table.hydrated.getPlayerState(playerId)
}

describe('the market boards', () => {
    it('start the six markets where the 3–6 player board prints them', () => {
        const board = MarketBoardId.ThreeToSixPlayers
        expect(startingPosition(board, 4, MarketId.AmalieNorm).price).toBe(160)
        expect(startingPosition(board, 4, MarketId.AmalieBio).price).toBe(220)
        expect(startingPosition(board, 4, MarketId.ChrisNorm).price).toBe(140)
        expect(startingPosition(board, 3, MarketId.BiolaNorm).demand).toBe(5)
        expect(startingPosition(board, 6, MarketId.BiolaNorm).demand).toBe(11)
        expect(startingPosition(board, 5, MarketId.ChrisBio).demand).toBe(2)
    })

    it('keep markers on printed values and stop them at either end of a chart', () => {
        const board = MarketBoardId.ThreeToSixPlayers
        expect(demandRange(board, 11)).toEqual({ min: 11, max: 14 })
        expect(shiftedDemand(board, 11, 1)).toBe(15)
        expect(shiftedDemand(board, 0, -1)).toBe(0)
        expect(shiftedPrice(board, 120, 2)).toBe(160)
        expect(shiftedPrice(board, 320, 1)).toBe(320)
        expect(() => demandRange(board, 12)).toThrow()
    })

    it('uses the two player board for two farmers', () => {
        const table = new Table(2)
        const state = table.hydrated
        expect(state.marketBoard()).toBe(MarketBoardId.TwoPlayers)
        expect(state.price(MarketId.AmalieNorm)).toBe(160)
        expect(state.demand(MarketId.AmalieNorm)).toEqual({ min: 7, max: 8 })
        expect(state.price(MarketId.BiolaBio)).toBe(180)
    })

    // Rulebook example: demand 3–4 at 180; twelve sacks offered move demand to 11–14, a
    // difference of three rows, so the price falls two steps to 140.
    it('moves the price by how far an offer moves the demand', () => {
        const table = new Table(4)
        table.edit((state) => {
            const market = state.market(MarketId.BiolaNorm)
            market.demand = 3
            market.price = 180
            const [farmer] = state.players
            farmer.fields[0].seed = Variety.Biola
            farmer.fields[0].sale = { norm: 12, bio: 0 }
        })
        const state = table.hydrated
        const move = recalculateMarket(state, MarketId.BiolaNorm)
        expect(move.offered).toBe(12)
        expect(state.demand(MarketId.BiolaNorm)).toEqual({ min: 11, max: 14 })
        expect(state.price(MarketId.BiolaNorm)).toBe(140)
    })

    it('raises the price when nothing is offered, and never past the end of the scale', () => {
        const table = new Table(4)
        table.edit((state) => {
            const market = state.market(MarketId.AmalieBio)
            market.demand = 60
            market.price = 300
        })
        const state = table.hydrated
        recalculateMarket(state, MarketId.AmalieBio)
        expect(state.demand(MarketId.AmalieBio)).toEqual({ min: 0, max: 1 })
        expect(state.price(MarketId.AmalieBio)).toBe(320)
    })
})

describe('harvests', () => {
    // Rulebook example: fertilized Amalie with four worms yields six sacks; a potato beetle
    // invasion costs an unsprayed Amalie-Norm field two of them.
    it('read the chart and the year’s message', () => {
        const amalie = field({ seed: Variety.Amalie, worms: 4, fertilizer: 1, sunflowers: 0 })
        expect(harvestField(amalie)?.sacks).toBe(6)
        expect(harvestField(amalie, MessageId.PotatoBeetles)).toMatchObject({
            chart: 6,
            adjustment: -2,
            sacks: 4
        })
        expect(harvestField({ ...amalie, poison: true }, MessageId.PotatoBeetles)?.sacks).toBe(6)
    })

    it('treat a field with three sunflowers as organic', () => {
        const organic = field({ seed: Variety.Amalie, worms: 5, sunflowers: 3 })
        expect(harvestField(organic, MessageId.PotatoBeetles)?.sacks).toBe(2)
        expect(harvestField(organic, MessageId.EcoSurveyAndBlight)?.sacks).toBe(0)
    })

    it('give an unfertilized Biola field one more sack in good weather', () => {
        expect(
            harvestField(field({ seed: Variety.Biola, worms: 1 }), MessageId.GoodWeather)?.sacks
        ).toBe(1)
        expect(
            harvestField(
                field({ seed: Variety.Biola, worms: 2, fertilizer: 1 }),
                MessageId.GoodWeather
            )?.sacks
        ).toBe(2)
    })

    it('yield nothing from a dead field', () => {
        expect(
            harvestField(field({ seed: Variety.Biola, worms: 0 }), MessageId.GoodWeather)?.sacks
        ).toBe(0)
        expect(harvestField(field())).toBeUndefined()
    })
})

describe('sunflowers', () => {
    it('grow on clean living fields up to three', () => {
        const clean = field({ sunflowers: 2 })
        growSunflowers(clean)
        growSunflowers(clean)
        expect(clean.sunflowers).toBe(3)
    })

    it('are wiped out by chemicals and held back by a skull', () => {
        const sprayed = field({ sunflowers: 3, seed: Variety.Chris, poison: true })
        growSunflowers(sprayed)
        expect(sprayed.sunflowers).toBe(0)
        const scarred = field({ sunflowers: 1, skull: true })
        growSunflowers(scarred)
        expect(scarred.sunflowers).toBe(1)
    })

    it('make a field kept clean organic by the harvest once it has two', () => {
        expect(organicIfKeptClean(field({ sunflowers: 2 }))).toBe(true)
        expect(organicIfKeptClean(field({ sunflowers: 2, fertilizer: 1 }))).toBe(true)
        expect(organicIfKeptClean(field({ sunflowers: 1 }))).toBe(false)
        expect(organicIfKeptClean(field({ sunflowers: 2, skull: true }))).toBe(false)
        expect(organicIfKeptClean(field({ sunflowers: 3, skull: true }))).toBe(true)
        expect(organicIfKeptClean(field({ sunflowers: 0, worms: 0 }))).toBe(false)
    })
})

describe('the reaction of the soil', () => {
    it('costs a worm for the seed, the poison and each sack of fertilizer', () => {
        const worked = field({
            worms: 5,
            seed: Variety.Amalie,
            poison: true,
            fertilizer: 2,
            skull: true
        })
        reactSoil(worked)
        expect(worked).toMatchObject({ worms: 1, skull: true, furrow: false, fertilizer: 0 })
        expect(worked.seed).toBeUndefined()
    })

    it('lets a clean year heal a skull and a fallow field breed a worm', () => {
        const fallow = field({ worms: 2, skull: true, furrow: true })
        reactSoil(fallow)
        expect(fallow).toMatchObject({ worms: 3, skull: false, furrow: false })
        const dead = field({ worms: 0, sunflowers: 0 })
        reactSoil(dead)
        expect(dead.worms).toBe(0)
    })
})

describe('plans', () => {
    it('are refused when they break the rules', () => {
        const table = new Table(3)
        table.edit((state) => {
            const fields = state.getPlayerState('p0').fields
            fields[0].harvest = 3
            fields[0].seed = Variety.Biola
            fields[1].worms = 5
        })
        const farmer = player(table, 'p0')
        expect(
            planProblem(farmer, {
                kind: PlanKind.RegisterSales,
                sales: [{ fieldId: 1, norm: 0, bio: 2 }]
            })
        ).toMatch(/three sunflowers/)
        expect(
            planProblem(farmer, {
                kind: PlanKind.RegisterSales,
                sales: [{ fieldId: 1, norm: 4, bio: 0 }]
            })
        ).toMatch(/more sacks/)
        expect(
            planProblem(farmer, {
                kind: PlanKind.Sow,
                seeds: [{ fieldId: 2, variety: Variety.Chris }]
            })
        ).toMatch(/ploughed/)
        expect(planProblem(farmer, { kind: PlanKind.Cultivate, fieldIds: [1, 1] })).toMatch(/once/)
        expect(
            planProblem(farmer, { kind: PlanKind.TakeCompost, takes: [{ fieldId: 3, worms: 4 }] })
        ).toBeDefined()
    })

    it('stay sealed until every farmer commits, then are carried out together', () => {
        const table = new Table(3)
        expect(table.state.machineState).toBe(MachineState.TakingCompost)
        table.submit('p0', { kind: PlanKind.TakeCompost, takes: [{ fieldId: 1, worms: 2 }] })
        expect(player(table, 'p0').fields[0].worms).toBe(3)
        table.submit('p1', { kind: PlanKind.TakeCompost, takes: [] })
        const processed = table.submit('p2', { kind: PlanKind.TakeCompost, takes: [] })
        expect(processed.some(isRevealPlans)).toBe(true)
        const farmer = player(table, 'p0')
        expect(farmer.fields[0].worms).toBe(1)
        expect(farmer.freshCompost).toBe(2)
        expect(farmer.cash).toBe(700)
        expect(table.state.machineState).toBe(MachineState.Cultivating)
    })

    it('borrow in bills of 500 whenever a farmer cannot pay', () => {
        const table = new Table(3)
        table.edit((state) => {
            state.getPlayerState('p0').cash = 30
        })
        table.playRound({ p0: { kind: PlanKind.TakeCompost, takes: [{ fieldId: 1, worms: 1 }] } })
        expect(player(table, 'p0')).toMatchObject({ cash: 430, loans: 1 })
    })
})

describe('compost', () => {
    it('doubles over the winter and must be spread or sold the next autumn', () => {
        const table = new Table(3)
        table.playRound({
            p0: { kind: PlanKind.TakeCompost, takes: [{ fieldId: 1, worms: 3 }] },
            p1: { kind: PlanKind.TakeCompost, takes: [] },
            p2: { kind: PlanKind.TakeCompost, takes: [] }
        })
        playUntil(table, MachineState.TakingCompost)
        const farmer = player(table, 'p0')
        expect(farmer.freshCompost).toBe(0)
        expect(farmer.ripeCompost).toBe(6)
        playUntil(table, MachineState.SpreadingCompost)
        const before = player(table, 'p0')
        const target = before.fields.find((candidate) => candidate.worms <= 3)
        assertExists(target, 'A field has room for worms')
        table.playRound({
            p0: { kind: PlanKind.SpreadCompost, placements: [{ fieldId: target.id, worms: 2 }] }
        })
        const spread = table.processed
            .findLast(isRevealPlans)
            ?.metadata?.outcomes.find((outcome) => outcome.playerId === 'p0')
        expect(spread).toMatchObject({ cost: 100, income: 4 * 60 })
        const after = player(table, 'p0')
        expect(after.field(target.id).worms).toBe(target.worms + 2)
        expect(after.ripeCompost).toBe(before.freshCompost * 2)
    })
})

describe('messages', () => {
    it('lie on the spaces the die faces name', () => {
        expect([1, 2, 3, 4, 5, 6].map(spaceForRoll)).toEqual([
            MessageSpaceId.OneToThree,
            MessageSpaceId.OneToThree,
            MessageSpaceId.OneToThree,
            MessageSpaceId.FourFive,
            MessageSpaceId.FourFive,
            MessageSpaceId.Six
        ])
        expect(new Table(3).state.messages?.spaces.map((card) => card.space)).toEqual(
            MESSAGE_SPACE_IDS
        )
    })

    it('set a ministry contest aside in the first year', () => {
        const table = new Table(3)
        table.edit((state) => {
            const board = state.messageBoard()
            board.spaces = MESSAGE_SPACE_IDS.map((space) => ({
                space,
                messageId: MessageId.AgricultureContest
            }))
            board.deck.items = board.deck.items.filter(
                (messageId) =>
                    messageId !== MessageId.AgricultureContest &&
                    messageId !== MessageId.EnvironmentContest
            )
            board.deck.remaining = board.deck.items.length
        })
        playUntil(table, MachineState.RegisteringSales)
        const read = table.processed.find(isReadMessage)
        expect(read?.metadata?.setAside).toEqual([MessageId.AgricultureContest])
        expect(read?.metadata?.messageId).not.toBe(MessageId.AgricultureContest)
        expect(table.state.contests).toEqual([])
    })

    it('wash fertilizer out of fields left with fewer than four worms in a rainy summer', () => {
        const table = new Table(3)
        table.edit((state) => {
            state.messageBoard().spaces = MESSAGE_SPACE_IDS.map((space) => ({
                space,
                messageId: MessageId.RainySummer
            }))
            const fields = state.getPlayerState('p0').fields
            fields[0].worms = 4
            fields[1].worms = 5
        })
        table.playRound({ p0: { kind: PlanKind.TakeCompost, takes: [] } })
        table.playRound({ p0: { kind: PlanKind.Cultivate, fieldIds: [1, 2] } })
        table.playRound({
            p0: {
                kind: PlanKind.Sow,
                seeds: [
                    { fieldId: 1, variety: Variety.Amalie },
                    { fieldId: 2, variety: Variety.Amalie }
                ]
            }
        })
        table.playRound({ p0: { kind: PlanKind.Fertilize, fieldIds: [1, 2] } })
        table.playRound({ p0: { kind: PlanKind.Spray, fieldIds: [] } })
        const read = table.processed.find(isReadMessage)
        expect(read?.metadata?.washedOut).toContainEqual({ playerId: 'p0', fieldIds: [1] })
        const fields = player(table, 'p0').fields
        expect(fields[0]).toMatchObject({ worms: 3, fertilizer: 0 })
        expect(fields[1]).toMatchObject({ worms: 4, fertilizer: 1 })
    })

    it('award a ministry contest to the year’s best sellers, sharing ties', () => {
        const table = new Table(3)
        table.edit((state) => {
            state.contests = [{ award: ContestAward.MostSacks, year: 1 }]
        })
        playUntil(table, MachineState.TakingCompost)
        const sale = table.processed.find(isSellPotatoes)
        const result = sale?.metadata?.contests[0]
        assertExists(result, 'The contest is decided')
        const sold =
            sale?.metadata?.farms.map((farm) =>
                farm.sales.reduce((sum, entry) => sum + entry.sacks, 0)
            ) ?? []
        const most = Math.max(...sold)
        expect(result.winnerIds.length).toBe(sold.filter((count) => count === most).length)
        expect(result.prize).toBe(Math.floor(240 / result.winnerIds.length))
        expect(table.state.contests).toEqual([])
    })
})

describe('the end of the year', () => {
    function idleYear(table: Table) {
        for (let rounds = 0; table.hydrated.year() === 1; rounds++) {
            if (rounds > 20) throw Error('The year never ended')
            const round = table.state.machineState
            if (!isPlanningState(round)) throw Error(`Stuck in ${round}`)
            table.playRound({ p0: emptyPlan(planKindFor(round)) })
        }
    }

    it.each([
        {
            cash: 50,
            loans: 3,
            repaid: 0,
            interest: 300,
            loansTaken: 1,
            after: { cash: 250, loans: 4 }
        },
        {
            cash: 1200,
            loans: 3,
            repaid: 2,
            interest: 100,
            loansTaken: 0,
            after: { cash: 100, loans: 1 }
        },
        {
            cash: 1600,
            loans: 3,
            repaid: 3,
            interest: 0,
            loansTaken: 0,
            after: { cash: 100, loans: 0 }
        }
    ])(
        'redeems what debt it can from $cash and charges interest on the rest',
        ({ cash, loans, repaid, interest, loansTaken, after }) => {
            const table = new Table(3)
            table.edit((state) => {
                Object.assign(state.getPlayerState('p0'), { cash, loans })
            })
            idleYear(table)
            const settlement = table.processed
                .find(isEndYear)
                ?.metadata?.settlements.find((entry) => entry.playerId === 'p0')
            expect(settlement).toEqual({ playerId: 'p0', repaid, interest, loansTaken })
            expect(player(table, 'p0')).toMatchObject(after)
        }
    )
})

describe('scoring', () => {
    it('ranks economy and ecology and awards places, ties sharing the better place', () => {
        const table = new Table(3)
        table.edit((state) => {
            const [a, b, c] = state.players
            a.cash = 1000
            b.cash = 1000
            c.cash = 400
            c.fields.forEach((candidate) => {
                candidate.worms = 0
                candidate.sunflowers = 0
            })
        })
        const state = table.hydrated
        const result = standings(state.players, false)
        expect(result.map((standing) => standing.economy)).toEqual([
            1000 + 15 * 50,
            1000 + 15 * 50,
            400
        ])
        expect(result.map((standing) => standing.economyPoints)).toEqual([6, 6, 3])
        expect(result.map((standing) => standing.ecology)).toEqual([55, 55, -50])
        expect(result.map((standing) => standing.ecologyPoints)).toEqual([4, 4, 0])
        expect(standings(state.players, true).map((standing) => standing.ecology)).toEqual([
            0, 0, -105
        ])
    })
})
