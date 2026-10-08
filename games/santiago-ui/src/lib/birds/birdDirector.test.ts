import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPrng } from '@tabletop/common'
import { CropType, SquareType, type BoardSquare } from '@tabletop/santiago'
import { BirdDirector, type BirdEnvironment, type BirdHost, type TickCallback } from './birdDirector.js'
import { adjacentCandidates, nearbyCandidates } from './candidateFields.js'

class RecordingTicker {
    readonly callbacks = new Set<TickCallback>()
    add(callback: TickCallback) {
        this.callbacks.add(callback)
    }
    remove(callback: TickCallback) {
        this.callbacks.delete(callback)
    }
    run(seconds: number) {
        for (let t = 0; t < seconds; t += 1 / 60) {
            for (const callback of this.callbacks) callback(1000 / 60)
        }
    }
}

function emptyBoard(): BoardSquare[][] {
    return Array.from({ length: 8 }, () =>
        Array.from({ length: 6 }, (): BoardSquare => ({ type: SquareType.Empty, hasPalmTree: false }))
    )
}

function dryField(squares: BoardSquare[][], col: number, row: number) {
    plantField(squares, col, row)
    const field = squares[col][row]
    if (field.type === SquareType.Field) field.dried = true
}

function plantField(squares: BoardSquare[][], col: number, row: number) {
    squares[col][row] = {
        type: SquareType.Field,
        crop: CropType.Chili,
        playerId: 'p1',
        farmerCapacity: 2,
        farmerCount: 1,
        hasPalmTree: false,
        dried: false
    }
}

type Fixture = {
    host: BirdHost & { isViewingHistory: boolean }
    env: BirdEnvironment & { hidden: boolean; reducedMotion: boolean; ticker: RecordingTicker }
    director: BirdDirector
    ids: number[]
    detach: () => void
    visibility: (hidden: boolean) => void
}

function fixture(squares = emptyBoard()): Fixture {
    const ticker = new RecordingTicker()
    let visibility: (hidden: boolean) => void = () => {}
    const host = { isViewingHistory: false, gameState: { board: { squares } } }
    const env = {
        random: getPrng(9),
        ticker,
        hidden: false,
        reducedMotion: false,
        isHidden: () => env.hidden,
        prefersReducedMotion: () => env.reducedMotion,
        onVisibilityChange(listener: (hidden: boolean) => void) {
            visibility = listener
            return () => {
                visibility = () => {}
            }
        }
    }
    const director = new BirdDirector(host, env)
    const result: Fixture = {
        host,
        env,
        director,
        ids: [],
        detach: () => {},
        visibility: (hidden) => visibility(hidden)
    }
    result.detach = director.attach((ids) => {
        result.ids = ids
    })
    return result
}

