import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { cashOwnedBy, getCompany, sharesOwned } from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoTileSet,
    mergerDecision,
    EighteenThirtyTwoStationRules,
    mergedTrainDiscards,
    mergerOptions,
    takeoverPayments,
    takeoverSales,
    type EighteenThirtyTwoState
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

type Play = ExamplePlay<EighteenThirtyTwoState>
const player = (playerId: string) => ({ kind: 'player' as const, playerId })

// Charleston and Savannah, ACL's and CG's homes, joined by two straight cities.
const JoiningTrack = [
    { locationId: 'T29', definitionId: '18xx:57', rotation: 0 },
    { locationId: 'U28', definitionId: '18xx:57', rotation: 0 }
] as const

function setCash(state: EighteenThirtyTwoState, playerId: string, amount: number) {
    const cash = state.cash.find(
        (entry) => entry.owner.kind === 'player' && entry.owner.playerId === playerId
    )
    assertExists(cash, 'The player has cash')
    cash.amount = amount
}

/** A phase 4 stock round whose players all pass, opening the merger phase. */
function mergerPhase(prepare: (state: EighteenThirtyTwoState) => void = () => {}): Play {
    const play = playExample(EighteenThirtyTwoScenarios, 'trading', 3, (state) => {
        state.phaseId = '4'
        state.tileInventory = EighteenThirtyTwoTileSet.createInventory(JoiningTrack)
        prepare(state)
    })
    for (let turn = 0; turn < 3; turn++) play.act('FinishStockTurn')
    return play
}

const takeover = { companyId: 'ACL', partnerId: 'CG', kind: 'takeover', yielded: false } as const

function proposer(play: Play) {
    const decision = mergerDecision(play.state)
    assertExists(decision, 'A merger decision is open')
    expect(decision.kind).toBe('propose')
    return decision.playerId
}

