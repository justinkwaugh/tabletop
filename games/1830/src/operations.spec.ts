import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    TrackConstruction,
    cashOwnedBy,
    getCompany,
    EighteenXXStateValidator,
    type EighteenXXState
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { EighteenThirtyScenarios } from './scenarios/index.js'
import { EighteenThirtyTileSet, EighteenThirtyTrackRules } from './index.js'

describe('company flotation', () => {
    it('floats at 60% sold with ten times par', () => {
        const { game, engine, state: initial } = exampleGame(EighteenThirtyScenarios, 'starting', 3)
        let state: EighteenXXState = initial
        const act = (type: string, fields: object = {}) => {
            const action: GameAction = {
                id: `action:${state.actionCount}`,
                gameId: game.id,
                source: ActionSource.User,
                playerId: state.activePlayerIds[0],
                type,
                ...fields
            }
            state = engine.executeCanonicalAction({ game, state, action }).updatedState
            expect(EighteenXXStateValidator.Check(state)).toBe(true)
        }
        const player = () => ({ kind: 'player', playerId: state.activePlayerIds[0] }) as const
        act('StartCompany', {
            buyer: player(),
            companyId: 'CO',
            marketSpaceId: '5:6',
            expectedPrice: 134
        })
        act('FinishStockTurn')
        for (const share of [1, 2, 3]) {
            act('BuyShares', {
                buyer: player(),
                certificateId: `CO:share:${share}`,
                expectedPrice: 67
            })
            act('FinishStockTurn')
        }
        expect(getCompany(state, 'CO').floated).toBe(false)
        act('BuyShares', { buyer: player(), certificateId: 'CO:share:4', expectedPrice: 67 })
        expect(getCompany(state, 'CO').floated).toBe(true)
        expect(cashOwnedBy(state, { kind: 'company', companyId: 'CO' })).toBe(670)
    })
})

describe('track construction', () => {
    function construction(
        placements: Parameters<typeof EighteenThirtyTileSet.createInventory>[0],
        phaseId = '3'
    ) {
        const { state } = exampleGame(EighteenThirtyScenarios, 'construction', 3)
        expect(state.trackStep?.companyId).toBe('PRR')
        return new TrackConstruction(
            { ...state, phaseId, tileInventory: EighteenThirtyTileSet.createInventory(placements) },
            EighteenThirtyTrackRules
        )
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
