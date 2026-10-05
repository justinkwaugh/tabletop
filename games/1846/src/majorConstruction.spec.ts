import { describe, expect, it } from 'vitest'
import { assert, assertExists, ActionSource } from '@tabletop/common'
import { TrackConstruction, StationPlacement, finiteCashOwnedBy } from '@tabletop/18xx'
import { stockGame, start } from './testSupport.js'
import { TrackRules1846 } from './track.js'
import { StationRules1846, stationChoices1846 } from './stations.js'

function constructionGame() {
    const table = stockGame()
    table.launch('B&O', 100)
    for (let i = 0; i < 4; i++) table.finishTurn()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    table.act('CorporateFinance', { companyId: 'B&O', operation: 'pass', shares: 0, amount: 0 })
    return table
}
function stationRequest(table: ReturnType<typeof stockGame>) {
    const choice = stationChoices1846(table.hydrated).find(
        (choice) => choice.position.locationId === 'H12'
    )
    assertExists(choice)
    const { cost, ...request } = choice
    return { ...request, expectedCost: cost }
}
describe('1846 major construction', () => {
    it('places the remote B&O station before track and builds from its new base', () => {
        const table = constructionGame()
        expect(table.state.stationStep).toMatchObject({
            companyId: 'B&O',
            placedStationIds: [],
            completed: false
        })
        expect(new TrackConstruction(table.hydrated, TrackRules1846).choices('H12')).toEqual([])
        const request = stationRequest(table)
        expect(request.expectedCost).toBe(100)
        table.act('PlaceStation', request)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'B&O' })).toBe(100)
        expect(table.state.stationReservations.some((r) => r.companyId === 'B&O')).toBe(false)
        expect(stationChoices1846(table.hydrated)).toEqual([])
        const choice = new TrackConstruction(table.hydrated, TrackRules1846).choices('H12')[0]
        assertExists(choice, 'The new remote base permits track at Cincinnati')
        const { cost, companyId, locationId, definitionId, rotation, nodeMapping } = choice
        table.act('LayTile', {
            companyId,
            locationId,
            definitionId,
            rotation,
            nodeMapping,
            expectedCost: cost
        })
        const finish = table.act('FinishTrack', { companyId: 'B&O' })
        expect(finish.processedActions.map((a) => a.type)).toEqual([
            'FinishTrack',
            'FinishStations',
            'RunTrains',
            'DistributeEarnings'
        ])
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(table.state.stationStep?.completed).toBe(true)
        expect(table.state.companies.find((c) => c.id === 'B&O')?.operated).toBe(true)
        expect(() => table.act('PlaceStation', request)).toThrow()
        let state = table.initialState
        for (const action of table.actions)
            state = table.engine.applyProcessedAction({ game: table.game, state, action })
        expect(state).toEqual(table.state)
        for (const action of table.actions.toReversed())
            state = table.engine.undoProcessedAction({ state, action })
        expect(state).toEqual(table.initialState)
    })
    it('keeps station placement open after both tile lays', () => {
        const table = constructionGame()
        const home = table.state.stations.find(
            (station) => station.companyId === 'B&O' && station.status === 'placed'
        )
        assert(home?.status === 'placed', 'The corporation has a home station')
        home.position = { locationId: 'C15', nodeId: 'city', slot: 1 }
        for (let i = 0; i < 2; i++) {
            const construction = new TrackConstruction(table.hydrated, TrackRules1846)
            const choice = TrackRules1846.map.definition.locations.flatMap((location) =>
                construction.choices(location.id)
            )[0]
            assertExists(choice)
            const { cost, companyId, locationId, definitionId, rotation, nodeMapping } = choice
            table.act('LayTile', {
                companyId,
                locationId,
                definitionId,
                rotation,
                nodeMapping,
                expectedCost: cost
            })
        }
        expect(table.state.trackStep?.lays).toHaveLength(2)
        const before = structuredClone(table.state)
        const placed = table.act('PlaceStation', stationRequest(table))
        expect(table.state.stationStep?.placedStationIds).toHaveLength(1)
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(placed.processedActions.map((action) => action.type)).toEqual([
            'PlaceStation',
            'FinishTrack',
            'FinishStations',
            'RunTrains',
            'DistributeEarnings'
        ])
        let restored = table.state
        for (const action of placed.processedActions.toReversed())
            restored = table.engine.undoProcessedAction({ state: restored, action })
        expect(restored).toEqual(before)
    })
    it('rejects wrong actors, wrong cost, occupied cities and unaffordable remote stations', () => {
        const table = constructionGame()
        const request = stationRequest(table)
        for (const fields of [
            { playerId: 'p2' },
            { expectedCost: 40 },
            { source: ActionSource.System },
            { position: { locationId: 'G19', nodeId: 'city', slot: 0 } }
        ])
            expect(() => table.act('PlaceStation', { ...request, ...fields })).toThrow()
        const cash = table.state.cash.find(
            (c) => c.owner.kind === 'company' && c.owner.companyId === 'B&O'
        )
        assertExists(cash)
        cash.amount = 99
        expect(stationChoices1846(table.hydrated)).toEqual([])
        expect(() => table.act('PlaceStation', request)).toThrow()
        table.act('FinishTrack', { companyId: 'B&O' })
        expect(table.state.machineState).toBe('BuyingTrains')
    })
    it('prices reserved destinations and limits disconnected permission to B&O and PRR', () => {
        const table = constructionGame()
        expect(StationRules1846.placementCost(table.hydrated, 'test')).toBe(80)
        for (const [companyId, locationId, remoteCost] of [
            ['B&O', 'H12', 100],
            ['PRR', 'E11', 60]
        ] as const) {
            const request = {
                companyId,
                stationId: 'test',
                position: { locationId, nodeId: 'city', slot: 0 }
            }
            expect(StationRules1846.allowsDisconnected?.(table.hydrated, request)).toBe(true)
            expect(
                StationRules1846.placementCost(table.hydrated, 'test', {
                    ...request,
                    connected: false
                })
            ).toBe(remoteCost)
            expect(
                StationRules1846.placementCost(table.hydrated, 'test', {
                    ...request,
                    connected: true
                })
            ).toBe(40)
        }
        expect(
            StationRules1846.allowsDisconnected?.(table.hydrated, {
                companyId: 'IC',
                stationId: 'test',
                position: { locationId: 'I5', nodeId: 'city', slot: 0 }
            })
        ).toBe(false)
    })
    it('reserves the southeast Chicago city only while C&WI is in play', () => {
        for (const seed of [1, 7, 12, 23]) {
            const { state } = start(3, seed)
            const reserved = !state.removedPrivateIds.includes('C&WI')
            expect(state.stationReservations.some((r) => r.companyId === 'C&WI')).toBe(reserved)
            const placement = new StationPlacement(state, StationRules1846)
            expect(placement.openSlots('IC', 'D6', 'city-3')).toEqual(reserved ? [] : [0])
            expect(placement.openSlots('IC', 'D6', 'city-0')).toEqual([0])
        }
    })
})