describe('merger phase', () => {
    it('opens after a phase 4 stock round with the players in priority order', () => {
        const play = mergerPhase()
        expect(play.state.machineState).toBe('Merging')
        const playerId = proposer(play)
        expect(play.valid(playerId)).toEqual(['ProposeMerger', 'PassMerger'])
    })

    it('does not open before the first 4-train', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'trading', 3, (state) => {
            state.tileInventory = EighteenThirtyTwoTileSet.createInventory(JoiningTrack)
        })
        for (let turn = 0; turn < 3; turn++) play.act('FinishStockTurn')
        expect(play.state.machineState).not.toBe('Merging')
        expect(play.state.mergerPhase).toBeUndefined()
    })

    it('forms a System once the partner’s president agrees', () => {
        const play = mergerPhase()
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        expect(mergerOptions(play.state, 'alex')).toContainEqual({
            companyId: 'ACL',
            partnerId: 'CG',
            kind: 'system',
            yielded: false
        })
        play.act(
            'ProposeMerger',
            { companyId: 'ACL', partnerId: 'CG', kind: 'system', yielded: false },
            'alex'
        )
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(play.valid('blair')).toEqual(['AnswerMerger'])
        play.act('AnswerMerger', { accept: true }, 'blair')
        expect(play.state.systems).toEqual({ AMTK: ['ACL', 'CG'] })
        expect(getCompany(play.state, 'AMTK').president).toEqual(player('alex'))
        // Nothing remains to merge, so the phase ends and the operating set begins.
        expect(play.state.mergerPhase).toBeUndefined()
        expect(play.state.mergedAfterStockRound).toBe(play.state.stockRound.number)
        expect(play.state.operatingSet?.companyOrder).toContain('AMTK')
    })

    it('does not offer a refused pairing again that phase', () => {
        const play = mergerPhase()
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        play.act(
            'ProposeMerger',
            { companyId: 'ACL', partnerId: 'CG', kind: 'takeover', yielded: false },
            'alex'
        )
        play.act('AnswerMerger', { accept: false }, 'blair')
        expect(play.state.mergerPhase?.refused).toEqual([
            { companyId: 'ACL', partnerId: 'CG', kind: 'takeover', yielded: false }
        ])
        const options = mergerOptions(play.state, 'alex')
        expect(options).not.toContainEqual({
            companyId: 'ACL',
            partnerId: 'CG',
            kind: 'takeover',
            yielded: false
        })
        expect(options).toContainEqual({
            companyId: 'ACL',
            partnerId: 'CG',
            kind: 'system',
            yielded: false
        })
    })

    it('lets the buyer take over the partner, paying its holders', () => {
        const play = mergerPhase()
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        expect(
            takeoverPayments(play.state, 'ACL', 'CG').reduce(
                (sum, payment) => sum + payment.amount,
                0
            )
        ).toBe(1000)
        play.act(
            'ProposeMerger',
            { companyId: 'ACL', partnerId: 'CG', kind: 'takeover', yielded: false },
            'alex'
        )
        play.act('AnswerMerger', { accept: true }, 'blair')
        expect(getCompany(play.state, 'CG').closed).toBe(true)
        expect(play.state.mergers).toEqual([
            { kind: 'takeover', companyIds: ['ACL', 'CG'], survivorId: 'ACL' }
        ])
        // ACL paid $1000 from its $600 and Alex's $400 and took CG's $600 treasury and the
        // coal fields private, whose $15 it collects as the operating set begins.
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'ACL' })).toBe(615)
        expect(cashOwnedBy(play.state, player('alex'))).toBe(600 - 400 + 300)
        expect(cashOwnedBy(play.state, player('blair'))).toBe(450 + 300)
        expect(sharesOwned(play.state, 'CG', player('blair'))).toBe(0)
        expect(
            play.state.stations.filter(
                (station) => station.companyId === 'ACL' && station.status === 'placed'
            )
        ).toHaveLength(2)
    })

    it('has the buyer’s president sell shares to raise a takeover’s price', () => {
        // ACL's $600, Alex's $50 and the $300 for Alex's own CG shares leave $50 to raise.
        const play = mergerPhase((state) => setCash(state, 'alex', 50))
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        play.act('ProposeMerger', takeover, 'alex')
        play.act('AnswerMerger', { accept: true }, 'blair')
        expect(play.state.mergerPhase?.funding).toEqual({
            buyerId: 'ACL',
            targetId: 'CG',
            playerId: 'alex'
        })
        expect(play.valid('alex')).toEqual(['SellTakeoverShares'])
        const sales = takeoverSales(play.state, {
            buyerId: 'ACL',
            targetId: 'CG',
            playerId: 'alex'
        })
        // One share covers the shortfall, and a second would change ACL's presidency.
        expect(sales.map((sale) => [sale.sales[0].companyId, sale.sales[0].shares])).toEqual([
            ['ACL', 1]
        ])
        play.act('SellTakeoverShares', { companyId: 'ACL', shares: 1 }, 'alex')
        expect(getCompany(play.state, 'CG').closed).toBe(true)
        expect(getCompany(play.state, 'ACL').president).toEqual(player('alex'))
        expect(play.state.mergerPhase).toBeUndefined()
    })

    it('lets the proposer yield, so the partner’s company buys', () => {
        const play = mergerPhase()
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        play.act('ProposeMerger', { ...takeover, yielded: true }, 'alex')
        play.act('AnswerMerger', { accept: true }, 'blair')
        expect(getCompany(play.state, 'ACL').closed).toBe(true)
        expect(play.state.mergers).toEqual([
            { kind: 'takeover', companyIds: ['CG', 'ACL'], survivorId: 'CG' }
        ])
    })

    it('returns a second WVCF token after a takeover', () => {
        const play = mergerPhase((state) => {
            state.coalRights = ['ACL', 'CG']
        })
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        play.act('ProposeMerger', takeover, 'alex')
        play.act('AnswerMerger', { accept: true }, 'blair')
        expect(play.state.coalRights).toEqual(['ACL'])
    })

    it('has a buyer over its train limit discard to the open market', () => {
        const play = mergerPhase((state) => {
            for (const [companyId, count] of [
                ['ACL', 2],
                ['CG', 2]
            ] as const)
                for (let n = 0; n < count; n++) {
                    const index = state.trainInventory.trains.findIndex(
                        (train) => train.status === 'depot' && train.definitionId === '2'
                    )
                    const train = state.trainInventory.trains[index]
                    state.trainInventory.trains[index] = {
                        id: train.id,
                        definitionId: train.definitionId,
                        status: 'owned',
                        owner: { kind: 'company', companyId }
                    }
                }
        })
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        play.act('ProposeMerger', takeover, 'alex')
        play.act('AnswerMerger', { accept: true }, 'blair')
        const discards = mergedTrainDiscards(play.state, 'alex')
        assertExists(discards, 'ACL must discard')
        expect(discards).toMatchObject({ companyId: 'ACL', excess: 1 })
        play.act('DiscardMergedTrain', { companyId: 'ACL', trainId: discards.trains[0].id }, 'alex')
        expect(
            play.state.trainInventory.trains.find((train) => train.id === discards.trains[0].id)
        ).toMatchObject({ status: 'market' })
        expect(mergedTrainDiscards(play.state, 'alex')).toBeUndefined()
    })

    it('prices a buyer’s own charter stations as printed after a takeover', () => {
        const play = mergerPhase()
        while (proposer(play) !== 'alex') play.act('PassMerger', {}, proposer(play))
        play.act('ProposeMerger', takeover, 'alex')
        play.act('AnswerMerger', { accept: true }, 'blair')
        const own = play.state.stations.find((station) => station.id === 'ACL:station:1')
        expect(own?.status).toBe('available')
        expect(EighteenThirtyTwoStationRules.placementCost(play.state, 'ACL:station:1')).toBe(40)
    })

    it('opens after a phase 5 stock round too', () => {
        const play = mergerPhase((state) => {
            state.phaseId = '5'
        })
        expect(play.state.machineState).toBe('Merging')
    })

    it('holds a last phase after the first 6-train for companies with one president', () => {
        const play = mergerPhase((state) => {
            state.phaseId = '6'
            // Alex presides over both: he holds CG's president's certificate, Blair his share.
            for (const certificate of state.certificates) {
                if (certificate.companyId !== 'CG') continue
                if (certificate.id === 'CG:president') certificate.owner = player('alex')
                else if (certificate.id === 'CG:share:2') certificate.owner = player('blair')
            }
            const company = state.companies.find((entry) => entry.id === 'CG')
            assertExists(company, 'CG is in play')
            company.president = player('alex')
        })
        expect(play.state.machineState).toBe('Merging')
        expect(play.state.mergerPhase?.final).toBe(true)
        expect(mergerOptions(play.state, 'alex').map((option) => option.yielded)).not.toContain(
            true
        )
        play.act(
            'ProposeMerger',
            { companyId: 'ACL', partnerId: 'CG', kind: 'system', yielded: false },
            'alex'
        )
        expect(play.state.mergersEnded).toBe(true)
        expect(play.state.mergerPhase).toBeUndefined()
        // Neither component had operated this round, so the System operates first.
        expect(play.state.operatingSet?.companyOrder.at(-1)).toBe('AMTK')
        expect(play.state.machineState).toBe('LayingTrack')
    })

    it('ends mergers when the last phase has nothing to merge', () => {
        const play = mergerPhase((state) => {
            state.phaseId = '6'
        })
        expect(play.state.mergersEnded).toBe(true)
        expect(play.state.machineState).not.toBe('Merging')
    })
})
