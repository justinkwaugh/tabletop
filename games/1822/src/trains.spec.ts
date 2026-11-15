import { describe, expect, it } from 'vitest'
import {
    ElectricTrainId,
    ExtraTrainIds1822,
    LocalTrainId,
    MinorTrainLimits1822,
    Phases1822,
    PrivateTrains1822,
    PullmanTrainId,
    TrainDepot1822,
    revenueStages1822
} from './trains.js'

const definition = (id: string) => TrainDepot1822.trainDefinition(id)

describe('the rolling stock (§5.5, Table 7)', () => {
    it('supplies 22 L/2 cards, nine 3s, six 4s, three 5s and three 6s', () => {
        const counts: Record<string, number> = {}
        for (const train of TrainDepot1822.createInventory().trains)
            counts[train.definitionId] = (counts[train.definitionId] ?? 0) + 1
        expect(counts).toEqual({ L: 22, '3': 9, '4': 6, '5': 3, '6': 3 })
    })

    it('prints L and 2 on one card and 7 and E on another, without limit (§5.5.7, §5.5.8)', () => {
        expect(TrainDepot1822.certificateDefinitions('2')).toEqual([LocalTrainId, '2'])
        expect(TrainDepot1822.certificateDefinitions(ElectricTrainId)).toEqual([
            '7',
            ElectricTrainId
        ])
        const inventory = TrainDepot1822.createInventory()
        expect(TrainDepot1822.remaining(inventory, ElectricTrainId)).toBe('unlimited')
        expect(TrainDepot1822.remaining(inventory, '2')).toBe(22)
    })

    it('prices the trains', () => {
        expect(['L', '2', '3', '4', '5', '6', '7', 'E'].map((id) => definition(id).price)).toEqual([
            60, 120, 200, 300, 500, 600, 750, 1000
        ])
    })

    it('runs an L train at its station, with one small station if it likes (§5.5.3)', () => {
        expect(definition(LocalTrainId).distance).toEqual({
            measure: 'revenue-centers',
            maximum: 1,
            extraTowns: 1,
            stationRun: true
        })
        expect(definition('LP').distance).toEqual(definition(LocalTrainId).distance)
    })

    it('counts every station against a numbered train (§5.5.4)', () => {
        for (const stops of [2, 3, 4, 5, 6, 7])
            expect(definition(String(stops)).distance).toEqual({
                measure: 'revenue-centers',
                maximum: stops
            })
        expect(definition('2P').distance).toEqual(definition('2').distance)
    })

    it('runs an E train any distance on track other trains use (§5.5.8, §5.5.11)', () => {
        expect(definition(ElectricTrainId)).toMatchObject({
            distance: { maximum: 'unlimited' },
            sharesTrack: true
        })
    })

    it('makes L, 2, 3 and 4 obsolete with the first 3, 4, 6 and 7 or E', () => {
        expect(['L', '2', '3', '4'].map((id) => Phases1822.rustPhaseId(id))).toEqual([
            '3',
            '4',
            '6',
            '7'
        ])
        for (const id of ['5', '6', '7', 'E', '2P', 'LP', PullmanTrainId])
            expect(Phases1822.rustPhaseId(id)).toBeUndefined()
    })

    it('keeps the private companies’ trains out of the bank (§3.1.18)', () => {
        expect(
            Object.fromEntries(
                Object.entries(PrivateTrains1822).map(([id, train]) => [id, train.definitionId])
            )
        ).toEqual({ P1: '5', P3: '2P', P4: '2P', P13: 'P+', P14: 'P+', P19: 'LP' })
        expect(definition(PullmanTrainId).attachment).toBe(true)
        expect(ExtraTrainIds1822).toEqual(['2P', 'LP', 'P+'])
        expect(TrainDepot1822.purchaseDefinitionIds()).toEqual([
            'L',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            'E'
        ])
    })
})

describe('the phases (§2.2, Table 2)', () => {
    it('add tiles, rounds and train limits as printed', () => {
        expect(
            Phases1822.phases.map(({ id, tileColors, operatingRounds, trainLimit }) => [
                id,
                tileColors.at(-1),
                operatingRounds,
                trainLimit,
                MinorTrainLimits1822[id]
            ])
        ).toEqual([
            ['1', 'yellow', 1, 4, 2],
            ['2', 'yellow', 2, 4, 2],
            ['3', 'green', 2, 4, 2],
            ['4', 'green', 2, 3, 1],
            ['5', 'brown', 2, 2, 1],
            ['6', 'brown', 2, 2, 1],
            ['7', 'gray', 2, 2, 1]
        ])
    })

    it('start with the first train of each type, a 3 bought first skipping phase 2 (§2.3)', () => {
        expect(Phases1822.phaseAfterPurchase('1', 'L')).toBe('1')
        expect(Phases1822.phaseAfterPurchase('1', '2')).toBe('2')
        expect(Phases1822.phaseAfterPurchase('1', '3')).toBe('3')
        expect(Phases1822.phaseAfterPurchase('6', '7')).toBe('7')
        expect(Phases1822.phaseAfterPurchase('6', 'E')).toBe('7')
        expect(Phases1822.phaseAfterPurchase('7', '2')).toBe('7')
    })

    it('pay grey areas their yellow, green, brown and grey values (§5.4.5)', () => {
        expect(
            ['1', '2', '3', '4', '5', '6', '7'].map((id) => revenueStages1822(id).at(-1))
        ).toEqual(['yellow', 'yellow', 'green', 'green', 'brown', 'brown', 'gray'])
    })
})
