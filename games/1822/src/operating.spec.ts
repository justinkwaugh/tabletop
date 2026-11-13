import { describe, expect, it } from 'vitest'
import {
    EmergencyTrainFunding,
    RouteEvaluation,
    corporateFinanceChoices,
    finalWealth,
    placeStockMarker
} from '@tabletop/18xx'
import { kit, type Table } from '../test/kit.js'
import { company, giveCharter, layTiles, player, runMinor, setCash } from '../test/positions.js'
import { concessionId } from './companies.js'
import { playerLoan1822 } from './loans.js'
import {
    CorporateFinanceRules1822,
    EarningsRules1822,
    EndingRules1822,
    TrainFundingRules1822,
    TrainRules1822,
    privateIncome1822
} from './operating.js'
import { operatingOrder1822 } from './order.js'
import { RouteRules1822 } from './routes.js'
import type { State1822 } from './state.js'
import { StockRules1822 } from './stock.js'
import { EndGameSpaceId1822, Market1822 } from './stockMarket.js'
import { TrackRules1822 } from './track.js'

function prepared(prepare: (state: State1822, players: string[]) => void, count = 4): Table {
    const game = kit.table(count, 3)
    const state = structuredClone(game.state)
    prepare(state, state.turnManager.turnOrder)
    game.state = state
    return game
}

describe('operating order (§5.2)', () => {
    it('runs minors before majors, each by descending share value', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            runMinor(state, 'M4', first, { price: 60 })
            runMinor(state, 'M5', first, { price: 90 })
            kit.operated(state, 'CR', first, { price: 100 })
            kit.operated(state, 'MR', first, { price: 70 })
        })
        expect(operatingOrder1822(game.state)).toEqual(['M5', 'M4', 'CR', 'MR'])
    })
})

describe('track (§5.8.13)', () => {
    const allowance = (state: State1822, companyId: string, colors: string[], color: string) =>
        TrackRules1822.allowance(
            {
                ...state,
                trackStep: {
                    companyId,
                    completed: false,
                    lays: colors.map((laid, index) => ({
                        locationId: `test-${index}`,
                        definitionId: laid === 'yellow' ? '18xx:9' : '18xx:80'
                    }))
                }
            },
            color
        )
    const allowed = (result: ReturnType<typeof allowance>) => !('reason' in result)

    it('gives a minor one tile a turn, green from phase 3 and never brown', () => {
        const game = prepared((state, [first]) => runMinor(state, 'M4', first))
        const state = game.state
        expect(allowed(allowance(state, 'M4', [], 'yellow'))).toBe(true)
        expect(allowed(allowance(state, 'M4', ['yellow'], 'yellow'))).toBe(false)
        expect(allowed(allowance(state, 'M4', [], 'green'))).toBe(false)
        expect(allowed(allowance({ ...state, phaseId: '3' }, 'M4', [], 'green'))).toBe(true)
        expect(allowed(allowance({ ...state, phaseId: '5' }, 'M4', [], 'brown'))).toBe(false)
    })

    it('gives a major one yellow tile in phase 2, then two yellow tiles or one upgrade', () => {
        const game = prepared((state, [first]) => kit.operated(state, 'CR', first))
        const at = (phaseId: string) => ({ ...game.state, phaseId })
        expect(allowed(allowance(at('2'), 'CR', ['yellow'], 'yellow'))).toBe(false)
        expect(allowed(allowance(at('3'), 'CR', ['yellow'], 'yellow'))).toBe(true)
        expect(allowed(allowance(at('3'), 'CR', ['yellow', 'yellow'], 'yellow'))).toBe(false)
        expect(allowed(allowance(at('3'), 'CR', ['yellow'], 'green'))).toBe(false)
        expect(allowed(allowance(at('3'), 'CR', ['green'], 'yellow'))).toBe(false)
        expect(allowed(allowance(at('5'), 'CR', [], 'brown'))).toBe(true)
        expect(allowed(allowance(at('5'), 'CR', [], 'gray'))).toBe(false)
    })
})

