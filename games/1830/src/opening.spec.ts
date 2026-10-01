import { expect, it } from 'vitest'
import { cashOwnedBy, EighteenXXStateValidator } from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { EighteenThirtyStockRules, EighteenThirtyTrainDepot } from './index.js'
import { EighteenThirtyScenarios } from './scenarios/index.js'
import { createEighteenThirtyOpening } from './openingAuction.js'
import { Prng, type PlayerState } from '@tabletop/common'

const StartingCash = { 2: 1200, 3: 800, 4: 600, 5: 480, 6: 400 } as const
const CertificateLimits = { 2: 28, 3: 20, 4: 16, 5: 13, 6: 11 } as const

it.each([2, 3, 4, 5, 6] as const)('creates the %i-player opening', (count) => {
    const { state } = exampleGame(EighteenThirtyScenarios, 'opening', count)
    expect(EighteenXXStateValidator.Check(state)).toBe(true)
    expect(state.companies.filter((company) => company.kind === 'private')).toHaveLength(6)
    expect(state.companies.filter((company) => company.kind === 'major')).toHaveLength(8)
    expect(
        state.cash.reduce(
            (total, account) => total + (typeof account.amount === 'number' ? account.amount : 0),
            0
        )
    ).toBe(12000)
    for (const player of state.players)
        expect(cashOwnedBy(state, { kind: 'player', playerId: player.playerId })).toBe(
            StartingCash[count]
        )
    expect(EighteenThirtyStockRules.certificateLimit(state)).toBe(CertificateLimits[count])
    expect(state.machineState).toBe('WaterfallAuction')
})

it('reserves homes, with NYNH in the first New York city and Erie not yet reserved', () => {
    const { state } = exampleGame(EighteenThirtyScenarios, 'opening', 4)
    expect(
        Object.fromEntries(
            state.stationReservations.map((reservation) => [
                reservation.companyId,
                `${reservation.locationId}/${reservation.nodeId}`
            ])
        )
    ).toEqual({
        PRR: 'H12/city',
        NYC: 'E19/city',
        CPR: 'A19/city',
        BO: 'I15/city',
        CO: 'F6/city',
        NYNH: 'G19/city-0',
        BM: 'E23/city'
    })
    expect(
        state.stations.filter((station) => station.companyId === 'PRR').map((station) => station.id)
    ).toEqual(['PRR:home', 'PRR:station:1', 'PRR:station:2', 'PRR:station:3'])
})

function sixTrains(config: Record<string, boolean>) {
    const players: PlayerState[] = ['a', 'b', 'c'].map((playerId) => ({ playerId }) as PlayerState)
    const { position } = createEighteenThirtyOpening({ players, prng: new Prng(1), config })
    return EighteenThirtyTrainDepot.remaining(position.trainInventory, '6')
}

it('supplies a third 6-train only with the optional rule', () => {
    expect(sixTrains({})).toBe(2)
    expect(sixTrains({ extraSixTrain: true })).toBe(3)
})
