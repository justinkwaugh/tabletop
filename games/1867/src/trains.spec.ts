import { describe, expect, it } from 'vitest'
import {
    PhaseEightTrainIds1867,
    Phases1867,
    TrainDepot1867,
    TrainExportPhaseIds,
    TrainLimits1867,
    TrainSupply1867,
    revenueStages1867,
    trainSupply1867
} from './trains.js'

function supply(variant?: string) {
    const inventory = TrainDepot1867.createInventory(variant)
    return Object.fromEntries(
        TrainDepot1867.definition.supply.map(({ definitionId }) => [
            definitionId,
            TrainDepot1867.remaining(inventory, definitionId)
        ])
    )
}

describe('the trains and phases', () => {
    it('sell the trains of the train yard at their prices (§11)', () => {
        expect(
            TrainDepot1867.definition.trains.map(({ id, price, rustsOn }) => [
                id,
                price,
                rustsOn ?? null
            ])
        ).toEqual([
            ['2', 100, '4'],
            ['3', 225, '6'],
            ['4', 350, '8'],
            ['5', 550, null],
            ['6', 650, null],
            ['7', 800, null],
            ['8', 1000, null],
            ['5+5E', 1500, null],
            ['2+2', 600, null]
        ])
        expect(supply()).toEqual({
            '2': 10,
            '3': 7,
            '4': 4,
            '5': 4,
            '6': 2,
            '7': 2,
            '8': 'unlimited',
            '5+5E': 2,
            '2+2': 2
        })
    })

    it('supplies unlimited special trains unless two each are chosen, and fewer for two players (§14, §16.1.1)', () => {
        expect(trainSupply1867(true, 4)).toBe(TrainSupply1867.unlimited)
        expect(trainSupply1867(false, 4)).toBeUndefined()
        expect(supply(trainSupply1867(true, 4))).toMatchObject({
            '5+5E': 'unlimited',
            '2+2': 'unlimited'
        })
        expect(supply(trainSupply1867(false, 2))).toMatchObject({
            '2': 7,
            '3': 5,
            '4': 3,
            '5': 3,
            '6': 1,
            '7': 1,
            '5+5E': 2
        })
        expect(supply(trainSupply1867(true, 2))).toMatchObject({ '2': 7, '2+2': 'unlimited' })
        expect(PhaseEightTrainIds1867).toEqual(['5+5E', '2+2'])
    })

    it('add green tiles in 3, brown in 5 and grey only in 7 (§11)', () => {
        expect(Phases1867.phases.map((phase) => phase.tileColors.at(-1))).toEqual([
            'yellow',
            'green',
            'green',
            'brown',
            'brown',
            'gray',
            'gray'
        ])
    })

    it('limit trains by phase (§11)', () => {
        expect(Phases1867.phases.map(({ id }) => TrainLimits1867[id])).toEqual([
            { minor: 2 },
            { minor: 2, major: 4 },
            { minor: 1, major: 3 },
            { minor: 1, major: 3 },
            { minor: 1, major: 2 },
            { minor: 1, major: 2 },
            { major: 2 }
        ])
    })

    it('raise off-board values to brown in 5 and grey in 7 (§11)', () => {
        expect(Phases1867.phases.map(({ id }) => revenueStages1867(id).at(-1))).toEqual([
            'yellow',
            'green',
            'green',
            'brown',
            'brown',
            'gray',
            'gray'
        ])
    })

    it('has the CN export a train in phases 4 to 7 (§8.13)', () => {
        expect(TrainExportPhaseIds).toEqual(['4', '5', '6', '7'])
    })
})
