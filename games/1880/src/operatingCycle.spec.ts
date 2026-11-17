import { beforeAll, describe, expect, it } from 'vitest'
import { companyMarketSpaceId, getCompany, homeStationId, trainsOwnedBy } from '@tabletop/18xx'
import { ActionSource } from '@tabletop/common'
import { playOut, type Watched } from '../test/bot.js'
import { kit, type Table } from '../test/kit.js'
import { MajorIds1880, isInvestor } from './stock.js'
import { SharedHomeLocationIds, MajorHomes1880 } from './map.js'
import { operatingOrder1880 } from './operating.js'
import { communist } from './stock.js'
import { marketBonus } from './stockMarket.js'

type Played = { game: Table; moves: Watched[] }

/** The majors whose home hex holds two cities, the QSR's and the SCR's. */
const SharedHomeIds = MajorIds1880.filter((id) =>
    SharedHomeLocationIds.includes(MajorHomes1880[id] ?? '')
)

function play(players: number, seed: number): Played {
    const game = kit.table(players, seed)
    const moves: Watched[] = []
    playOut(game, seed, 8000, (move) => moves.push(move))
    return { game, moves }
}

const processedOf = (played: Played, type: string) =>
    played.moves.flatMap((move) =>
        move.processed.filter((action) => action.type === type).map((action) => ({ move, action }))
    )

describe.each([
    [3, 1],
    [5, 3]
])('a %i-player game with seed %i', (players, seed) => {
    let played: Played
    beforeAll(() => {
        played = play(players, seed)
    }, 300_000)

    it('ends after the train-marker company’s turn, three rounds after the last 8-train', () => {
        const { game } = played
        const ending = game.state.gameEnding
        expect(game.state.machineState).toBe('GameOver')
        expect(ending?.finalCompanyId).toBe(game.state.trainMarker)
        expect(ending?.finalOperatingRound).toBe((game.state.lastEightRound ?? 0) + 3)
        expect(game.state.operatingSet?.roundNumber).toBe(ending?.finalOperatingRound)
        const finishes = processedOf(played, 'FinishOperatingTurn')
        expect(Reflect.get(finishes.at(-1)?.action ?? {}, 'companyId')).toBe(ending?.finalCompanyId)
    })

    it('puts each company’s home down as the share round floating it ends (§XII)', () => {
        let checked = 0
        for (const move of played.moves) {
            if (
                !move.processed.some(
                    (action) =>
                        action.type === 'ResumeOperatingTurn' ||
                        action.type === 'StartOperatingRound'
                )
            )
                continue
            for (const companyId of MajorIds1880) {
                const company = getCompany(move.after, companyId)
                // The QSR and SCR may hold their home for their director's choice of city.
                if (!company.floated || company.closed || SharedHomeIds.includes(companyId))
                    continue
                const home = move.after.stations.find(
                    (station) => station.id === homeStationId(companyId)
                )
                expect(home?.status).toBe('placed')
                checked++
            }
        }
        expect(checked).toBeGreaterThan(0)
    })

    it('lets a company floated in an interrupting share round operate after the resuming one', () => {
        for (const { move, action } of processedOf(played, 'ResumeOperatingTurn')) {
            const before = move.before.operatingSet
            const after = move.after.operatingSet
            if (!before || !after || before.roundNumber !== after.roundNumber) continue
            const resumed = Reflect.get(action, 'metadata')?.companyId
            const order = operatingOrder1880(move.after)
            for (const companyId of order) {
                if (before.companyOrder.includes(companyId)) continue
                if (order.indexOf(companyId) > order.indexOf(resumed))
                    expect(after.companyOrder).toContain(companyId)
                else expect(after.companyOrder).not.toContain(companyId)
            }
        }
    })

    it('interrupts a turn with a share round and resumes the same company', () => {
        const interrupted = processedOf(played, 'InterruptOperatingTurn').map(
            ({ action }) => Reflect.get(action, 'metadata').companyId
        )
        const resumed = processedOf(played, 'ResumeOperatingTurn').map(
            ({ action }) => Reflect.get(action, 'metadata').companyId
        )
        expect(interrupted.length).toBeGreaterThan(3)
        expect(resumed).toEqual(interrupted)
    })

    it('withholds every investor’s earnings with no decision from its owner (§VII)', () => {
        const payouts = processedOf(played, 'DistributeEarnings').filter(({ action }) =>
            isInvestor(Reflect.get(action, 'companyId'))
        )
        expect(payouts.length).toBeGreaterThan(3)
        for (const { action } of payouts) {
            expect(action.source).toBe(ActionSource.System)
            expect(Reflect.get(action, 'choice')).toBe('withhold')
        }
    })

    it('moves no share price under communism', () => {
        for (const { move, action } of processedOf(played, 'DistributeEarnings')) {
            // A move that changes phase may end communism, or rust the trains, before the run.
            if (!communist(move.before) || move.before.phaseId !== move.after.phaseId) continue
            const companyId = Reflect.get(action, 'companyId')
            if (isInvestor(companyId)) continue
            expect(companyMarketSpaceId(move.after.stockMarket, companyId)).toBe(
                companyMarketSpaceId(move.before.stockMarket, companyId)
            )
        }
    })

    it('adds the share price bonus to a major’s run', () => {
        for (const { move, action } of processedOf(played, 'RunTrains')) {
            const companyId = Reflect.get(action, 'companyId')
            if (isInvestor(companyId) || move.before.phaseId !== move.after.phaseId) continue
            // A move may also sell the company's trains before it runs, as to a company of the
            // same director; only a fleet the move leaves alone is known at the run.
            const fleet = (state: typeof move.before) =>
                trainsOwnedBy(state, { kind: 'company', companyId })
                    .map((train) => train.id)
                    .join()
            if (fleet(move.before) !== fleet(move.after)) continue
            const expected = trainsOwnedBy(move.before, { kind: 'company', companyId }).length
                ? marketBonus(companyMarketSpaceId(move.before.stockMarket, companyId))
                : 0
            expect(Reflect.get(action, 'metadata')?.bonus ?? 0).toBe(expected)
        }
    })

    it('leases investors a train only while they operate, and returns it', () => {
        for (const { move } of processedOf(played, 'LeaseTrain'))
            expect(communist(move.before) || move.before.phaseId >= 'B3').toBe(false)
        expect(processedOf(played, 'LeaseTrain')).toHaveLength(
            processedOf(played, 'ReturnLeasedTrain').length
        )
    })
})
