import { PhaseTable, TrainDepot, type TrainDistance } from '@tabletop/18xx'

const stops = (maximum: number): TrainDistance => ({ measure: 'revenue-centers', maximum })
/** An n+n train: n large stations and n more small ones, small ones standing in for large (§X Trains). */
const plus = (large: number): TrainDistance => ({
    measure: 'revenue-centers',
    maximum: large,
    extraTowns: large
})
/** An E-train visits any number of stations, counting the best few (§X Trains). */
const express: TrainDistance = { measure: 'revenue-centers', maximum: 'unlimited' }
/**
 * The stations an E-train counts: its best, one of them holding its company's station (§X
 * Trains).
 */
export const PayingStopLimits1880: Readonly<Record<string, number>> = { '6E': 6, '8E': 8 }

export const RestoredTwoId = '2R'

/** The trains (§XI). The restored 2-trains go on sale with the first 6-train. */
export const TrainDepot1880 = new TrainDepot({
    id: '1880',
    trains: [
        { id: '2', name: '2', price: 100, distance: stops(2), rustsOn: '4' },
        { id: '2+2', name: '2+2', price: 180, distance: plus(2), rustsOn: '4+4' },
        { id: '3', name: '3', price: 180, distance: stops(3), rustsOn: '6' },
        { id: '3+3', name: '3+3', price: 300, distance: plus(3), rustsOn: '6E' },
        { id: '4', name: '4', price: 300, distance: stops(4), rustsOn: '8' },
        { id: '4+4', name: '4+4', price: 450, distance: plus(4), rustsOn: '8E' },
        { id: '6', name: '6', price: 600, distance: stops(6) },
        { id: '6E', name: '6E', price: 700, distance: express },
        { id: '8', name: '8', price: 800, distance: stops(8) },
        { id: '8E', name: '8E', price: 900, distance: express },
        { id: '10', name: '10', price: 1000, distance: stops(10) },
        { id: RestoredTwoId, name: '2R', price: 250, distance: stops(2) }
    ],
    supply: [
        { definitionId: '2', count: 10 },
        { definitionId: '2+2', count: 5 },
        { definitionId: '3', count: 5 },
        { definitionId: '3+3', count: 5 },
        { definitionId: '4', count: 5 },
        { definitionId: '4+4', count: 5 },
        { definitionId: '6', count: 5 },
        { definitionId: '6E', count: 5 },
        { definitionId: '8', count: 2 },
        { definitionId: '8E', count: 2 },
        { definitionId: '10', count: 'unlimited' },
        { definitionId: RestoredTwoId, count: 10 }
    ]
})

/** The phase the first 4-train starts: the Communist Takeover (§XIV). */
export const CommunistPhaseId = 'B3'
/** The phase the first 6-train starts: the Shanghai Stock Exchange re-opens (§XIV). */
export const ReopeningPhaseId = 'C2'

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const gray = ['yellow', 'green', 'brown', 'gray']
/** The phases (§XI), lettered A to D for the building permits and off-board values. */
export const Phases1880 = new PhaseTable(
    [
        { id: 'A1', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: 'A2', startedBy: ['2+2'], tileColors: yellow, operatingRounds: 1, trainLimit: 4 },
        { id: 'B1', startedBy: ['3'], tileColors: green, operatingRounds: 1, trainLimit: 4 },
        { id: 'B2', startedBy: ['3+3'], tileColors: green, operatingRounds: 1, trainLimit: 3 },
        { id: 'B3', startedBy: ['4'], tileColors: green, operatingRounds: 1, trainLimit: 3 },
        { id: 'C1', startedBy: ['4+4'], tileColors: brown, operatingRounds: 1, trainLimit: 3 },
        { id: 'C2', startedBy: ['6'], tileColors: brown, operatingRounds: 1, trainLimit: 3 },
        { id: 'C3', startedBy: ['6E'], tileColors: brown, operatingRounds: 1, trainLimit: 2 },
        { id: 'D1', startedBy: ['8'], tileColors: gray, operatingRounds: 1, trainLimit: 2 },
        { id: 'D2', startedBy: ['8E'], tileColors: gray, operatingRounds: 1, trainLimit: 2 },
        { id: 'D3', startedBy: ['10'], tileColors: gray, operatingRounds: 1, trainLimit: 2 }
    ],
    TrainDepot1880
)

/** A phase's letter: its building permit and off-board column (§VIII, §X). */
export function phaseLetter(phaseId: string): string {
    return phaseId[0]
}
