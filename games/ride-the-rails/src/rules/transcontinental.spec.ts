import { describe, expect, it } from 'vitest'
import { hexIdAt, type HexId } from '../data/hexes.js'
import { LOCOMOTIVES_PER_RAILROAD, type RailroadId } from '../data/railroads.js'
import { adjacentHexIds, isHexId } from '../data/boardMaps.js'
import { USA_CITIES } from '../data/usaMap.js'
import type { Track } from '../model/gameState.js'
import { isEastCoastCity, isWestCoastCity } from './startRailroad.js'
import { transcontinentalLine } from './transcontinental.js'

const KANSAS_CITY: HexId = 'hex.usa.8-32'
const RENO_ROW = 7

const JOINED_IN_A_CITY = expect.objectContaining({ changesRailroadOnlyInCities: true })
const JOINED_ELSEWHERE = expect.objectContaining({ changesRailroadOnlyInCities: false })

// Row 9 runs from San Francisco (dcol 5) to Baltimore (dcol 55) with no city between.
function row(rowNumber: number, fromDcol: number, toDcol: number): HexId[] {
    const hexIds: HexId[] = []
    for (let dcol = fromDcol; dcol <= toDcol; dcol += 2) {
        const hexId = hexIdAt({ row: rowNumber, dcol })
        expect(isHexId(hexId)).toBe(true)
        hexIds.push(hexId)
    }
    return hexIds
}

function trackOf(...runs: [RailroadId, HexId[]][]): Track {
    const track: Track = {}
    for (const [railroadId, hexIds] of runs) {
        for (const hexId of hexIds) {
            track[hexId] = [...(track[hexId] ?? []), railroadId]
        }
    }
    return track
}

describe('the Transcontinental line search (R-4.3.3)', () => {
    it('finds no line on an empty map', () => {
        expect(transcontinentalLine({})).toBeUndefined()
    })

    describe('a line needs two railroads (R-4.3.3)', () => {
        it('decides real games: one railroad can reach coast to coast with 22 of its 27 locomotives', () => {
            const west = USA_CITIES.filter(isWestCoastCity).map((city) => city.hexId)
            const hexesFromWest = new Map<HexId, number>(west.map((hexId) => [hexId, 1]))
            const queue = [...west]
            for (let index = 0; index < queue.length; index++) {
                const hexId = queue[index]
                for (const next of adjacentHexIds(hexId)) {
                    if (!hexesFromWest.has(next)) {
                        hexesFromWest.set(next, (hexesFromWest.get(hexId) ?? 0) + 1)
                        queue.push(next)
                    }
                }
            }
            const fewest = Math.min(
                ...USA_CITIES.filter(isEastCoastCity).map(
                    (city) => hexesFromWest.get(city.hexId) ?? Infinity
                )
            )
            expect(fewest).toBe(22)
            expect(fewest).toBeLessThan(LOCOMOTIVES_PER_RAILROAD)
        })

        it('finds no line in one railroad alone coast to coast', () => {
            expect(
                transcontinentalLine(trackOf(['railroad.purple', row(9, 5, 55)]))
            ).toBeUndefined()
        })

        it('does not join locomotives of different railroads in adjacent hexes', () => {
            const track = trackOf(
                ['railroad.purple', row(9, 5, 31)],
                ['railroad.red', row(9, 33, 55)]
            )
            expect(transcontinentalLine(track)).toBeUndefined()
        })

        it('does not count a railroad that only shares the West Coast city', () => {
            const track = trackOf(
                ['railroad.purple', row(9, 5, 55)],
                ['railroad.black', row(9, 5, 5)]
            )
            expect(transcontinentalLine(track)).toBeUndefined()
        })

        it('does not count a railroad that only shares a hex on the way', () => {
            const track = trackOf(
                ['railroad.purple', row(9, 5, 55)],
                ['railroad.black', row(9, 29, 29)]
            )
            expect(transcontinentalLine(track)).toBeUndefined()
        })

        it('joins two railroads in a shared hex', () => {
            const track = trackOf(
                ['railroad.purple', row(9, 5, 31)],
                ['railroad.red', row(9, 31, 55)]
            )
            expect(transcontinentalLine(track)).toEqual(JOINED_ELSEWHERE)
        })

        it('joins three railroads, each changing in a shared hex', () => {
            const track = trackOf(
                ['railroad.purple', row(9, 5, 21)],
                ['railroad.black', row(9, 21, 31)],
                ['railroad.red', row(9, 31, 55)]
            )
            expect(transcontinentalLine(track)).toEqual(JOINED_ELSEWHERE)
        })

        it('joins a railroad that carries the line a step between two shared hexes', () => {
            const track = trackOf(
                ['railroad.purple', row(9, 5, 55)],
                ['railroad.black', row(9, 29, 31)]
            )
            expect(transcontinentalLine(track)).toEqual(JOINED_ELSEWHERE)
        })

        it('lets a line pass a hex twice, so a railroad may carry it out and back', () => {
            const track = trackOf(
                ['railroad.purple', row(9, 5, 55)],
                ['railroad.black', [...row(9, 29, 29), ...row(8, 30, 30)]]
            )
            expect(transcontinentalLine(track)).toEqual(JOINED_ELSEWHERE)
        })
    })

    describe('its ends', () => {
        it('starts only in a West Coast city', () => {
            const track = trackOf(
                ['railroad.purple', row(RENO_ROW, 7, 29)],
                ['railroad.red', row(RENO_ROW, 29, 57)]
            )
            expect(transcontinentalLine(track)).toBeUndefined()
        })

        it('ends only in an East Coast city', () => {
            const track = trackOf(
                ['railroad.purple', row(9, 5, 31)],
                ['railroad.red', row(9, 31, 53)]
            )
            expect(transcontinentalLine(track)).toBeUndefined()
        })

        it('runs either way along the track', () => {
            const track = trackOf(
                ['railroad.red', row(9, 31, 55)],
                ['railroad.purple', row(9, 5, 31)]
            )
            expect(transcontinentalLine(track)).toEqual(JOINED_ELSEWHERE)
        })
    })

    describe('its price (R-4.3.3)', () => {
        it('changes railroad only in a city hex', () => {
            const track = trackOf(
                ['railroad.purple', [...row(9, 5, 31), KANSAS_CITY]],
                ['railroad.red', [KANSAS_CITY, ...row(9, 33, 55)]]
            )
            expect(transcontinentalLine(track)).toEqual(JOINED_IN_A_CITY)
        })

        it('changes railroad in a plain hex as well as a city on the same line', () => {
            const track = trackOf(
                ['railroad.purple', row(9, 5, 29)],
                ['railroad.blue', [...row(9, 29, 31), KANSAS_CITY]],
                ['railroad.red', [KANSAS_CITY, ...row(9, 33, 55)]]
            )
            expect(transcontinentalLine(track)).toEqual(JOINED_ELSEWHERE)
        })

        it('takes the city-only line when another line changes in a plain hex', () => {
            const track = trackOf(
                ['railroad.purple', [...row(9, 5, 31), KANSAS_CITY, ...row(9, 33, 33)]],
                ['railroad.red', [KANSAS_CITY, ...row(9, 33, 55)]]
            )
            expect(transcontinentalLine(track)).toEqual(JOINED_IN_A_CITY)
        })
    })
})