describe('dividends (§5.14)', () => {
    const effect = (
        state: State1822,
        companyId: string,
        choice: 'pay' | 'half-pay' | 'withhold',
        revenue: number
    ) => {
        const retained = EarningsRules1822.retainedRevenue(state, companyId, choice, revenue)
        const move = EarningsRules1822.marketEffect(state, companyId, {
            choice,
            revenue,
            retained,
            baseDividendPerShare: 0
        }).move
        return { retained, to: move ? Market1822.space(move.toMarketSpaceId).price : undefined }
    }

    it('moves a major by what it pays against its share value', () => {
        const game = prepared((state, [first]) => kit.operated(state, 'CR', first, { price: 100 }))
        const state = game.state
        expect(effect(state, 'CR', 'withhold', 300)).toEqual({ retained: 300, to: 90 })
        expect(effect(state, 'CR', 'pay', 0).to).toBe(90)
        expect(effect(state, 'CR', 'pay', 90).to).toBeUndefined()
        expect(effect(state, 'CR', 'pay', 100).to).toBe(110)
        expect(effect(state, 'CR', 'pay', 200).to).toBe(120)
        // Half is rounded up to the next £10: £150 pays £80 and keeps £70 (§5.14.1).
        expect(effect(state, 'CR', 'half-pay', 150)).toEqual({ retained: 70, to: undefined })
        expect(effect(state, 'CR', 'half-pay', 200).to).toBe(110)
    })

    it('has a minor always split its earnings and move right when it pays', () => {
        const game = prepared((state, [first]) => runMinor(state, 'M4', first, { price: 60 }))
        const state = game.state
        expect(EarningsRules1822.choices(state, 'M4')).toEqual(['pay'])
        expect(
            EarningsRules1822.holderDividend?.(state, 'M4', {
                shares: 2,
                choice: 'pay',
                revenue: 30
            })
        ).toBe(15)
        expect(effect(state, 'M4', 'pay', 30).to).toBe(70)
        expect(effect(state, 'M4', 'pay', 0).to).toBe(50)
    })
})

describe('trains (§5.5, §5.15)', () => {
    it('limits minors and majors by phase', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M4', first)
            kit.operated(state, 'CR', first)
        })
        const limits = (phaseId: string) => {
            const state = { ...game.state, phaseId }
            return [TrainRules1822.trainLimit(state, 'M4'), TrainRules1822.trainLimit(state, 'CR')]
        }
        expect(limits('1')).toEqual([2, 4])
        expect(limits('3')).toEqual([2, 4])
        expect(limits('4')).toEqual([1, 3])
        expect(limits('5')).toEqual([1, 2])
    })

    it('sells the next new train, either side of its card, and flips an L to a 2 for £80', () => {
        const game = prepared((state, [first]) => runMinor(state, 'M4', first))
        const state = game.state
        expect(TrainRules1822.availableDefinitions(state)).toEqual(['L', '2'])
        expect(TrainRules1822.availableDefinitions({ ...state, phaseId: '3' })).toEqual(['2'])
        const train = { id: 'x', definitionId: 'L', status: 'owned' as const, owner: company('M4') }
        expect(TrainRules1822.exchangePrice(state, 'M4', '2', train)).toBe(80)
        expect(
            TrainRules1822.exchangePrice({ ...state, phaseId: '3' }, 'M4', '2', train)
        ).toBeUndefined()
    })

    it('has a director borrow what their cash and shares cannot raise, at half as much again (§5.17.2)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '4'
            kit.operated(state, 'CR', first, { price: 100, shares: 2, cash: 140 })
            setCash(state, player(first), 20)
            // The 3-trains are gone, so a 4-train at £300 is the cheapest in the bank.
            state.trainInventory.trains = state.trainInventory.trains.filter(
                (train) => !['L', '3'].includes(train.definitionId)
            )
        })
        const state = game.hydrated
        const [first] = state.turnManager.turnOrder
        state.trainPurchaseStep = { companyId: 'CR', purchasedTrainIds: [] }
        const funding = new EmergencyTrainFunding(
            state,
            TrainFundingRules1822,
            StockRules1822,
            TrainRules1822
        )
        const [purchase] = funding.purchases()
        expect(purchase).toMatchObject({ definitionId: '4', price: 300 })
        state.trainFunding = funding.begin(purchase)
        state.activePlayerIds = [first]
        const next = funding.next()
        // £140 in the treasury and £20 in hand leave £140 to borrow, the director's 20% being the
        // director's certificate, which is not sold.
        expect(next).toMatchObject({ kind: 'contribute', amount: 160, borrowed: 140 })
        TrainFundingRules1822.recordLoan?.(state, player(first), 140)
        expect(playerLoan1822(state, first)).toBe(210)
    })
})

