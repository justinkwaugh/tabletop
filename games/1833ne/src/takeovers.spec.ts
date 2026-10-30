import { describe, expect, it } from 'vitest'
import {
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    sharesOwned,
    trainsOwnedBy
} from '@tabletop/18xx'
import { rulebookTakeoverExample, setCash, takeoverExample } from '../test/takeover.js'
import { Market1833NE, StockRules1833NE } from './stock.js'
import { fewestSwaps, offerReason, takeoverTargets, unissuedShareIds } from './takeoverRules.js'
import { TrainDepot1833NE, TrainRules1833NE, trainLimit } from './trains.js'
import { CompanyRules1833NE, variableStartHomes } from './variableStart.js'
import { holdsRightsOf } from './takeoverState.js'
import { JointTokenSource } from './track.js'
import { table, type Table } from '../test/table.js'

const price = (game: Table, companyId: string) =>
    Market1833NE.companySpace(game.state.stockMarket, companyId).price
const cash = (game: Table, companyId: string) =>
    finiteCashOwnedBy(game.state, { kind: 'company', companyId })
const player = (playerId: string) => ({ kind: 'player' as const, playerId })
const trainIds = (game: Table, companyId: string) =>
    trainsOwnedBy(game.state, { kind: 'company', companyId }).map((train) => train.id)

