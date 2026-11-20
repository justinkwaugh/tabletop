import { describe, expect, it } from 'vitest'
import {
    finiteCashOwnedBy,
    getCompany,
    hasTurnMark,
    privateOwner,
    trainsOwnedBy
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { botMove, Random, type BotSteering } from '../test/bot.js'
import { edit, kit, type Table } from '../test/kit.js'
import { P0Id, P7Id } from './companies.js'
import { forcedRocketCompanies, rocketCompany } from './privatePowers.js'
import { BoughtTrainMark, RemovedTrainsMark, trainOnSale } from './trainRules.js'
import { TrainDepot1880 } from './trains.js'

/** The first seeded bot game, from the seed given, to reach the position. */
function reach(
    players: number,
    seed: number,
    done: (game: Table) => boolean,
    steering: BotSteering = {}
): Table {
    for (let tried = seed; tried < seed + 40; tried++) {
        const game = kit.table(players, tried)
        const random = new Random(tried)
        for (let count = 0; count < 6000 && !done(game); count++) {
            if (game.state.machineState === 'GameOver') break
            const next = botMove(game, random, steering)
            game.act(next.type, next.fields, next.playerId)
        }
        if (done(game)) return game
    }
    throw new Error('The position never came')
}

const remaining = (game: Table, definitionId: string) =>
    TrainDepot1880.remaining(game.state.trainInventory, definitionId)

/** The train-marker company about to finish a whole round with none of the 4-trains bought. */
function fourTrainsDue(game: Table): boolean {
    const state = game.hydrated
    return (
        state.machineState === 'BuyingTrains' &&
        trainOnSale(state) === '4' &&
        remaining(game, '4') === 5 &&
        !getCompany(state, P7Id).closed &&
        state.trainPurchaseStep?.companyId === state.trainMarker &&
        !hasTurnMark(state, BoughtTrainMark) &&
        !hasTurnMark(state, RemovedTrainsMark) &&
        (game.valid().includes('FinishTrains') || game.valid().includes('FinishOperatingTurn'))
    )
}

describe('the 4-trains leaving unbought with the Rocket of China open (§VI; R53)', () => {
    it('keep one 4-train for the Rocket, the others leaving and phase B3 beginning', () => {
        // 4-player bot games holding the Rocket, from seed 8, reach the position.
        const game = reach(4, 8, fourTrainsDue, { keepsRocket: true })
        const companyId = game.state.trainMarker
        assertExists(companyId, 'A company holds the train marker')
        const fourPlusFours = remaining(game, '4+4')
        game.act(game.valid().includes('FinishTrains') ? 'FinishTrains' : 'FinishOperatingTurn', {
            companyId
        })
        expect(game.state.phaseId).toBe('B3')
        expect(game.state.machineState).toBe('ExchangingRocket')
        expect(remaining(game, '4')).toBe(1)
        const exchanger = game.state.rocketExchanger
        assertExists(exchanger, 'The Rocket’s owner exchanges it')
        const { companyIds, makesRoom } = forcedRocketCompanies(game.hydrated)
        const [target] = companyIds
        const [discard] = trainsOwnedBy(game.hydrated, { kind: 'company', companyId: target })
        game.act(
            'ExchangeRocket',
            { companyId: target, ...(makesRoom ? { discardTrainId: discard.id } : {}) },
            exchanger
        )
        expect(
            trainsOwnedBy(game.hydrated, { kind: 'company', companyId: target }).map(
                (train) => train.definitionId
            )
        ).toContain('4')
        expect(remaining(game, '4')).toBe(0)
        expect(remaining(game, '4+4')).toBe(fourPlusFours)
        expect(game.state.phaseId).toBe('B3')
        expect(getCompany(game.state, P7Id).closed).toBe(true)
        // One share round, from the removal, before the company buys on.
        expect(game.state.stockRoundInterruption?.companyId).toBe(companyId)
    }, 300_000)
})

describe('the Rocket of China taking the last 3+3-train (§VI)', () => {
    it('pays P0 its last ¥100, as the last 3+3-train bought would', () => {
        // 4-player bot games holding the Rocket, from seed 1, reach an owner who may exchange it
        // in their company's turn with P0 still open; the position is then set to the last 3+3
        // on sale.
        const game = reach(
            4,
            1,
            (table) => {
                const state = table.hydrated
                const owner = privateOwner(state, P7Id)
                const companyId =
                    owner?.kind === 'player' ? rocketCompany(state, owner.playerId) : undefined
                return (
                    !!companyId &&
                    !getCompany(state, P0Id).closed &&
                    trainsOwnedBy(state, { kind: 'company', companyId }).length < 3
                )
            },
            { keepsRocket: true }
        )
        edit(game, (state) => {
            let threePlusThrees = 0
            state.trainInventory.trains = state.trainInventory.trains.filter((train) => {
                if (train.status !== 'depot') return true
                if (train.definitionId === '2' || train.definitionId === '2+2') return false
                if (train.definitionId === '3') return false
                if (train.definitionId !== '3+3') return true
                threePlusThrees++
                return threePlusThrees === 1
            })
            state.phaseId = 'B2'
        })
        expect(trainOnSale(game.hydrated)).toBe('3+3')
        expect(remaining(game, '3+3')).toBe(1)
        const owner = privateOwner(game.hydrated, P7Id)
        assertExists(owner, 'The Rocket has its owner')
        const rocketOwner = owner.kind === 'player' ? owner.playerId : ''
        const companyId = rocketCompany(game.hydrated, rocketOwner)
        assertExists(companyId, 'The Rocket may be exchanged now')
        const p0Owner = privateOwner(game.hydrated, P0Id)
        assertExists(p0Owner, 'P0 has its owner')
        const before = finiteCashOwnedBy(game.hydrated, p0Owner)
        game.act('ExchangeRocket', { companyId }, rocketOwner)
        expect(remaining(game, '3+3')).toBe(0)
        expect(getCompany(game.state, P0Id).closed).toBe(true)
        expect(finiteCashOwnedBy(game.hydrated, p0Owner)).toBe(before + 100)
        // The last of a kind brings a share round, the company resuming where it was.
        expect(game.state.stockRoundInterruption?.companyId).toBe(companyId)
    }, 300_000)
})