describe('issuing and redeeming (§5.20)', () => {
    it('pays an issue at the value the shares come to rest at (§5.20.2)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            kit.operated(state, 'CR', first, { price: 100, shares: 4, cash: 500 })
            state.machineState = 'BuyingTrains'
            state.operatingSet = {
                number: 1,
                roundNumber: 1,
                roundCount: 2,
                companyOrder: ['CR'],
                completedCompanyIds: [],
                privateIncomePaid: true,
                completed: false
            }
        })
        const choices = corporateFinanceChoices(game.hydrated, CorporateFinanceRules1822)
        expect(
            choices.find((choice) => choice.operation === 'issue' && choice.shares === 3)
        ).toMatchObject({
            amount: 210
        })
        // No more than half the company may be in the bank pool (§5.20.1).
        expect(
            Math.max(
                ...choices
                    .filter((choice) => choice.operation === 'issue')
                    .map((choice) => choice.shares)
            )
        ).toBe(5)
    })
})

describe('income (§3.1, §3.2.4)', () => {
    it('pays a concession £10 and P15 £10 for each phase number', () => {
        const game = prepared((state, [first]) => {
            giveCharter(state, concessionId('GWR'), player(first))
            giveCharter(state, 'P15', player(first))
        })
        expect(privateIncome1822(game.state, concessionId('GWR'))).toBe(10)
        expect(privateIncome1822(game.state, 'P15')).toBe(10)
        expect(privateIncome1822({ ...game.state, phaseId: '4' }, 'P15')).toBe(40)
    })
})

describe('the end of the game (§1.3)', () => {
    it('ends after the operating round in which a share value reaches the game end value', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M4', first)
            placeStockMarker(state.stockMarket, 'M4', EndGameSpaceId1822)
            state.operatingSet = {
                number: 4,
                roundNumber: 1,
                roundCount: 2,
                companyOrder: ['M4'],
                completedCompanyIds: [],
                privateIncomePaid: true,
                completed: false
            }
        })
        expect(EndingRules1822.trigger(game.hydrated)).toMatchObject({
            finalOperatingSet: 4,
            finalOperatingRound: 1
        })
    })

    it('ends after the first operating round following a stock round in which the bank broke', () => {
        const game = prepared((state) => {
            state.bank = { broken: true }
        })
        expect(EndingRules1822.trigger(game.hydrated)).toMatchObject({
            reason: 'Bank broken',
            finalOperatingSet: 1,
            finalOperatingRound: 1
        })
    })

    it('counts stock at its value, concessions at £100, privates at nothing and loans against (§1.3.2)', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M4', first, { price: 80 })
            giveCharter(state, concessionId('GWR'), player(first))
            giveCharter(state, 'P2', player(first))
            state.playerLoans = [{ playerId: first, amount: 60 }]
        })
        const [first] = game.state.turnManager.turnOrder
        const wealth = finalWealth(game.hydrated, EndingRules1822).find(
            (entry) => entry.playerId === first
        )
        expect(wealth?.total).toBe(525 + 160 + 100 - 60)
    })
})

