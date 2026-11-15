import { getCompany, nextOperatingCompany } from '@tabletop/18xx'
import { describe, expect, it } from 'vitest'
import { botMove, playOut, Random } from '../test/bot.js'
import { edit, kit, setCash, type Table } from '../test/kit.js'
import { RsrId, isMinor1861 } from './companies.js'
import { TrainDepot1861 } from './trains.js'

/** Plays the seeded table to the first time a minor buys trains with a public company after it. */
function minorBuyingBeforeMajor(seed: number): { game: Table; minorId: string } {
    const game = kit.table(4, seed)
    const random = new Random(seed)
    for (let moves = 0; moves < 1000; moves++) {
        const state = game.state
        const minorId = state.trainPurchaseStep?.companyId
        const set = state.operatingSet
        if (state.machineState === 'BuyingTrains' && minorId && isMinor1861(minorId) && set) {
            const pending = set.companyOrder.filter((id) => !set.completedCompanyIds.includes(id))
            if (pending.some((id) => !isMinor1861(id) && id !== RsrId)) return { game, minorId }
        }
        const move = botMove(game, random)
        game.act(move.type, move.fields, move.playerId)
    }
    throw new Error('No minor bought trains before a public company')
}

/** Leaves the 8-train the only one the minor can buy, in phase 7 with the RSR operating. */
function onlyTheEightTrainLeft(game: Table, minorId: string): void {
    edit(game, (state) => {
        state.trainInventory.trains = state.trainInventory.trains
            .filter(
                (train) =>
                    !(
                        train.status === 'depot' &&
                        ['2', '3', '4', '5', '6', '7'].includes(train.definitionId)
                    )
            )
            .map((train) =>
                train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.owner.companyId === minorId
                    ? { id: train.id, definitionId: train.definitionId, status: 'market' }
                    : train
            )
        setCash(state, minorId, 2000)
        state.phaseId = '7'
        const rsr = state.companies.find((company) => company.id === RsrId)
        if (rsr) Object.assign(rsr, { started: true, floated: true, funded: true })
    })
}

describe('1861 phase effects', () => {
    it('nationalises a minor buying the first 8-train in its own turn, and play goes on (§11)', () => {
        const { game, minorId } = minorBuyingBeforeMajor(6)
        onlyTheEightTrainLeft(game, minorId)
        const set = game.state.operatingSet
        if (!set) throw new Error('The minor buys in an operating round')
        const nextMajor = set.companyOrder.find(
            (id) => !set.completedCompanyIds.includes(id) && !isMinor1861(id) && id !== RsrId
        )
        const eight = TrainDepot1861.nextTrain(game.state.trainInventory, '8')
        if (!eight) throw new Error('The 8-train is in the depot')
        const price = TrainDepot1861.trainDefinition('8').price

        game.act('BuyTrain', {
            companyId: minorId,
            trainId: eight.id,
            definitionId: '8',
            expectedPrice: price
        })

        expect(game.state.phaseId).toBe('8')
        expect(getCompany(game.state, minorId).closed).toBe(true)
        expect(
            game.state.companies.filter(
                (company) => isMinor1861(company.id) && company.started && !company.closed
            )
        ).toEqual([])
        expect(nextOperatingCompany(game.state)).toBe(nextMajor)
        expect(game.state.trainPurchaseStep).toBeUndefined()
        expect(playOut(game, 6)).toBeGreaterThan(0)
        expect(game.state.machineState).toBe('GameOver')
    }, 120_000)
})
