import { describe, expect, it } from 'vitest'
import { TrackConstruction } from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { laidTiles } from '@tabletop/18xx/testing'
import {
    EighteenThirtyTwoTileSet,
    EighteenThirtyTwoTrackRules,
    unpromotedMediumCities
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

// Savannah's track runs northwest through T27 to Augusta, a medium city with a straight town.
const ToAugusta = [
    { locationId: 'U28', definitionId: '18xx:57', rotation: 2 },
    { locationId: 'T27', definitionId: '18xx:9', rotation: 2 },
    { locationId: 'S26', definitionId: '18xx:4', rotation: 2 }
] as const

function augusta(phaseId: string, lays: { locationId: string; color: string }[] = []) {
    const { state } = exampleGame(EighteenThirtyTwoScenarios, 'construction', 3)
    const tileInventory = EighteenThirtyTwoTileSet.createInventory(ToAugusta)
    return new TrackConstruction(
        {
            ...state,
            phaseId,
            tileInventory,
            trackStep: {
                companyId: 'CG',
                lays: laidTiles(tileInventory, EighteenThirtyTwoTileSet, lays),
                completed: false
            }
        },
        EighteenThirtyTwoTrackRules
    )
}
const upgrades = (track: TrackConstruction) =>
    new Set(track.choices('S26').map((choice) => choice.definitionId))

describe('medium cities', () => {
    it('upgrade their yellow town to a yellow city or a green town from phase 3', () => {
        expect(upgrades(augusta('3'))).toEqual(new Set(['18xx:57', '18xx:141', '18xx:142']))
    })

    it('stay towns in phase 2', () => {
        expect(upgrades(augusta('2'))).toEqual(new Set())
    })

    it('make the yellow city the turn’s one upgrade', () => {
        expect(upgrades(augusta('3', [{ locationId: 'R25', color: 'yellow' }]))).toEqual(new Set())
        const promoted = (lays: { locationId: string; definitionId: string }[]) =>
            new TrackConstruction(
                {
                    ...exampleGame(EighteenThirtyTwoScenarios, 'construction', 3).state,
                    phaseId: '3',
                    tileInventory: EighteenThirtyTwoTileSet.createInventory([
                        ...ToAugusta.slice(0, 2),
                        { locationId: 'S26', definitionId: '18xx:57', rotation: 2 }
                    ]),
                    trackStep: { companyId: 'CG', lays, completed: false }
                },
                EighteenThirtyTwoTrackRules
            )
        expect(promoted([]).choices('R25').length).toBeGreaterThan(0)
        expect(promoted([{ locationId: 'S26', definitionId: '18xx:57' }]).choices('R25')).toEqual(
            []
        )
    })

    it('take only a town tile as their first tile', () => {
        const { state } = exampleGame(EighteenThirtyTwoScenarios, 'construction', 3)
        const track = new TrackConstruction(
            {
                ...state,
                phaseId: '3',
                tileInventory: EighteenThirtyTwoTileSet.createInventory(ToAugusta.slice(0, 2))
            },
            EighteenThirtyTwoTrackRules
        )
        expect(new Set(track.choices('S26').map((choice) => choice.definitionId))).toEqual(
            new Set(['18xx:3', '18xx:4', '18xx:58'])
        )
    })
})

it('keeps a medium city’s marker until its tile is upgraded', () => {
    const { state } = exampleGame(EighteenThirtyTwoScenarios, 'construction', 3)
    const marked = (placements: Parameters<typeof EighteenThirtyTwoTileSet.createInventory>[0]) =>
        unpromotedMediumCities({
            ...state,
            tileInventory: EighteenThirtyTwoTileSet.createInventory(placements)
        })
    expect(marked([])).toEqual(['Q20', 'S26', 'T21', 'T23', 'U18', 'Y26'])
    expect(marked([{ locationId: 'S26', definitionId: '18xx:4', rotation: 2 }])).toContain('S26')
    expect(marked([{ locationId: 'S26', definitionId: '18xx:57', rotation: 2 }])).not.toContain(
        'S26'
    )
})
