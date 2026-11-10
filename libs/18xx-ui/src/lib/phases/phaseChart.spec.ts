import { expect, it } from 'vitest'
import { PhaseTable, TrainDepot, type Train } from '@tabletop/18xx'
import {
    certificateRemaining,
    createPhaseChart,
    currentDepotCertificates,
    marketCertificates,
    trainRosterRows
} from './phaseChart.js'

const distance = (maximum: number) => ({ measure: 'revenue-centers' as const, maximum })

it('lists every face of paired certificates by price with one shared supply identity', () => {
    const depot = new TrainDepot({
        id: 'paired',
        trains: [
            {
                id: '4',
                name: '4',
                price: 180,
                distance: { measure: 'revenue-centers', maximum: 4 }
            },
            {
                id: '3/5',
                name: '3/5',
                price: 160,
                distance: { measure: 'revenue-centers', maximum: 5 }
            }
        ],
        supply: [{ definitionId: '4', variantDefinitionIds: ['3/5'], count: 4 }]
    })
    const phases = new PhaseTable(
        [{ id: 'II', startedBy: [], tileColors: ['yellow'], operatingRounds: 2, trainLimit: 4 }],
        depot
    )
    const chart = createPhaseChart({ phases, depot })
    expect(chart.trains.map(({ id, price, supplyId }) => ({ id, price, supplyId }))).toEqual([
        { id: '3/5', price: 160, supplyId: '4' },
        { id: '4', price: 180, supplyId: '4' }
    ])
})

it('counts a paired certificate once, cheaper face first, and other trains separately', () => {
    const depot = new TrainDepot({
        id: 'paired',
        trains: [
            { id: '4', name: '4', price: 180, distance: distance(4) },
            { id: '3/5', name: '3/5', price: 160, distance: distance(5) },
            { id: '6', name: '6', price: 300, distance: distance(6) },
            { id: 'D', name: 'D', price: 900, distance: distance(99) },
            { id: '8', name: '8', price: 800, distance: distance(8) }
        ],
        supply: [
            { definitionId: '4', variantDefinitionIds: ['3/5'], count: 4 },
            { definitionId: '6', count: 1 },
            { definitionId: '8', count: 2 },
            { definitionId: 'D', count: 'unlimited' }
        ]
    })
    const inventory = depot.createInventory()
    inventory.trains = inventory.trains.filter((train) => train.definitionId !== '6')
    expect(
        currentDepotCertificates({
            depot,
            inventory,
            availableDefinitionIds: ['4', '3/5', '6', '8', 'D']
        })
    ).toEqual([
        { definitionIds: ['3/5', '4'], remaining: 4 },
        { definitionIds: ['8'], remaining: 2 },
        { definitionIds: ['D'], remaining: 'unlimited' }
    ])
})

it('counts discarded trains in the open market by certificate, in supply order', () => {
    const depot = new TrainDepot({
        id: 'paired',
        trains: [
            { id: '2', name: '2', price: 80, distance: distance(2) },
            { id: '4', name: '4', price: 180, distance: distance(4) },
            { id: '3/5', name: '3/5', price: 160, distance: distance(5) },
            { id: '6', name: '6', price: 300, distance: distance(6) }
        ],
        supply: [
            { definitionId: '2', count: 3 },
            { definitionId: '4', variantDefinitionIds: ['3/5'], count: 3 },
            { definitionId: '6', count: 2 }
        ]
    })
    const owner = { kind: 'company' as const, companyId: 'A' }
    const trains: Train[] = [
        { id: '2/1', definitionId: '2', status: 'market' },
        { id: '2/2', definitionId: '2', status: 'market' },
        { id: '4/4', definitionId: '3/5', status: 'market' },
        { id: '4/5', definitionId: '4', status: 'owned', owner },
        { id: '4/6', definitionId: '4', status: 'depot' },
        { id: '6/7', definitionId: '6', status: 'depot' }
    ]
    const inventory = { trains, nextTrainNumber: 8 }
    expect(marketCertificates({ depot, inventory })).toEqual([
        { definitionIds: ['2'], remaining: 2 },
        { definitionIds: ['3/5', '4'], remaining: 1 }
    ])
})

