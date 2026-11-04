import { describe, expect, it } from 'vitest'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenNinetyFourScenarios } from './scenarios/index.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import type { EighteenNinetyFourState } from './state.js'

/** Mechelen is a green #14 holding the Belge's home and a PLM station, in phase 5+1. */
function greenMechelen(state: EighteenNinetyFourState) {
    state.phaseId = '5+1'
    state.tileInventory = EighteenNinetyFourTileSet.createInventory([
        { locationId: 'E16', definitionId: '18xx:14', rotation: 0 },
        { locationId: 'F15', definitionId: '1894:X2', rotation: 3 }
    ])
    state.stations = state.stations.map((station) =>
        station.id === 'PLM:station:1'
            ? {
                  ...station,
                  status: 'placed',
                  position: { locationId: 'E16', nodeId: 'city', slot: 1 }
              }
            : station
    )
}
const splitLay = {
    companyId: 'Belge',
    locationId: 'E16',
    definitionId: '1894:X16',
    rotation: 0,
    nodeMapping: {},
    expectedCost: 0
}
const stationAt = (state: EighteenNinetyFourState, id: string) =>
    state.stations.find((station) => station.id === id)

describe('splitting a green city (§12.3.2, §7.3.8)', () => {
    it('sets both stations aside and has the acting company return its own at once', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, greenMechelen)
        play.act('LayTile', splitLay)
        expect(stationAt(play.state, 'Belge:home')?.status).toBe('displaced')
        expect(stationAt(play.state, 'PLM:station:1')?.status).toBe('displaced')
        const president = play.state.activePlayerIds[0]
        expect(play.valid(president)).toEqual(['ReturnStation', 'SetRunInstruction'])
        play.act('ReturnStation', {
            stationId: 'Belge:home',
            position: { locationId: 'E16', nodeId: 'city-1', slot: 0 }
        })
        expect(stationAt(play.state, 'Belge:home')).toMatchObject({
            status: 'placed',
            position: { locationId: 'E16', nodeId: 'city-1', slot: 0 }
        })
        expect(play.valid(president)).toContain('FinishTrack')
    })

    it('keeps the hex’s spaces for set-aside stations, which may share a city', () => {
        const play = playExample(EighteenNinetyFourScenarios, 'construction', 3, greenMechelen)
        play.act('LayTile', splitLay)
        play.act('ReturnStation', {
            stationId: 'Belge:home',
            position: { locationId: 'E16', nodeId: 'city-0', slot: 0 }
        })
        // The PLM's station waits for the end of the Belge's turn; it may join the Belge's city.
        expect(
            play.state.stations.filter((station) => station.status === 'displaced')
        ).toHaveLength(1)
        play.act('FinishTrack', { companyId: 'Belge' })
        for (let guard = 0; guard < 12 && play.state.machineState !== 'OperatingSet'; guard++) {
            const actions = play.valid(play.state.activePlayerIds[0])
            const companyId = 'Belge'
            if (actions.includes('FinishStations')) play.act('FinishStations', { companyId })
            else if (actions.includes('RunTrains')) play.act('RunTrains', { companyId, routes: [] })
            else if (actions.includes('DistributeEarnings'))
                play.act('DistributeEarnings', { companyId, choice: 'withhold' })
            else if (actions.includes('FinishOperatingTurn'))
                play.act('FinishOperatingTurn', { companyId })
            else if (actions.includes('ReturnStation')) break
            else throw new Error(`Unexpected actions ${actions.join(',')}`)
        }
        const plmPresident = play.state.activePlayerIds[0]
        expect(play.valid(plmPresident)).toEqual(['ReturnStation', 'SetRunInstruction'])
        play.act('ReturnStation', {
            stationId: 'PLM:station:1',
            position: { locationId: 'E16', nodeId: 'city-0', slot: 1 }
        })
        expect(stationAt(play.state, 'PLM:station:1')).toMatchObject({
            status: 'placed',
            position: { locationId: 'E16', nodeId: 'city-0', slot: 1 }
        })
        expect(play.state.stations.some((station) => station.status === 'displaced')).toBe(false)
    })
})