describe('the takeover step (§11)', () => {
    it('follows the second operating round from phase II, in stock price order', () => {
        const { game, president } = takeoverExample()
        expect(game.state.machineState).toBe('TakingOver')
        expect(game.state.takeoverStep?.companyIds[0]).toBe('B&W')
        expect(game.state.activePlayerIds).toEqual([president])
        expect(game.valid()).toEqual(expect.arrayContaining(['OfferTakeover', 'PassTakeover']))
        expect(takeoverTargets(game.state, 'B&W')).toEqual(['HR'])
    })

    it('plays the rulebook’s takeover example (p. 15)', () => {
        const { game, president } = rulebookTakeoverExample()
        expect(game.state.machineState).toBe('TakingOver')
        // Before the takeover step, as the example gives them.
        expect(price(game, 'B&W')).toBe(80)
        expect(price(game, 'HR')).toBe(30)
        expect(cash(game, 'B&W')).toBe(40)
        expect(cash(game, 'HR')).toBe(19)
        expect(finiteCashOwnedBy(game.state, player(president))).toBe(126)
        game.act('OfferTakeover', {
            companyId: 'B&W',
            targetId: 'HR',
            swaps: [{ holder: player(president), shares: 2 }]
        })
        const state = game.state
        expect(getCompany(state, 'HR').closed).toBe(true)
        expect(sharesOwned(state, 'B&W', player(president))).toBe(6)
        expect(finiteCashOwnedBy(state, player(president))).toBe(126)
        // The example gives the B&W 4 unissued shares and $69 afterwards, but by its own
        // figures it had 4 and $40, swapped 2 and took the Hartford's $19.
        expect(unissuedShareIds(state, 'B&W')).toHaveLength(2)
        expect(cash(game, 'B&W')).toBe(59)
        expect(price(game, 'B&W')).toBe(70)
        expect(
            trainsOwnedBy(state, { kind: 'company', companyId: 'B&W' })
                .map((train) => train.definitionId)
                .toSorted()
        ).toEqual(['2', '2+1', '2+1', '3/5'])
        expect(state.ferries).toEqual([{ locationId: 'C26', companyId: 'B&W' }])
        expect(
            state.stations.some(
                (station) =>
                    station.status === 'placed' &&
                    station.companyId === 'B&W' &&
                    station.position.locationId === 'C24'
            )
        ).toBe(true)
        expect(TrainRules1833NE.trainLimit(state, 'B&W')).toBe(4)
        expect(StockRules1833NE.certificateLimit(state, player(president))).toBe(25)
        expect(TrainDepot1833NE.remaining(state.trainInventory, '6/9')).toBe(4)
        expect(state.takeoverStep).toBeUndefined()
        expect(state.machineState).toBe('StockRound')
    })

    it('moves the acquirer’s price toward a lower target’s', () => {
        const { game, president } = takeoverExample()
        expect(price(game, 'B&W')).toBe(60)
        expect(price(game, 'HR')).toBe(20)
        game.act('OfferTakeover', {
            companyId: 'B&W',
            targetId: 'HR',
            swaps: [{ holder: player(president), shares: 2 }]
        })
        expect(price(game, 'B&W')).toBe(50)
    })

    it('swaps the fewest shares that let the acquirer pay', () => {
        const { game, president } = takeoverExample()
        expect(fewestSwaps(game.state, 'B&W', 'HR')).toEqual([
            { holder: player(president), shares: 1 }
        ])
        setCash(game, 'B&W', 100)
        expect(fewestSwaps(game.state, 'B&W', 'HR')).toEqual([])
    })

    it('pays cash for the shares not swapped', () => {
        const { game, president } = takeoverExample()
        const before = finiteCashOwnedBy(game.state, player(president))
        setCash(game, 'B&W', 100)
        game.act('OfferTakeover', { companyId: 'B&W', targetId: 'HR', swaps: [] })
        expect(finiteCashOwnedBy(game.state, player(president))).toBe(before + 2 * 20)
        expect(cash(game, 'B&W')).toBe(100 - 40 + 105)
    })

    it('rejects offers the acquirer cannot pay for or that pass 60%', () => {
        const { game, president } = takeoverExample()
        setCash(game, 'B&W', 0)
        expect(offerReason(game.state, { companyId: 'B&W', targetId: 'HR', swaps: [] })).toBe(
            'The acquiring corporation cannot pay for the other shares.'
        )
        expect(
            offerReason(game.state, {
                companyId: 'B&W',
                targetId: 'HR',
                swaps: [{ holder: player(president), shares: 3 }]
            })
        ).toBe('A holder gives up only the shares it holds.')
    })

    it('lets the target’s president refuse unless it is vulnerable (§11.4)', () => {
        const { game, president, hartfordPresident } = takeoverExample({
            separatePresidents: true
        })
        expect(hartfordPresident).not.toBe(president)
        game.act('OfferTakeover', {
            companyId: 'B&W',
            targetId: 'HR',
            swaps: [{ holder: player(hartfordPresident), shares: 2 }]
        })
        expect(game.state.activePlayerIds).toEqual([hartfordPresident])
        expect(game.valid(hartfordPresident)).toContain('AnswerTakeover')
        expect(game.valid(president)).not.toContain('OfferTakeover')
        game.act('AnswerTakeover', { accept: false }, hartfordPresident)
        expect(getCompany(game.state, 'HR').closed).toBeFalsy()
        // The refusal ends the B&W's attempt; the Hartford's turn follows.
        expect(game.state.takeoverStep?.companyIds).toEqual(['HR'])
    })

    it('carries out an accepted offer', () => {
        const { game, hartfordPresident } = takeoverExample({ separatePresidents: true })
        game.act('OfferTakeover', {
            companyId: 'B&W',
            targetId: 'HR',
            swaps: [{ holder: player(hartfordPresident), shares: 2 }]
        })
        game.act('AnswerTakeover', { accept: true }, hartfordPresident)
        expect(getCompany(game.state, 'HR').closed).toBe(true)
        expect(sharesOwned(game.state, 'B&W', player(hartfordPresident))).toBe(2)
    })

    it('takes a vulnerable target without asking', () => {
        const { game } = takeoverExample({ separatePresidents: true })
        const state = structuredClone(game.state)
        for (const train of state.trainInventory.trains)
            if (
                train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.owner.companyId === 'HR'
            )
                Object.assign(train, { rustsAfterOperation: true })
        game.state = state
        setCash(game, 'B&W', 100)
        game.act('OfferTakeover', { companyId: 'B&W', targetId: 'HR', swaps: [] })
        expect(getCompany(game.state, 'HR').closed).toBe(true)
    })

    it('makes an acquirer over its new limit turn trains in', () => {
        const { game, president } = takeoverExample()
        const state = structuredClone(game.state)
        for (const definitionId of ['3/5', '3/5']) {
            const train = TrainDepot1833NE.nextTrain(state.trainInventory, definitionId)!
            TrainDepot1833NE.purchase(state.trainInventory, train.id, definitionId, {
                kind: 'company',
                companyId: 'HR'
            })
        }
        game.state = state
        setCash(game, 'B&W', 100)
        game.act('OfferTakeover', { companyId: 'B&W', targetId: 'HR', swaps: [] })
        // Five trains against a limit of 3 + 1.
        expect(game.valid()).toContain('DiscardMergedTrain')
        expect(game.valid()).not.toContain('PassTakeover')
        game.act('DiscardMergedTrain', { companyId: 'B&W', trainId: trainIds(game, 'B&W')[0] })
        expect(trainIds(game, 'B&W')).toHaveLength(4)
        expect(game.state.machineState).toBe('StockRound')
        expect(controllingOwner(game.state, 'B&W')?.playerId).toBe(president)
    })

    it('ends when every corporation passes', () => {
        const { game } = takeoverExample()
        game.act('PassTakeover', { companyId: 'B&W' })
        // The Hartford could take the B&W over by swapping its shares.
        expect(takeoverTargets(game.state, 'HR')).toEqual(['B&W'])
        game.act('PassTakeover', { companyId: 'HR' })
        expect(game.state.takeoverStep).toBeUndefined()
        expect(game.state.machineState).toBe('StockRound')
    })
})