describe('bird director', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('waits out the idle window before a flock of three to six arrives', () => {
        const squares = emptyBoard()
        plantField(squares, 2, 3)
        const f = fixture(squares)
        vi.advanceTimersByTime(29_900)
        expect(f.ids).toEqual([])
        vi.advanceTimersByTime(60_200)
        expect(f.ids.length).toBeGreaterThanOrEqual(3)
        expect(f.ids.length).toBeLessThanOrEqual(6)
        expect(f.env.ticker.callbacks.size).toBe(1)
    })

    it('stays away while viewing history or with no living field, then tries again later', () => {
        const squares = emptyBoard()
        const f = fixture(squares)
        vi.advanceTimersByTime(90_100)
        expect(f.ids).toEqual([])
        plantField(squares, 5, 1)
        f.host.isViewingHistory = true
        vi.advanceTimersByTime(90_100)
        expect(f.ids).toEqual([])
        f.host.isViewingHistory = false
        vi.advanceTimersByTime(90_100)
        expect(f.ids.length).toBeGreaterThan(0)
    })

    it('can be summoned at once, except under reduced motion', () => {
        const squares = emptyBoard()
        plantField(squares, 7, 5)
        const f = fixture(squares)
        f.env.reducedMotion = true
        expect(f.director.summon()).toBe(false)
        expect(f.ids).toEqual([])
        f.env.reducedMotion = false
        expect(f.director.summon()).toBe(true)
        expect(f.director.hasFlock).toBe(true)
        expect(f.director.summon()).toBe(false)
    })

    it('startles the flock away when the field dries out, then schedules another visit', () => {
        const squares = emptyBoard()
        plantField(squares, 3, 2)
        const f = fixture(squares)
        f.director.summon()
        f.env.ticker.run(5)
        expect(f.director.hasFlock).toBe(true)
        const field = squares[3][2]
        if (field.type === SquareType.Field) field.dried = true
        f.env.ticker.run(5)
        expect(f.director.hasFlock).toBe(false)
        expect(f.ids).toEqual([])
        expect(f.env.ticker.callbacks.size).toBe(0)
        expect(vi.getTimerCount()).toBe(1)
    })

    it('drops the flock while the tab is hidden and resumes scheduling when it returns', () => {
        const squares = emptyBoard()
        plantField(squares, 0, 0)
        const f = fixture(squares)
        f.director.summon()
        f.visibility(true)
        expect(f.ids).toEqual([])
        expect(f.env.ticker.callbacks.size).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
        f.visibility(false)
        expect(vi.getTimerCount()).toBe(1)
    })

    it('finds the living fields beside a target for a two-field visit', () => {
        const squares = emptyBoard()
        plantField(squares, 3, 2)
        plantField(squares, 4, 2)
        plantField(squares, 3, 3)
        const dried = squares[3][3]
        if (dried.type === SquareType.Field) dried.dried = true
        expect(adjacentCandidates(squares, { col: 3, row: 2 })).toEqual([{ col: 4, row: 2 }])
        expect(adjacentCandidates(squares, { col: 0, row: 0 })).toEqual([])
        plantField(squares, 2, 1)
        expect(nearbyCandidates(squares, [{ col: 3, row: 2 }, { col: 4, row: 2 }])).toEqual([
            { col: 2, row: 1 }
        ])
    })

    it('tears down timers, ticker and presence on detach', () => {
        const squares = emptyBoard()
        plantField(squares, 4, 4)
        const f = fixture(squares)
        f.director.summon()
        f.detach()
        expect(f.ids).toEqual([])
        expect(f.env.ticker.callbacks.size).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
    })
})

describe('bird director over a drying board', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('sends vultures instead of crows once more than half the fields are desert', () => {
        const squares = emptyBoard()
        plantField(squares, 1, 1)
        dryField(squares, 4, 2)
        dryField(squares, 5, 3)
        const f = fixture(squares)
        expect(f.director.summon()).toBe(true)
        expect(f.director.hasKettle).toBe(true)
        expect(f.director.hasFlock).toBe(false)
        expect(f.ids).toHaveLength(1)
    })

    it('sends no birds at all when the only desert lies too near the edge to circle', () => {
        const squares = emptyBoard()
        plantField(squares, 3, 2)
        dryField(squares, 0, 0)
        dryField(squares, 7, 5)
        const f = fixture(squares)
        expect(f.director.summon()).toBe(false)
        expect(f.director.hasKettle).toBe(false)
        expect(f.director.hasFlock).toBe(false)
        expect(f.ids).toEqual([])
    })

    it('still sends crows while desert is half the fields or less', () => {
        const squares = emptyBoard()
        plantField(squares, 1, 1)
        dryField(squares, 4, 2)
        const f = fixture(squares)
        expect(f.director.summon()).toBe(true)
        expect(f.director.hasFlock).toBe(true)
        expect(f.director.hasKettle).toBe(false)
    })

    it('sends the vultures away on entering history or when their square is no longer desert', () => {
        const squares = emptyBoard()
        dryField(squares, 2, 2)
        const f = fixture(squares)
        f.director.summon()
        f.env.ticker.run(4)
        f.host.isViewingHistory = true
        f.env.ticker.run(20)
        expect(f.director.hasKettle).toBe(false)
        expect(f.ids).toEqual([])

        f.host.isViewingHistory = false
        f.director.summon()
        f.env.ticker.run(4)
        squares[2][2] = { type: SquareType.Empty, hasPalmTree: false }
        f.env.ticker.run(20)
        expect(f.director.hasKettle).toBe(false)
    })
})
