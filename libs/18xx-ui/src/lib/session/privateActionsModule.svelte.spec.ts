import { describe, expect, it } from 'vitest'
import { PrivateActionsModule, type PrivateActionsSession } from './privateActionsModule.svelte.js'
import { singleChoice } from './stagedSelection.svelte.js'
import type { CompanyDecision, PrivateTileOption } from './companyDecisionsModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const Alpha = { privateCompanyId: 'alpha', playerId: 'alex' }
const Beta = { privateCompanyId: 'beta', playerId: 'alex' }

function privateActions(
    powers: { privateCompanyId: string; playerId: string }[],
    state: PrivateActionsSession['state'] = {},
    availability = {}
) {
    let trackSelected = false
    let trackCleared = 0
    const decisions = {
        choice: singleChoice<CompanyDecision>(),
        privateTileOptions: powers.flatMap((power): PrivateTileOption[] => [
            { ...power, details: tileDetails },
            { ...power, details: tileDetails }
        ]),
        privateTrainOptions: []
    }
    const track = {
        undo: () => {
            const had = trackSelected
            trackSelected = false
            return had
        },
        clear: () => {
            trackSelected = false
            trackCleared++
        }
    }
    const { session } = testSession(state, undefined, [], availability)
    return {
        module: new PrivateActionsModule(session, decisions, track),
        decisions,
        selectTrack: () => { trackSelected = true },
        trackSelected: () => trackSelected,
        trackCleared: () => trackCleared
    }
}
const tileDetails: PrivateTileOption['details'] = {
    companyId: 'R',
    locationId: 'B2',
    definitionId: '18xx:9',
    rotation: 0,
    nodeMapping: {},
    placement: { pieceId: 'straight/1', definitionId: '18xx:9', rotation: 0 },
    cost: 0,
    terrainCost: 0,
    allowanceCost: 0,
    stations: [],
    stationReservations: []
}

describe('PrivateActionsModule', () => {
    it('lists each private tile power once however many lays it offers', () => {
        expect(privateActions([Alpha, Beta]).module.trackPowers).toEqual([Alpha, Beta])
    })

    it('opening a source discards the track selection and any company decision', () => {
        const { module, decisions, trackCleared } = privateActions([Alpha])
        decisions.choice.choose('choice', { kind: 'tile', ...Alpha, details: tileDetails })
        module.choosePurchaseSource('mine')
        expect(module.purchaseSource).toBe('mine')
        expect(trackCleared()).toBe(1)
        expect(decisions.choice.hasManual()).toBe(false)
    })

    it('selects a lone power automatically once powers are opened, without making it undoable', () => {
        const { module } = privateActions([Alpha])
        expect(module.trackPowerSelection).toBeUndefined()
        module.choosePowers()
        expect(module.purchaseSource).toBeUndefined()
        expect(module.trackPowerSelection).toEqual({ value: Alpha, source: 'auto' })
        expect(module.undo()).toBe(true)
        expect(module.selection).toBeUndefined()
        expect(module.undo()).toBe(false)
    })

    it('waits for a manual choice between several powers', () => {
        const { module } = privateActions([Alpha, Beta])
        module.choosePowers()
        expect(module.trackPowerSelection).toBeUndefined()
        module.chooseTrackPower(Beta)
        expect(module.trackPowerSelection).toEqual({ value: Beta, source: 'manual' })
        expect(() => module.chooseTrackPower({ privateCompanyId: 'gamma', playerId: 'alex' })).toThrow()
    })

    it('offers the power without opening a source while the state awaits a private tile lay', () => {
        const { module } = privateActions([Alpha], {
            privateTrackLay: { privateCompanyId: 'alpha', playerId: 'alex', companyId: 'R' }
        })
        expect(module.selection).toBeUndefined()
        expect(module.trackPowerSelection?.value).toEqual(Alpha)
    })

    it('Undo clears the track selection first, then the power, then the source', () => {
        const { module, selectTrack, trackSelected } = privateActions([Alpha, Beta])
        module.choosePowers()
        module.chooseTrackPower(Alpha)
        selectTrack()
        expect(module.undo()).toBe(true)
        expect(trackSelected()).toBe(false)
        expect(module.trackPowerSelection?.value).toEqual(Alpha)
        expect(module.undo()).toBe(true)
        expect(module.trackPowerSelection).toBeUndefined()
        expect(module.selection).toBe('powers')
        expect(module.undo()).toBe(true)
        expect(module.selection).toBeUndefined()
    })

    it('leaves an ordinary track selection to its own Undo when no private action is open', () => {
        const { module, selectTrack, trackSelected } = privateActions([])
        selectTrack()
        expect(module.undo()).toBe(false)
        expect(trackSelected()).toBe(true)
    })

    it('shows nothing while selections are hidden', () => {
        const { module } = privateActions([Alpha], {}, { selectionsVisible: false })
        module.choosePowers()
        expect(module.selection).toBeUndefined()
        expect(module.trackPowerSelection).toBeUndefined()
    })
})
