import { describe, expect, it } from 'vitest'
import { validateTrackStep } from './trackConstruction.js'

const operatingSet = { companyOrder: ['A'] }
const finishedTrack = { companyId: 'A', lays: [], completed: true }
const openStations = { companyId: 'A', completed: false }

describe('validateTrackStep', () => {
    it('lets finished track wait for Finish Stations where stations are placed with track', () => {
        const state = {
            machineState: 'LayingTrack',
            trackStep: finishedTrack,
            stationStep: openStations,
            operatingSet
        }
        expect(() => validateTrackStep(state, { stationsWithTrack: true })).not.toThrow()
    })

    it('rejects finished track still laying where stations have their own step', () => {
        const state = {
            machineState: 'LayingTrack',
            trackStep: finishedTrack,
            stationStep: openStations,
            operatingSet
        }
        expect(() => validateTrackStep(state)).toThrow(
            'Track completion does not match the machine state'
        )
    })

    it('rejects finished track still laying once its stations are finished', () => {
        const state = {
            machineState: 'LayingTrack',
            trackStep: finishedTrack,
            stationStep: { ...openStations, completed: true },
            operatingSet
        }
        expect(() => validateTrackStep(state, { stationsWithTrack: true })).toThrow(
            'Track completion does not match the machine state'
        )
    })

    it('requires finished track to place stations', () => {
        const state = {
            machineState: 'PlacingStation',
            trackStep: { ...finishedTrack, completed: false },
            operatingSet
        }
        expect(() => validateTrackStep(state)).toThrow(
            'Track completion does not match the machine state'
        )
    })
})
