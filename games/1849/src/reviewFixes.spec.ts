import { describe, expect, it } from 'vitest'
import { corporateFinanceChoices, finalWealth, treasuryPoolId } from '@tabletop/18xx'
import { Random, botMove } from '../test/bot.js'
import { kit, type Table } from '../test/kit.js'
import { CorporateFinanceRules1849, EndingRules1849, RequiresTrain1849 } from './operating.js'
import { MarittimaTurnMark, StationRules1849 } from './stations.js'
import { nextCorporation1849 } from './stock.js'

/** A four-player table in its first stock round, the privates sold. */
function stockRound(): Table {
    const game = kit.table(4, 11)
    kit.buyAllPrivates(game)
    return game
}

describe('issuing in the first operating round (§10.8)', () => {
    it('numbers each operating set after the stock round before it', () => {
        const game = kit.table(4, 3)
        const random = new Random(3)
        while (game.state.machineState !== 'LayingTrack') {
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        expect(game.state.operatingSet?.number).toBe(game.state.stockRound.number)
        for (const entry of game.state.floats)
            expect(entry.stockRound).toBe(game.state.stockRound.number)
        expect(game.state.floats.length).toBeGreaterThan(0)
    })

    it('offers no issue in the round after the corporation floats, and does later', () => {
        const game = stockRound()
        const companyId = nextCorporation1849(game.hydrated)
        if (!companyId) throw new Error('No corporation to start')
        game.act('StartCompany', {
            buyer: { kind: 'player', playerId: game.player },
            companyId,
            marketSpaceId: '3:5',
            expectedPrice: 200
        })
        const state = game.hydrated
        expect(state.floats).toContainEqual({ companyId, stockRound: state.stockRound.number })
        state.machineState = 'BuyingTrains'
        state.trainInventory.trains = state.trainInventory.trains.map((train, index) =>
            index === 0
                ? { ...train, status: 'owned', owner: { kind: 'company', companyId } }
                : train
        )
        const set = (number: number, roundNumber: number) => {
            state.operatingSet = {
                number,
                roundNumber,
                roundCount: 2,
                companyOrder: [companyId],
                completedCompanyIds: [],
                privateIncomePaid: true,
                completed: false
            }
        }
        const issues = () =>
            corporateFinanceChoices(state, CorporateFinanceRules1849).filter(
                (choice) => choice.operation === 'issue'
            )
        set(state.stockRound.number, 1)
        expect(issues()).toEqual([])
        set(state.stockRound.number, 2)
        expect(issues().length).toBeGreaterThan(0)
        expect(
            state.certificates.some(
                (certificate) => certificate.poolId === treasuryPoolId(companyId)
            )
        ).toBe(true)
    })
})

describe('the train a corporation must own (§10.5.1, §10.6)', () => {
    it('is not needed for a run from its home to a port alone', () => {
        const game = stockRound()
        const state = game.hydrated
        const companyId = state.corporationOrder[0]
        // A station in Palermo, whose printed track reaches only its port.
        state.stations = state.stations.map((station) =>
            station.companyId === companyId && station.id.endsWith(':home')
                ? {
                      id: station.id,
                      companyId,
                      status: 'placed',
                      position: { locationId: 'C5', nodeId: 'city', slot: 0 }
                  }
                : station.companyId === companyId
                  ? station
                  : { id: station.id, companyId: station.companyId, status: 'available' }
        )
        expect(RequiresTrain1849(state, companyId)).toBe(false)
    })
})

describe('the SMS (§7.1)', () => {
    it('takes the turn’s token step, its own station or none', () => {
        const game = stockRound()
        const state = game.hydrated
        const companyId = state.corporationOrder[0]
        state.operatingSet = {
            number: 2,
            roundNumber: 1,
            roundCount: 1,
            companyOrder: [companyId],
            completedCompanyIds: [],
            privateIncomePaid: true,
            completed: false
        }
        expect(StationRules1849.placementLimit(state, companyId)).toBe(1)
        state.turnMarks = [MarittimaTurnMark]
        expect(StationRules1849.placementLimit(state, companyId)).toBe(0)
        // The mark ends with the turn.
        delete state.turnMarks
        expect(StationRules1849.placementLimit(state, companyId)).toBe(1)
    })
})

describe('final wealth (§13)', () => {
    it('counts money and corporation stock, not privates', () => {
        const game = stockRound()
        const wealth = finalWealth(game.hydrated, EndingRules1849)
        for (const player of wealth)
            for (const item of player.items)
                if (item.assetId.endsWith(':charter')) expect(item.value).toBe(0)
    })
})