describe('routes (§5.4, §5.5)', () => {
    function running(game: Table, companyId: string) {
        const state = game.hydrated
        state.routeStep = { companyId }
        return { state, evaluation: new RouteEvaluation(state, RouteRules1822) }
    }

    it('runs the Swansea and Mumbles’ L train for £30 on its printed track, and £20 once the hex is tiled (§5.8.4)', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M24', first)
            kit.giveTrain(state, 'M24', 'L')
        })
        const { state, evaluation } = running(game, 'M24')
        const [train] = state.trainInventory.trains.filter((entry) => entry.status === 'owned')
        const face = RouteRules1822.map.location('D35').preprintedTile
        const printed = evaluation.evaluate('M24', [
            {
                trainId: train.id,
                start: { locationId: 'D35', nodeId: 'city' },
                paths: [{ locationId: 'D35', pathId: face.paths[0].id }]
            }
        ])
        expect(printed.result?.revenue).toBe(30)
        const tiled = prepared((next, [first]) => {
            runMinor(next, 'M24', first)
            kit.giveTrain(next, 'M24', 'L')
            layTiles(next, [{ locationId: 'D35', definitionId: '18xx:57', rotation: 0 }])
        })
        const alone = running(tiled, 'M24')
        const [local] = alone.state.trainInventory.trains.filter(
            (entry) => entry.status === 'owned'
        )
        expect(
            alone.evaluation.evaluate('M24', [
                { trainId: local.id, start: { locationId: 'D35', nodeId: 'city' }, paths: [] }
            ]).result?.revenue
        ).toBe(20)
    })

    it('ends a route that crosses between Merthyr Tydfil and Pontypool (§5.4.7)', () => {
        const game = prepared((state, [first]) => {
            runMinor(state, 'M21', first)
            kit.giveTrain(state, 'M21', '2')
        })
        const { state, evaluation } = running(game, 'M21')
        const [train] = state.trainInventory.trains.filter((entry) => entry.status === 'owned')
        const route = kit.route(state, train.id, { locationId: 'E34', nodeId: 'city' }, [
            'E32',
            'F33'
        ])
        const result = evaluation.evaluate('M21', [route]).result
        // Phase 1 values: Merthyr Tydfil £30 and Pontypool £20 (§5.4.5).
        expect(result?.revenue).toBe(50)
        expect(evaluation.network.extensions(route.start, route.paths)).toEqual([])
    })

    it('has an E train stop only at its company’s stations, doubled (§5.5.8)', () => {
        const game = prepared((state, [first]) => kit.operated(state, 'CR', first))
        const state = game.hydrated
        const electric = RouteRules1822.depot.trainDefinition('E')
        const three = RouteRules1822.depot.trainDefinition('3')
        const home = { locationId: 'E6', nodeId: 'city' }
        const other = { locationId: 'H5', nodeId: 'city' }
        expect(RouteRules1822.stopsAt?.(state, 'CR', home, electric)).toBe(true)
        expect(RouteRules1822.stopsAt?.(state, 'CR', other, electric)).toBe(false)
        expect(RouteRules1822.stopsAt?.(state, 'CR', other, three)).toBe(true)
        expect(RouteRules1822.stopRevenue?.(state, 'CR', home, 40, electric)).toBe(80)
        expect(RouteRules1822.stopRevenue?.(state, 'CR', home, 40, three)).toBe(40)
    })

    it('lets a Pullman make a train count large stations only, though never an E train (§5.5.6)', () => {
        const game = prepared(() => undefined)
        const state = game.hydrated
        const pullman = RouteRules1822.depot.trainDefinition('P+')
        const three = RouteRules1822.attachedDefinition?.(
            state,
            RouteRules1822.depot.trainDefinition('3'),
            [pullman]
        )
        expect(three).toMatchObject({
            name: '3+',
            distance: { measure: 'cities-and-offboards', maximum: 3 }
        })
        expect(
            typeof RouteRules1822.attachedDefinition?.(
                state,
                RouteRules1822.depot.trainDefinition('E'),
                [pullman]
            )
        ).toBe('string')
    })
})