describe('Variable Start railroads (§5.34)', () => {
    const start = (game: Table, companyId: string, parPrice: number, locationId: string) => {
        const space = Market1833NE.spaces.find((entry) => entry.price === parPrice)!
        game.act('StartCompany', {
            buyer: player(game.player),
            companyId,
            marketSpaceId: space.id,
            expectedPrice: parPrice * 2,
            home: { locationId, nodeId: 'city' }
        })
    }
    const stockRound = () => {
        const { game } = takeoverExample()
        game.act('PassTakeover', { companyId: 'B&W' })
        game.act('PassTakeover', { companyId: 'HR' })
        expect(game.state.machineState).toBe('StockRound')
        return game
    }

    it('cannot start in phase I', () => {
        const game = table(4, 7, { takeover: true })
        expect(CompanyRules1833NE.startMarketSpaces(game.state, 'B&M')).toEqual([])
        expect(CompanyRules1833NE.startMarketSpaces(game.state, 'B&W').length).toBeGreaterThan(0)
    })

    it('offers open cities, not reserved spots or homes of corporations yet to start', () => {
        const game = stockRound()
        const homes = variableStartHomes(game.hydrated, 'B&M').map((home) => home.locationId)
        expect(homes).toContain('D21')
        expect(homes).toContain('F17')
        // Worcester is the B&W's reserved spot and Rutland the RR's home.
        expect(homes).not.toContain('E22')
        expect(homes).not.toContain('C12')
        // Hartford holds a token, and Sherbrooke's spot is the joint token's (§6.53).
        expect(homes).not.toContain('C24')
        expect(homes).not.toContain('F5')
    })

    it('pays $80 for a home in a hex without track', () => {
        const game = stockRound()
        start(game, 'B&M', 50, 'D21')
        expect(cash(game, 'B&M')).toBe(100 - 80)
        expect(
            game.state.stations.some(
                (station) =>
                    station.status === 'placed' &&
                    station.companyId === 'B&M' &&
                    station.position.locationId === 'D21'
            )
        ).toBe(true)
    })

    it('pays $120 for a home on track, starting at $60 or more', () => {
        const game = stockRound()
        expect(() => start(game, 'B&M', 50, 'F17')).toThrow()
        start(game, 'B&M', 60, 'F17')
        expect(cash(game, 'B&M')).toBe(0)
    })

    it('needs a home', () => {
        const game = stockRound()
        const space = Market1833NE.spaces.find((entry) => entry.price === 50)!
        expect(() =>
            game.act('StartCompany', {
                buyer: player(game.player),
                companyId: 'B&M',
                marketSpaceId: space.id,
                expectedPrice: 100
            })
        ).toThrow()
    })
})

describe('Takeover game train limits (§6.82–6.83)', () => {
    it('are one lower from phase III and one higher per takeover', () => {
        const state = { phaseId: 'III', takeoverGame: true as const, takeovers: [] }
        expect(trainLimit(state, 'B&W')).toBe(2)
        expect(trainLimit({ ...state, phaseId: 'IV' }, 'B&W')).toBe(1)
        expect(
            trainLimit(
                {
                    ...state,
                    phaseId: 'V',
                    takeovers: [
                        { acquirerId: 'B&W', targetId: 'HR' },
                        { acquirerId: 'B&W', targetId: 'RR' },
                        { acquirerId: 'FRR', targetId: 'CV' }
                    ]
                },
                'B&W'
            )
        ).toBe(3)
        expect(trainLimit({ phaseId: 'IV' }, 'B&W')).toBe(2)
    })
})

describe('what passes to the acquirer (§11.6–11.7)', () => {
    it('keeps the joint token in place and hands over reserved spaces and discounts', () => {
        const { game, president } = takeoverExample()
        const state = structuredClone(game.state)
        const spare = state.stations.find(
            (station) => station.companyId === 'HR' && station.status === 'available'
        )!
        state.stations[state.stations.indexOf(spare)] = {
            id: spare.id,
            companyId: 'HR',
            status: 'placed',
            position: { locationId: 'F5', nodeId: 'city', slot: 0 }
        }
        state.stationAccess = [
            { companyId: 'A&StL', locationId: 'F5', nodeId: 'city', sourceId: JointTokenSource }
        ]
        state.stationReservations.push({ companyId: 'HR', locationId: 'E26', nodeId: 'city' })
        game.state = state
        setCash(game, 'B&W', 100)
        game.act('OfferTakeover', {
            companyId: 'B&W',
            targetId: 'HR',
            swaps: [{ holder: player(president), shares: 2 }]
        })
        const joint = game.state.stations.find((station) => station.id === spare.id)
        expect(joint).toMatchObject({ companyId: 'B&W', status: 'placed' })
        expect(game.state.stationAccess).toEqual([
            { companyId: 'A&StL', locationId: 'F5', nodeId: 'city', sourceId: JointTokenSource }
        ])
        expect(game.state.stationReservations).toContainEqual({
            companyId: 'B&W',
            locationId: 'E26',
            nodeId: 'city'
        })
        expect(holdsRightsOf(game.state, 'B&W', 'HR')).toBe(true)
    })
})
