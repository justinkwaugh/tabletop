import { TrackConstruction, TrainPurchase } from '@tabletop/18xx'
import { describe, expect, it } from 'vitest'
import { available, charter, declineAll, table, type Table } from '../test/kit.js'
import { company1862 } from './companies.js'
import { TrackRules1862 } from './trackRules.js'
import { TrainRules1862 } from './operating.js'

/** Charters the first available company, floated at £100, and plays to its first turn. */
function firstTurn(players = 4): { game: Table; companyId: string; director: string } {
    const game = table(players)
    const [companyId] = available(game)
    const director = game.player
    charter(game, companyId, 100, 2)
    declineAll(game)
    declineAll(game)
    while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
    return { game, companyId, director }
}

function layFirstChoice(game: Table, locationId: string) {
    const [choice] = new TrackConstruction(game.hydrated, TrackRules1862).choices(locationId)
    if (!choice) throw new Error(`No lay in ${locationId}`)
    game.act('LayTile', {
        companyId: choice.companyId,
        locationId,
        definitionId: choice.definitionId,
        rotation: choice.rotation,
        nodeMapping: choice.nodeMapping,
        expectedCost: choice.cost
    })
    return choice
}

describe('1862 operating turns', () => {
    it('places the home station first and makes the home tile the first build', () => {
        const { game, companyId, director } = firstTurn()
        const home = company1862(companyId).home
        expect(game.state.machineState).toBe('LayingTrack')
        expect(game.player).toBe(director)
        const station = game.state.stations.find((entry) => entry.id === `${companyId}:home`)
        expect(station).toMatchObject({ status: 'placed', position: { locationId: home } })
        const construction = new TrackConstruction(game.hydrated, TrackRules1862)
        const elsewhere = game.state.tileInventory.placements
        expect(Object.keys(elsewhere)).toHaveLength(0)
        expect(game.valid()).not.toContain('PlaceSmallStation')
        expect(construction.choices(home).length).toBeGreaterThan(0)
        layFirstChoice(game, home)
        expect(game.state.tileInventory.placements[home]).toBeDefined()
    })

    it('buys a train of the face the director chooses, with a free warranty on an A', () => {
        const { game, companyId } = firstTurn()
        layFirstChoice(game, company1862(companyId).home)
        while (game.state.machineState !== 'BuyingTrains') {
            const [next] = game
                .valid()
                .filter((type) => type.startsWith('Finish') || type === 'PassStation')
            if (!next)
                throw new Error(`Stuck in ${game.state.machineState}: ${game.valid().join()}`)
            game.act(next, { companyId })
        }
        const offer = new TrainPurchase(game.hydrated, TrainRules1862)
            .offers()
            .find((entry) => entry.definitionId === 'AL')
        expect(offer?.evaluation.details?.price).toBe(100)
        game.act('BuyTrain', {
            companyId,
            trainId: offer?.evaluation.details?.trainId,
            definitionId: 'AL',
            expectedPrice: 100
        })
        const trainId = offer?.evaluation.details?.trainId ?? ''
        expect(game.state.warranties[trainId]).toBe(1)
        game.act('BuyWarranties', { companyId, trainId, count: 2 })
        expect(game.state.warranties[trainId]).toBe(3)
        // A limit of three trains of each kind in phase A.
        for (let index = 0; index < 2; index++) {
            const next = new TrainPurchase(game.hydrated, TrainRules1862)
                .offers()
                .find((entry) => entry.definitionId === 'AL')
            game.act('BuyTrain', {
                companyId,
                trainId: next?.evaluation.details?.trainId,
                definitionId: 'AL',
                expectedPrice: 100
            })
        }
        const fourth = new TrainPurchase(game.hydrated, TrainRules1862)
            .offers()
            .find((entry) => entry.definitionId === 'AL')
        expect(fourth?.evaluation.reason).toBe('The company holds 3 local trains.')
        const express = new TrainPurchase(game.hydrated, TrainRules1862)
            .offers()
            .find((entry) => entry.definitionId === 'AE')
        expect(express?.evaluation.details).toBeDefined()
    })
})
