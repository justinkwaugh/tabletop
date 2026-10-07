import { describe, it, expect } from 'vitest'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { Scenarios1846, ScenarioPositions1846 } from './index.js'
import { trainsOwnedBy, RailwayMapState, nextOperatingCompany } from '@tabletop/18xx'
import { EighteenFortySixMap } from '../map.js'
import { EighteenFortySixTileSet } from '../tiles.js'
import { ActionSource } from '@tabletop/common'
import { earningsChoices1846 } from '../earnings.js'
import { PrivateConstruction } from '../privateConstruction.js'
import { revenueMarkerChoices } from '../revenueMarkers.js'
import { stockChoices } from '../stock.js'
import { HydratedEighteenFortySixState, CanonicalValidator } from '../state.js'

describe('1846 playground scenarios', () => {
    for (const count of [2, 3, 4, 5]) {
        it.each(ScenarioPositions1846)(
            `starts %s with ${count} players and a legal next action`,
            (position) => {
                const { game, engine, state } = exampleGame(Scenarios1846, position, count, 1889)
                expect(CanonicalValidator.Check(state)).toBe(true)
                expect(
                    state.activePlayerIds.flatMap((id) =>
                        engine.getValidActionTypesForPlayer(game, state, id)
                    ).length
                ).toBeGreaterThan(0)
                expect(state.actionChecksum).toBe(0)
                expect(state.actionCount).toBeLessThan(10)
            }
        )
    }
})

it.each([2, 3, 4, 5])(
    'stock scenarios offer a purchase on a fresh turn with %s players',
    (count) => {
        const { state } = exampleGame(Scenarios1846, 'trading', count, 1889)
        const choices = stockChoices(
            new HydratedEighteenFortySixState(state),
            state.activePlayerIds[0]
        )
        expect(choices.buys.length).toBeGreaterThan(0)
        expect(choices.starts.length).toBeGreaterThan(0)
    }
)

it.each(['powers', 'transfers'] as const)(
    '%s scenarios begin a fresh construction step',
    (position) => {
        const { state } = exampleGame(Scenarios1846, position, 3, 1889)
        const companyId = nextOperatingCompany(state)
        expect(state.machineState).toBe('LayingTrack')
        expect(state.trackStep).toMatchObject({ companyId, completed: false, lays: [] })
        expect(state.stationStep).toMatchObject({
            companyId,
            completed: false,
            placedStationIds: []
        })
    }
)

it('route scenarios can proceed through payout after running trains', () => {
    const { game, engine, state } = exampleGame(Scenarios1846, 'routes', 3, 1889)
    const map = new RailwayMapState(
        EighteenFortySixMap,
        EighteenFortySixTileSet,
        state.tileInventory
    )
    const train = trainsOwnedBy(state, { kind: 'company', companyId: 'IC' })[0]
    const { updatedState } = engine.executeCanonicalAction({
        game,
        state,
        action: {
            id: 'run-scenario',
            gameId: game.id,
            type: 'RunTrains',
            source: ActionSource.User,
            playerId: state.activePlayerIds[0],
            companyId: 'IC',
            routes: [
                {
                    trainId: train.id,
                    start: { locationId: 'K3', nodeId: 'city' },
                    paths: [
                        { locationId: 'K3', pathId: 'edge-3' },
                        { locationId: 'J4', pathId: map.tile('J4').face.paths[0].id },
                        { locationId: 'I5', pathId: 'edge-0' }
                    ]
                }
            ]
        }
    })
    expect(earningsChoices1846(new HydratedEighteenFortySixState(updatedState))).toHaveLength(3)
})

describe('1846 private power scenarios', () => {
    for (const count of [2, 3, 4, 5]) {
        it(`gives the operating railroad usable private powers with ${count} players`, () => {
            const position = (name: 'private-tiles' | 'private-upgrade' | 'private-marker') => {
                const { state } = exampleGame(Scenarios1846, name, count, 1889)
                return { hydrated: new HydratedEighteenFortySixState(state), state }
            }
            const tiles = position('private-tiles')
            const president = tiles.state.activePlayerIds[0]
            for (const id of ['MC', 'O&I'] as const)
                expect(
                    new PrivateConstruction(tiles.hydrated, president, id).choices([]).length
                ).toBeGreaterThan(0)
            const upgrade = position('private-upgrade')
            expect(
                new PrivateConstruction(
                    upgrade.hydrated,
                    upgrade.state.activePlayerIds[0],
                    'LSL'
                ).choices([]).length
            ).toBeGreaterThan(0)
            const marker = position('private-marker')
            expect(marker.state.pendingRevenueMarker).toMatchObject({ privateCompanyId: 'MPC' })
            expect(
                revenueMarkerChoices(marker.hydrated, marker.state.activePlayerIds[0]).map(
                    (choice) => choice.locationId
                )
            ).toEqual(['I1', 'D6'])
        })
    }
})
