import { describe, expect, it } from 'vitest'
import {
    TestCompanyId,
    TestTrackHomeLocationId,
    minimalPlayState,
    minimalTrackMap,
    minimalTrackRules,
    minimalTrackTileSet,
    straightOnlyTrackTileSet
} from '@tabletop/18xx/testing'
import { TrackModule, type TrackSession } from './trackModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const noPrivateTrack = { trackTerms: () => undefined, earlyTrainCompany: () => undefined }

type PrivateActions = ConstructorParameters<typeof TrackModule>[2]
const noPrivateAction: PrivateActions = { selection: undefined, trackPowerSelection: undefined }

function laying(
    tileSet = minimalTrackTileSet,
    valid = ['LayTile', 'FinishTrack'],
    availability = {},
    privateActions = noPrivateAction
) {
    const base = minimalPlayState()
    const state: TrackSession['state'] = {
        ...base,
        machineState: 'LayingTrack',
        companies: base.companies.map((company) => ({ ...company, floated: true })),
        cash: [...base.cash, { owner: { kind: 'company', companyId: TestCompanyId }, amount: 100 }],
        tileInventory: tileSet.createInventory(),
        trackStep: { companyId: TestCompanyId, lays: [], completed: false },
        usedPrivatePowerIds: [],
        stations: [
            {
                id: `${TestCompanyId}:home`,
                companyId: TestCompanyId,
                status: 'placed',
                position: { locationId: TestTrackHomeLocationId, nodeId: 'city', slot: 0 }
            }
        ]
    }
    let locationsChosen = 0
    const decisions = { selectPrivateTile: () => {}, confirm: async () => {} }
    const harness = testSession(
        state,
        { trackRules: minimalTrackRules(tileSet), privatePowerRules: noPrivateTrack },
        valid,
        availability
    )
    const module = new TrackModule(
        harness.session,
        () => ({ map: minimalTrackMap, tileSet }),
        privateActions,
        decisions,
        () => locationsChosen++
    )
    return { ...harness, module, locationsChosen: () => locationsChosen }
}

describe('TrackModule', () => {
    it('offers only locations with a legal lay and none outside the track step', () => {
        const { module } = laying()
        expect(module.locationIds.length).toBeGreaterThan(0)
        expect(module.locationIds).not.toContain(TestTrackHomeLocationId)
        expect(
            laying(minimalTrackTileSet, ['FinishTrack'], { selectionsVisible: false }).module
                .selection
        ).toEqual({})
    })

    it('stages location then tile, and leaves the rotation manual when several are legal', () => {
        const { module, locationsChosen } = laying()
        module.selectLocation(module.locationIds[0])
        expect(locationsChosen()).toBe(1)
        expect(module.selection.locationId?.source).toBe('manual')
        expect(module.tiles.map((tile) => tile.id).sort()).toEqual(['18xx:8', '18xx:9'])
        expect(module.selection.definitionId).toBeUndefined()
        module.selectTile('18xx:8')
        expect(module.placements.length).toBeGreaterThan(1)
        expect(module.preview).toBeUndefined()
        module.selectPlacement(module.placements[0])
        expect(module.preview?.definitionId).toBe('18xx:8')
    })

    it('selects a lone tile and its lone rotation automatically, so Back returns to no selection', () => {
        const { module } = laying(straightOnlyTrackTileSet)
        module.selectLocation(module.locationIds[0])
        expect(module.selection.definitionId?.source).toBe('auto')
        expect(module.selection.placement?.source).toBe('auto')
        expect(module.tileInFlight).toBe(true)
        expect(module.preview?.definitionId).toBe('18xx:9')
        module.back()
        expect(module.selection).toEqual({})
        expect(module.tileInFlight).toBe(false)
    })

    it('Back unwinds rotation, tile and location one at a time, and Undo clears the whole selection', () => {
        const { module } = laying()
        module.selectLocation(module.locationIds[0])
        module.selectTile('18xx:8')
        module.selectPlacement(module.placements[0])
        module.back()
        expect(module.selection.placement).toBeUndefined()
        expect(module.selection.definitionId?.value).toBe('18xx:8')
        module.back()
        expect(module.selection.definitionId).toBeUndefined()
        module.selectTile('18xx:8')
        expect(module.stages.undo()).toBe(true)
        expect(module.selection).toEqual({})
        expect(module.stages.undo()).toBe(false)
    })

    it('previews the first rotation of a tile and rotates through the others', () => {
        const { module } = laying()
        module.selectLocation(module.locationIds[0])
        module.previewTile('18xx:8')
        const first = module.preview?.rotation
        expect(first).toBeDefined()
        module.rotatePreview()
        expect(module.preview?.rotation).not.toBe(first)
    })

    it('choosing another location restarts the selection', () => {
        const { module } = laying()
        const [first, second] = module.locationIds
        module.selectLocation(first)
        module.selectTile('18xx:8')
        module.selectLocation(second)
        expect(module.selection.locationId?.value).toBe(second)
        expect(module.selection.definitionId).toBeUndefined()
    })

    it('commits one tile lay with the previewed cost', async () => {
        const { module, applied } = laying(straightOnlyTrackTileSet)
        const locationId = module.locationIds[0]
        module.selectLocation(locationId)
        await module.confirm()
        expect(applied).toHaveLength(1)
        expect(applied[0]).toMatchObject({
            type: 'LayTile',
            companyId: TestCompanyId,
            locationId,
            definitionId: '18xx:9',
            expectedCost: 0
        })
    })

    it('refuses to finish the step while a location is selected', async () => {
        const { module, applied } = laying()
        module.selectLocation(module.locationIds[0])
        await expect(module.finish()).rejects.toThrow()
        module.cancel()
        await module.finish()
        expect(applied.map((action) => action.type)).toEqual(['FinishTrack'])
    })

    it('hides choices while a private purchase source is open', () => {
        expect(laying().module.showChoices).toBe(true)
        const { module } = laying(
            minimalTrackTileSet,
            ['LayTile', 'FinishTrack'],
            {},
            {
                selection: 'mine',
                trackPowerSelection: undefined
            }
        )
        expect(module.showChoices).toBe(false)
        expect(module.canBuild).toBe(false)
        expect(module.locationIds).toEqual([])
    })

    it('cannot build while the session is not interactive', () => {
        const { module } = laying(minimalTrackTileSet, ['LayTile', 'FinishTrack'], {
            interactive: false
        })
        expect(module.canBuild).toBe(false)
        expect(() => module.selectLocation(module.locationIds[0])).toThrow()
    })
})
