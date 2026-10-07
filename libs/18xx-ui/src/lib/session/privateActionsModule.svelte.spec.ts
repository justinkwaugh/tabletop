import { describe, expect, it } from 'vitest'
import {
    PrivateActionsModule,
    type PrivateActionsSession,
    type TitlePrivatePower
} from './privateActionsModule.svelte.js'
import { singleChoice } from './stagedSelection.svelte.js'
import type { CompanyDecision, PrivateTileOption } from './companyDecisionsModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const Alpha = { privateCompanyId: 'alpha', playerId: 'alex' }
const Beta = { privateCompanyId: 'beta', playerId: 'alex' }

function privateActions(
    powers: { privateCompanyId: string; playerId: string }[],
    state: PrivateActionsSession['state'] = {},
    availability = {},
    exchangeOptions: { playerId: string; privateCompanyId: string; certificateId: string }[] = [],
    titlePowers: TitlePrivatePower[] = [],
    offered?: { privateCompanyId: string; playerId: string }
) {
    let trackSelected = false
    let trackCleared = 0
    const decisions = {
        choice: singleChoice<CompanyDecision>(),
        privateTileOptions: powers.flatMap((power): PrivateTileOption[] => [
            { ...power, details: tileDetails },
            { ...power, details: tileDetails }
        ]),
        privateTrainOptions: [],
        privateMarkerOptions: []
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
        module: new PrivateActionsModule(
            session,
            decisions,
            track,
            { exchangeOptions },
            () => titlePowers,
            () => offered
        ),
        decisions,
        selectTrack: () => {
            trackSelected = true
        },
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
    it('counts an available private exchange as a usable private power', () => {
        expect(privateActions([]).module.powersAvailable).toBe(false)
        expect(
            privateActions([], {}, {}, [
                { playerId: 'alex', privateCompanyId: 'DR', certificateId: 'IR:share:5' }
            ]).module.powersAvailable
        ).toBe(true)
    })

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
        expect(() =>
            module.chooseTrackPower({ privateCompanyId: 'gamma', playerId: 'alex' })
        ).toThrow()
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

    it('offers title powers, lists track ones with the tile powers, and never auto-selects past a map choice', () => {
        let staged = 1
        const titleTrack: TitlePrivatePower = {
            ...Beta,
            kind: 'track',
            label: 'Beta',
            prompt: 'Lay Beta',
            construction: {
                choices: () => [],
                canReach: () => false,
                evaluate: () => ({ reason: 'none' }),
                inventoryAfter: () => ({ placements: [] }) as never
            },
            commit: async () => {},
            undo: () => staged-- > 0
        }
        const marker: TitlePrivatePower = {
            privateCompanyId: 'gamma',
            playerId: 'alex',
            kind: 'location',
            label: 'Gamma',
            prompt: 'Place Gamma',
            locationIds: ['C3'],
            choose: async () => {}
        }
        expect(privateActions([], {}, {}, [], [marker]).module.powersAvailable).toBe(true)
        const { module } = privateActions([Alpha], {}, {}, [], [titleTrack, marker])
        expect(module.trackPowers).toEqual([Alpha, Beta])
        module.choosePowers()
        expect(module.trackPowerSelection).toBeUndefined()
        module.chooseTitlePower(marker)
        expect(module.titlePower).toBe(marker)
        expect(module.trackPowerSelection).toBeUndefined()
        expect(module.undo()).toBe(true)
        module.chooseTitlePower(titleTrack)
        expect(module.titlePower).toBe(titleTrack)
        expect(module.trackPowerSelection?.value).toEqual(Beta)
        // A staged lay steps back before the power itself.
        expect(module.undo()).toBe(true)
        expect(module.titlePower).toBe(titleTrack)
        expect(module.undo()).toBe(true)
        expect(module.titlePower).toBeUndefined()
    })

    it('runs an immediate title power without selecting it', () => {
        let runs = 0
        const station: TitlePrivatePower = {
            privateCompanyId: 'delta',
            playerId: 'alex',
            kind: 'immediate',
            label: 'Delta',
            prompt: 'Delta',
            run: async () => {
                runs++
            }
        }
        const { module } = privateActions([], {}, {}, [], [station])
        module.choosePowers()
        module.chooseTitlePower(station)
        expect(runs).toBe(1)
        expect(module.titlePower).toBeUndefined()
    })

    it('backs out of a power started from its Use button with one Undo', () => {
        const { module } = privateActions([Alpha, Beta])
        module.startTrackPower(Beta)
        expect(module.trackPowerSelection).toEqual({ value: Beta, source: 'manual' })
        expect(module.hasManual()).toBe(true)
        expect(module.undo()).toBe(true)
        expect(module.selection).toBeUndefined()
        expect(module.trackPowerSelection).toBeUndefined()
        expect(module.undo()).toBe(false)
    })

    it('closing leaves private actions and drops their track and company choices', () => {
        const { module, decisions, selectTrack, trackSelected } = privateActions([Alpha, Beta])
        module.choosePurchaseSource('mine')
        decisions.choice.choose('choice', { kind: 'tile', ...Alpha, details: tileDetails })
        module.close()
        expect(module.selection).toBeUndefined()
        expect(decisions.choice.hasManual()).toBe(false)
        module.startTrackPower(Alpha)
        selectTrack()
        module.close()
        expect(module.trackPowerSelection).toBeUndefined()
        expect(trackSelected()).toBe(false)
        expect(module.hasManual()).toBe(false)
    })

    const station: TitlePrivatePower = {
        privateCompanyId: 'cwi',
        playerId: 'alex',
        kind: 'location',
        label: 'CWI',
        prompt: 'Choose Chicago',
        locationIds: ['D6'],
        choose: async () => {}
    }

    it('selects a lone map power once powers are opened', () => {
        const { module } = privateActions([], {}, {}, [], [station])
        module.choosePowers()
        expect(module.titlePower).toBe(station)
        expect(module.undo()).toBe(true)
        expect(module.selection).toBeUndefined()
    })

    it('opens an offered power without a manual choice until closed', () => {
        const { module } = privateActions([Alpha], {}, {}, [], [station], {
            privateCompanyId: 'cwi',
            playerId: 'alex'
        })
        expect(module.selection).toBe('powers')
        expect(module.titlePower).toBe(station)
        // Nothing manual was chosen, so Undo reaches the purchase itself.
        expect(module.hasManual()).toBe(false)
        expect(module.undo()).toBe(false)
        module.close()
        expect(module.selection).toBeUndefined()
        expect(module.titlePower).toBeUndefined()
    })

    it('ignores an offer for a power that cannot be used now', () => {
        const { module } = privateActions([Alpha], {}, {}, [], [], {
            privateCompanyId: 'cwi',
            playerId: 'alex'
        })
        expect(module.selection).toBeUndefined()
    })
})
