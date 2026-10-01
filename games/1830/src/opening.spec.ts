import { expect, it } from 'vitest'
import { cashOwnedBy, EighteenXXStateValidator } from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyStockRules,
    EighteenThirtyTrainDepot,
    EighteenThirtyTrainRules
} from './index.js'
import { EighteenThirtyScenarios } from './scenarios/index.js'
import { createEighteenThirtyOpening } from './openingAuction.js'
import { assertExists, Color, Prng, type PlayerState } from '@tabletop/common'

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

it('reserves homes, with NYNH in the first New York city and Erie on both Buffalo cities', () => {
    const { state } = exampleGame(EighteenThirtyScenarios, 'opening', 4)
    expect(
        state.stationReservations.map(
            (reservation) =>
                `${reservation.companyId} ${reservation.locationId}/${reservation.nodeId}`
        )
    ).toEqual([
        'CO F6/city',
        'PRR H12/city',
        'CPR A19/city',
        'NYC E19/city',
        'ERIE E11/city-0',
        'ERIE E11/city-1',
        'BO I15/city',
        'NYNH G19/city-0',
        'BM E23/city'
    ])
    expect(
        state.stations.filter((station) => station.companyId === 'PRR').map((station) => station.id)
    ).toEqual(['PRR:home', 'PRR:station:1', 'PRR:station:2', 'PRR:station:3'])
})

function trainOffersAfterTwoSixes(config: Record<string, boolean>) {
    const players: PlayerState[] = ['a', 'b', 'c'].map((playerId) => ({
        playerId,
        color: Color.Blue
    }))
    const { position } = createEighteenThirtyOpening({ players, prng: new Prng(1), config })
    const { state } = exampleGame(EighteenThirtyScenarios, 'opening', 3)
    const trainInventory = position.trainInventory
    let sixes = 0
    while (sixes < 2) {
        const definitionId = EighteenThirtyTrainDepot.nextDefinitionId(trainInventory)
        assertExists(definitionId, 'The depot still has trains')
        const train = EighteenThirtyTrainDepot.nextTrain(trainInventory, definitionId)
        assertExists(train, `The depot supplies a ${definitionId}-train`)
        EighteenThirtyTrainDepot.purchase(trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId: 'PRR'
        })
        if (definitionId === '6') sixes++
    }
    return EighteenThirtyTrainRules.availableDefinitions({ ...state, phaseId: '6', trainInventory })
}

it('offers a third 6-train only with the optional rule', () => {
    expect(trainOffersAfterTwoSixes({})).toEqual(['D'])
    expect(trainOffersAfterTwoSixes({ extraSixTrain: true })).toEqual(['6', 'D'])
})
