import { expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import {
    getCompany,
    issueShareCertificates,
    addCompanyStations,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenSeventeenScenarios } from './scenarios/index.js'
import { removableStations, stationsOverLimit } from './mergerRules.js'
import { mergerRoundCompanyId } from './mergerRound.js'
import { isRemoveStation, type RemoveStation } from './companyExcess.js'
import { passUntil } from '../test/passTurns.js'

function newYorkStations(state: EighteenXXState) {
    getCompany(state, 'PLE').shareCount = 5
    issueShareCertificates(state, 'PLE', 3, { owner: { kind: 'player', playerId: 'alex' } })
    const home = state.stations.find((station) => station.id === 'BA:home')
    const other = state.stations.find(
        (station) => station.companyId === 'BA' && station.status === 'available'
    )
    assertExists(home, 'BA has a home station')
    assertExists(other, 'BA has an available station')
    expect(home.status).toBe('placed')
    state.stations = state.stations.map((station) => {
        if (station.id === other.id && home.status === 'placed') return { ...home, id: other.id }
        if (station.id === 'BA:home' || station.id === 'PLE:home')
            return {
                id: station.id,
                companyId: station.companyId,
                status: 'placed',
                position: {
                    locationId: 'E22',
                    nodeId: station.id === 'BA:home' ? 'city-0' : 'city-1',
                    slot: 0
                }
            }
        return station
    })
}

it.each(['merger', 'acquisition'] as const)(
    '%s resolves New York before continuing, and either station can return to the charter',
    (mode) => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, newYorkStations)
        passUntil(play, (state) => state.machineState === 'MergerRound')
        if (mode === 'merger') play.act('MergeCompanies', { companyId: 'BA', targetId: 'PLE' })
        else {
            while (play.state.machineState === 'MergerRound')
                play.act('PassMerger', { companyId: mergerRoundCompanyId(play.state) })
            play.act('OfferCompany', { companyId: 'PLE' })
            play.act('BidToAcquire', { companyId: 'PLE', amount: 300 })
        }
        const state = play.state
        const { game, engine } = play
        expect(state.machineState).toBe('ReducingStations')
        expect(stationsOverLimit(state, 'BA')).toBe(0)
        const choices = removableStations(state, 'BA')
        expect(choices.map((station) => station.position.nodeId).sort()).toEqual([
            'city-0',
            'city-1'
        ])
        const playerId = state.activePlayerIds[0]
        expect(play.valid(playerId)).toEqual(['RemoveStation'])
        const unrelated = state.stations.find(
            (station) =>
                station.companyId === 'BA' &&
                station.status === 'placed' &&
                station.position.locationId !== 'E22'
        )
        assertExists(unrelated, 'BA has a station outside New York')
        const action: RemoveStation = {
            id: 'choose-station',
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            type: 'RemoveStation',
            companyId: 'BA',
            stationId: unrelated.id
        }
        expect(() => engine.executeCanonicalAction({ game, state, action })).toThrow()
        for (const station of choices) {
            const choice: RemoveStation = { ...action, stationId: station.id }
            expect(() =>
                engine.executeCanonicalAction({
                    game,
                    state,
                    action: { ...choice, playerId: 'casey' }
                })
            ).toThrow()
            const result = engine.executeCanonicalAction({
                game,
                state,
                action: choice
            })
            expect(result.updatedState.stations.find((entry) => entry.id === station.id)).toEqual({
                id: station.id,
                companyId: 'BA',
                status: 'available'
            })
            expect(
                result.updatedState.stations.filter(
                    (entry) =>
                        entry.companyId === 'BA' &&
                        entry.status === 'placed' &&
                        entry.position.locationId === 'E22'
                )
            ).toHaveLength(1)
            expect(result.updatedState.machineState).toBe(
                mode === 'merger' ? 'TradingConvertedShares' : 'AcquisitionLoans'
            )
            const recorded = result.processedActions[0]
            if (!isRemoveStation(recorded)) throw Error('Station removal is recorded')
            expect(recorded.metadata).toEqual({
                locationId: 'E22',
                destination: 'available'
            })
            let replay = state
            for (const processed of result.processedActions)
                replay = engine.applyProcessedAction({ game, state: replay, action: processed })
            expect(replay).toEqual(result.updatedState)
            for (const processed of [...result.processedActions].reverse())
                replay = engine.undoProcessedAction({ state: replay, action: processed })
            expect(replay).toEqual(state)
        }
    }
)

it('resolves a duplicate hex before other placed stations above the eight-piece limit', () => {
    const play = playExample(EighteenSeventeenScenarios, 'construction', 3, newYorkStations)
    passUntil(play, (state) => state.machineState === 'MergerRound')
    play.act('MergeCompanies', { companyId: 'BA', targetId: 'PLE' })
    const state = structuredClone(play.state)
    addCompanyStations(state, 'BA', 7)
    const locations = ['B5', 'B17', 'C14', 'C22', 'F3', 'F13', 'F19']
    let index = 0
    state.stations = state.stations.map((station) =>
        station.companyId === 'BA' && station.status === 'available'
            ? {
                  ...station,
                  status: 'placed',
                  position: { locationId: locations[index++], nodeId: 'city', slot: 0 }
              }
            : station
    )
    play.replaceState(state)
    expect(stationsOverLimit(play.state, 'BA')).toBe(2)
    expect(
        removableStations(play.state, 'BA').map((station) => station.position.locationId)
    ).toEqual(['E22', 'E22'])
    play.act('RemoveStation', { companyId: 'BA', stationId: 'BA:home' })
    expect(play.state.machineState).toBe('ReducingStations')
    expect(stationsOverLimit(play.state, 'BA')).toBe(1)
    expect(play.state.stations.find((station) => station.id === 'BA:home')?.status).toBe('removed')
    const remaining = removableStations(play.state, 'BA')
    expect(remaining).toHaveLength(9)
    const choice = remaining.find((station) => station.position.locationId === 'B5')
    assertExists(choice, 'Stations outside New York are now eligible')
    play.act('RemoveStation', { companyId: 'BA', stationId: choice.id })
    expect(stationsOverLimit(play.state, 'BA')).toBe(0)
    expect(play.state.machineState).toBe('TradingConvertedShares')
})
