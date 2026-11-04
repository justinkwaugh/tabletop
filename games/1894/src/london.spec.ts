import { describe, expect, it } from 'vitest'
import { playExample } from '@tabletop/18xx/scenarios'
import { assertExists } from '@tabletop/common'
import { holdsAccessRight, type TrainRoute } from '@tabletop/18xx'
import { EighteenNinetyFourNames } from './names.js'
import { EighteenNinetyFourRouteRules } from './routeRules.js'
import { EighteenNinetyFourScenarios } from './scenarios/index.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import { EighteenNinetyFourTrainDepot } from './trains.js'
import type { EighteenNinetyFourState } from './state.js'

// The Belge's home moves to Calais, whose tile runs to London.
function atCalais(state: EighteenNinetyFourState, { a12 = false } = {}) {
    state.tileInventory = EighteenNinetyFourTileSet.createInventory([
        { locationId: 'B9', definitionId: '18xx:57', rotation: 0 }
    ])
    state.stations = state.stations.map((station) =>
        station.id === 'Belge:home'
            ? {
                  ...station,
                  status: 'placed',
                  position: { locationId: 'B9', nodeId: 'city', slot: 0 }
              }
            : a12 && station.id === 'Belge:station:1'
              ? {
                    ...station,
                    status: 'placed',
                    position: { locationId: 'A12', nodeId: 'city', slot: 0 }
                }
              : station
    )
}

function londonRoute(state: EighteenNinetyFourState): TrainRoute {
    const train = state.trainInventory.trains.find(
        (train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === 'Belge'
    )
    assertExists(train, 'The Belge owns a train')
    return {
        trainId: train.id,
        start: { locationId: 'B9', nodeId: 'city' },
        paths: [
            { locationId: 'B9', pathId: 'edge-3' },
            { locationId: 'A10', pathId: 'edge-0' }
        ]
    }
}

describe('London (§12.3.3, §14)', () => {
    it('runs to London only with a ferry marker', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'routes', 3, (state) =>
            atCalais(state)
        )
        const route = londonRoute(play.state)
        expect(() => play.act('RunTrains', { companyId: 'Belge', routes: [route] })).toThrow()
        const withFerry = playExample(EighteenNinetyFourScenarios, 'routes', 3, (state) => {
            atCalais(state)
            state.accessRights = [{ rightId: 'ferry', companyId: 'Belge' }]
        })
        withFerry.act('RunTrains', { companyId: 'Belge', routes: [londonRoute(withFerry.state)] })
        // Calais's 20 and London's yellow 30.
        expect(withFerry.state.routeStep?.result?.revenue).toBe(50)
    })

    it('adds the route’s largest other revenue to London for the A12 station', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'routes', 3, (state) => {
            atCalais(state, { a12: true })
            state.accessRights = [{ rightId: 'ferry', companyId: 'Belge' }]
        })
        play.act('RunTrains', { companyId: 'Belge', routes: [londonRoute(play.state)] })
        // Calais 20, London 30, and Calais's 20 again for the A12 station.
        expect(play.state.routeStep?.result?.revenue).toBe(70)
    })

    it('names every route bonus for the history', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'routes', 3, (state) =>
            atCalais(state, { a12: true })
        )
        const train = EighteenNinetyFourTrainDepot.definition.trains[0]
        assertExists(train, 'The depot defines a train')
        const rules = EighteenNinetyFourRouteRules
        const sourceIds = [
            ...(rules.revenuePolicy?.(train, play.state, 'Belge').connectionBonuses ?? []),
            ...(rules.bestStopBonuses?.(play.state, 'Belge', train) ?? [])
        ].map((bonus) => bonus.sourceId)
        expect(sourceIds).toEqual(['netherlands', 'luxembourg', 'LS'])
        for (const sourceId of sourceIds) {
            assertExists(sourceId, 'Each 1894 bonus has a source')
            expect(EighteenNinetyFourNames.routeBonus(sourceId)).toBeTruthy()
        }
    })

    it('sells a ferry marker to a company whose track reaches London', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, (state) =>
            atCalais(state)
        )
        play.act('BuyAccessRight', { companyId: 'Belge', rightId: 'ferry', expectedPrice: 80 })
        expect(holdsAccessRight(play.state, 'Belge', 'ferry')).toBe(true)
        expect(() =>
            play.act('BuyAccessRight', { companyId: 'Belge', rightId: 'ferry', expectedPrice: 80 })
        ).toThrow()
        const far = playExample(EighteenNinetyFourScenarios, 'construction', 3)
        expect(() =>
            far.act('BuyAccessRight', { companyId: 'Belge', rightId: 'ferry', expectedPrice: 80 })
        ).toThrow()
    })
})
