import { describe, expect, it } from 'vitest'
import {
    TestCompanyId,
    TestHomeLocationId,
    TestOpenLocationId,
    minimalPlayState,
    minimalStationRules,
    minimalTileSet
} from '@tabletop/18xx/testing'
import { StationsModule, type StationsContext } from './stationsModule.svelte.js'
import { testContext } from './moduleTestContext.js'

const extra = `${TestCompanyId}:extra`

function placing(valid: string[], availability = {}, tokenChoiceRequired = false) {
    const base = minimalPlayState()
    const state: StationsContext['state'] = {
        ...base,
        machineState: 'PlacingStation',
        companies: base.companies.map((company) => ({ ...company, floated: true })),
        cash: [...base.cash, { owner: { kind: 'company', companyId: TestCompanyId }, amount: 100 }],
        tileInventory: minimalTileSet.createInventory(),
        stationStep: { companyId: TestCompanyId, placedStationIds: [], completed: false },
        stations: [
            {
                id: `${TestCompanyId}:home`,
                companyId: TestCompanyId,
                status: 'placed',
                position: { locationId: TestHomeLocationId, nodeId: 'city', slot: 0 }
            },
            { id: extra, companyId: TestCompanyId, status: 'available' }
        ]
    }
    let positionsChosen = 0
    const harness = testContext(state, { stationRules: minimalStationRules }, valid, availability)
    const module = new StationsModule(
        harness.context,
        () => positionsChosen++,
        () => tokenChoiceRequired
    )
    return { ...harness, module, positionsChosen: () => positionsChosen }
}

describe('StationsModule', () => {
    it('lists the operating company tokens that are still available', () => {
        expect(placing(['FinishStations']).module.available.map((token) => token.id)).toEqual([extra])
    })

    it('charges the title cost, and nothing for a pending home', () => {
        expect(placing(['FinishStations']).module.placementCost(extra)).toBe(40)
    })

    it('selects nothing automatically when placing a station is not a valid action', () => {
        expect(placing(['FinishStations']).module.selection).toEqual({})
    })

    it('treats an automatic token choice as pending-free and not consumable by Undo', () => {
        const { module } = placing(['FinishStations', 'PlaceStation'])
        expect(module.selection.stationId).toMatchObject({ value: extra, source: 'auto' })
        expect(module.pending()).toBe(false)
        expect(module.unwind()).toBe(false)
    })

    it('leaves the token to the player when the title says its identity matters', () => {
        const { module } = placing(['FinishStations', 'PlaceStation'], {}, true)
        expect(module.requiresTokenChoice).toBe(true)
        expect(module.selection).toEqual({})
        module.select(extra)
        expect(module.selection.stationId).toMatchObject({ value: extra, source: 'manual' })
    })

    it('lets Undo consume a manual token choice and clears it entirely', () => {
        const { module } = placing(['FinishStations', 'PlaceStation'])
        module.select(extra)
        expect(module.pending()).toBe(true)
        expect(module.unwind()).toBe(true)
        expect(module.pending()).toBe(false)
    })

    it('previews a chosen position, notifies the session, and commits one placement', async () => {
        const { module, applied, positionsChosen } = placing(['FinishStations', 'PlaceStation'])
        const choice = module.choices.find(
            (candidate) => candidate.position.locationId === TestOpenLocationId
        )
        expect(choice).toBeDefined()
        module.selectPosition({ companyId: TestCompanyId, stationId: extra, position: choice!.position })
        expect(positionsChosen()).toBe(1)
        expect(module.preview).toMatchObject({ stationId: extra, cost: 40 })
        expect(
            module.displayState.stations.find((station) => station.id === extra)?.status
        ).toBe('placed')
        await module.confirm()
        expect(applied).toMatchObject([{ type: 'PlaceStation', stationId: extra, expectedCost: 40 }])
    })

    it('refuses to finish while a position is selected, and blocks selection when not interactive', () => {
        expect(() => placing(['FinishStations'], { interactive: false }).module.select(extra)).toThrow(
            'Choose an available station'
        )
    })
})
