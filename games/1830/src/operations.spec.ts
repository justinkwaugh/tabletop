import { describe, expect, it } from 'vitest'
import { TrackConstruction, applyStationPlacement, cashOwnedBy, getCompany } from '@tabletop/18xx'
import { exampleGame, playExample } from '@tabletop/18xx/scenarios'
import { EighteenThirtyScenarios, completeOpeningAuction } from './scenarios/index.js'
import { EighteenThirtyTileSet, EighteenThirtyTrackRules } from './index.js'

describe('company flotation', () => {
    it('floats NYC at 60% sold with ten times its $100 par', () => {
        const play = playExample(EighteenThirtyScenarios, 'opening', 3)
        const act = play.act
        const player = () => ({ kind: 'player', playerId: play.state.activePlayerIds[0] }) as const
        completeOpeningAuction(play)
        expect(play.state.machineState).toBe('StockRound')
        act('StartCompany', {
            buyer: player(),
            companyId: 'NYC',
            marketSpaceId: '0:6',
            expectedPrice: 200
        })
        act('FinishStockTurn')
        for (const share of [1, 2, 3]) {
            act('BuyShares', {
                buyer: player(),
                certificateId: `NYC:share:${share}`,
                expectedPrice: 100
            })
            act('FinishStockTurn')
        }
        expect(getCompany(play.state, 'NYC').floated).toBe(false)
        act('BuyShares', { buyer: player(), certificateId: 'NYC:share:4', expectedPrice: 100 })
        expect(getCompany(play.state, 'NYC').floated).toBe(true)
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'NYC' })).toBe(1000)
    })
})

describe('track construction', () => {
    function construction(
        placements: Parameters<typeof EighteenThirtyTileSet.createInventory>[0],
        phaseId = '3',
        stationLocationId?: string
    ) {
        const { state } = exampleGame(EighteenThirtyScenarios, 'construction', 3)
        expect(state.trackStep?.companyId).toBe('PRR')
        const prepared = {
            ...state,
            phaseId,
            tileInventory: EighteenThirtyTileSet.createInventory(placements)
        }
        if (stationLocationId)
            applyStationPlacement(prepared, {
                companyId: 'PRR',
                stationId: 'PRR:station:1',
                position: { locationId: stationLocationId, nodeId: 'city', slot: 0 },
                cost: 0
            })
        return new TrackConstruction(prepared, EighteenThirtyTrackRules)
    }
    const BuiltTrack = [
        { locationId: 'H10', definitionId: '18xx:57', rotation: 1 },
        { locationId: 'H14', definitionId: '18xx:9', rotation: 1 },
        { locationId: 'H16', definitionId: '18xx:57', rotation: 1 }
    ] as const

    it('builds only where the company connects', () => {
        const track = construction([])
        expect(track.choices('H14').length).toBeGreaterThan(0)
        expect(track.choices('E3')).toEqual([])
        expect(track.choices('G7')).toEqual([])
    })

    it('stops track at the impassable border south-east of Ottawa', () => {
        const ottawa = (rotation: 1 | 2) =>
            construction([{ locationId: 'B16', definitionId: '18xx:57', rotation }], '3', 'B16')
        expect(ottawa(1).choices('B18').length).toBeGreaterThan(0)
        expect(ottawa(2).choices('C17')).toEqual([])
    })

    it('upgrades Philadelphia & Trenton from its printed cities to green and brown OO tiles', () => {
        const green = construction([...BuiltTrack])
        expect(new Set(green.choices('H18').map((choice) => choice.definitionId))).toEqual(
            new Set(['18xx:59'])
        )
        const brown = construction(
            [...BuiltTrack, { locationId: 'H18', definitionId: '18xx:59', rotation: 5 }],
            '5'
        )
        const upgrades = new Set(brown.choices('H18').map((choice) => choice.definitionId))
        expect(upgrades.size).toBeGreaterThan(0)
        for (const id of upgrades) expect(['64', '65', '66', '67', '68']).toContain(id.slice(5))
    })
})
