import { describe, expect, it } from 'vitest'
import {
    EighteenUSACompanySizes,
    EighteenUSAPhases,
    EighteenUSATrainDepot,
    ObsoleteTrainIds,
    PullmanTrainId,
    trainSupplyVariant,
    type TrainRoster
} from './index.js'

const roster = (playerCount: number, kind: TrainRoster = 'standard') => {
    const inventory = EighteenUSATrainDepot.createInventory(trainSupplyVariant(playerCount, kind))
    return Object.fromEntries(
        EighteenUSATrainDepot.purchaseDefinitionIds().map((id) => [
            id,
            EighteenUSATrainDepot.remaining(inventory, id)
        ])
    )
}

describe('the 18USA trains', () => {
    it('supplies the roster for five or more players', () => {
        expect(roster(5)).toEqual({
            '2': 40,
            '2+': 5,
            '3': 12,
            '3+': 2,
            '4': 8,
            '4+': 1,
            '5': 6,
            '6': 5,
            '7': 3,
            '8': 'unlimited',
            [PullmanTrainId]: 'unlimited'
        })
        expect(roster(7)).toEqual(roster(5))
    })

    it('holds back one 2+, 4, 5 and 6 with two to four players', () => {
        expect(roster(3)).toMatchObject({
            '2+': 4,
            '3+': 2,
            '4': 7,
            '4+': 1,
            '5': 5,
            '6': 4,
            '7': 3
        })
        expect(roster(2)).toEqual(roster(4))
    })

    it('offers the 1817 roster as a variant, with Pullmans', () => {
        for (const playerCount of [2, 6])
            expect(roster(playerCount, '1817')).toEqual({
                '2': 40,
                '2+': 4,
                '3': 12,
                '3+': 0,
                '4': 8,
                '4+': 0,
                '5': 5,
                '6': 4,
                '7': 3,
                '8': 'unlimited',
                [PullmanTrainId]: 'unlimited'
            })
    })

    it('prices and rusts the trains', () => {
        const train = (id: string) => EighteenUSATrainDepot.trainDefinition(id)
        expect(
            ['2', '2+', '3', '3+', '4', '4+', '5', '6', '7', '8', 'P'].map((id) => [
                train(id).price,
                train(id).rustsOn
            ])
        ).toEqual([
            [100, '4'],
            [100, '4'],
            [250, '6'],
            [250, '6'],
            [400, '8'],
            [400, '8'],
            [600, undefined],
            [750, undefined],
            [900, undefined],
            [1100, undefined],
            [200, undefined]
        ])
        expect(ObsoleteTrainIds).toEqual(['2+', '3+', '4+'])
        expect(train(PullmanTrainId).attachment).toBe(true)
    })

    it('runs the phases of §8', () => {
        expect(
            EighteenUSAPhases.phases.map((phase) => [
                phase.id,
                phase.tileColors.at(-1),
                phase.trainLimit,
                phase.operatingRounds,
                EighteenUSACompanySizes[phase.id]
            ])
        ).toEqual([
            ['2', 'yellow', 4, 2, [2]],
            ['3', 'green', 4, 2, [2, 5]],
            ['4', 'green', 3, 2, [5]],
            ['5', 'brown', 3, 2, [5, 10]],
            ['6', 'brown', 2, 2, [10]],
            ['7', 'gray', 2, 2, [10]],
            ['8', 'gray', 2, 2, [10]]
        ])
        expect(EighteenUSAPhases.phaseAfterPurchase('3', '3+')).toBe('3')
        expect(EighteenUSAPhases.rustPhaseId('2+')).toBe('4')
    })
})