it('has no open-market certificates while nothing has been discarded', () => {
    const depot = new TrainDepot({
        id: 'plain',
        trains: [{ id: '2', name: '2', price: 80, distance: distance(2) }],
        supply: [{ definitionId: '2', count: 2 }]
    })
    expect(marketCertificates({ depot, inventory: depot.createInventory() })).toEqual([])
})

it('finds the count of the certificate a train face belongs to', () => {
    const certificates = [{ definitionIds: ['3/5', '4'], remaining: 2 }]
    expect(certificateRemaining(certificates, '4')).toBe(2)
    expect(certificateRemaining(certificates, '3/5')).toBe(2)
    expect(certificateRemaining(certificates, '6')).toBe(0)
})

const rosterTrain = (id: string, supplyId: string, rustPhaseId?: string) => ({
    id,
    name: id,
    price: 100,
    supplyId,
    rustTrainIds: [],
    rustPhaseId
})
const rowSpans = (trains: ReturnType<typeof rosterTrain>[]) =>
    trainRosterRows(trains).map(({ train, remainingRowSpan, rustRowSpan }) => [
        train.id,
        remainingRowSpan,
        rustRowSpan
    ])

it('spans one remaining and one rust cell across faces that rust together', () => {
    expect(
        rowSpans([
            rosterTrain('2', '2', 'III'),
            rosterTrain('2+1', '2', 'III'),
            rosterTrain('7+3', '7+3')
        ])
    ).toEqual([
        ['2', 2, 2],
        ['2+1', 0, 0],
        ['7+3', 1, 1]
    ])
})

it('keeps a rust cell per face when the faces of a certificate rust differently', () => {
    expect(rowSpans([rosterTrain('3/5', '4', 'III'), rosterTrain('4', '4', 'IV')])).toEqual([
        ['3/5', 2, 1],
        ['4', 0, 1]
    ])
})

it('keeps a rust cell per face when only the notes of a certificate differ', () => {
    const [cheaper, dearer] = [rosterTrain('3/5', '4', 'III'), rosterTrain('4', '4', 'III')]
    expect(
        trainRosterRows([{ ...cheaper, rustNote: 'Runs once more.' }, dearer]).map(
            ({ rustRowSpan }) => rustRowSpan
        )
    ).toEqual([1, 1])
})

const depot = new TrainDepot({
    id: 'chart',
    trains: [
        { id: '2', name: '2', price: 80, distance: distance(2), rustsOn: '4' },
        { id: '4', name: '4', price: 300, distance: distance(4), rustsOn: '8' },
        { id: '8', name: '8', price: 800, distance: distance(8) },
        { id: 'D', name: 'D', price: 1100, distance: distance(99) }
    ],
    supply: [
        { definitionId: '2', count: 2 },
        { definitionId: '4', count: 2 },
        { definitionId: '8', count: 2 },
        { definitionId: 'D', count: 'unlimited' }
    ]
})
const phase = (id: string, startedBy: string[]) => ({
    id,
    startedBy,
    tileColors: ['yellow'],
    operatingRounds: 1,
    trainLimit: 4
})
const phases = new PhaseTable(
    [phase('2', []), phase('4', ['4']), phase('8', ['8']), phase('D', ['D'])],
    depot
)

it('leaves out a variant’s phases and trains and keeps its permanent trains', () => {
    const chart = createPhaseChart({
        phases,
        depot,
        omittedPhaseIds: ['8'],
        omittedTrainIds: ['8'],
        permanentTrainIds: ['2'],
        rustPhases: { '4': 'D' }
    })
    expect(chart.phases.map((entry) => entry.id)).toEqual(['2', '4', 'D'])
    expect(chart.trains.map((train) => [train.id, train.rustPhaseId])).toEqual([
        ['2', undefined],
        ['4', 'D'],
        ['D', undefined]
    ])
})
