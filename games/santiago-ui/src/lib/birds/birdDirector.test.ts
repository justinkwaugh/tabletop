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
    const host = {
        isViewingHistory: false,
        gameState: { board: { squares } },
        get incomingGameState() {
            return this.gameState
        }
    }
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

describe('bird director and dried-out fields', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('flies over a desert target without landing, then schedules another visit', () => {
        const squares = emptyBoard()
        dryField(squares, 3, 2)
        const f = fixture(squares)
        expect(f.director.summon()).toBe(true)
        expect(f.ids.length).toBeGreaterThanOrEqual(3)
        f.env.ticker.run(40)
        expect(f.director.hasFlock).toBe(false)
        expect(f.ids).toEqual([])
        expect(vi.getTimerCount()).toBe(1)
    })

    it('sometimes lands and sometimes only flies over when living fields and deserts are mixed', () => {
        const outcomes = new Set<string>()
        for (let visit = 0; visit < 30; visit++) {
            const squares = emptyBoard()
            plantField(squares, 1, 1)
            dryField(squares, 5, 3)
            dryField(squares, 6, 4)
            const f = fixture(squares)
            for (let i = 0; i < visit; i++) f.env.random()
            f.director.summon()
            outcomes.add(f.director.hasFlyover ? 'flew over' : 'landing')
            f.detach()
        }
        expect(outcomes).toEqual(new Set(['landing', 'flew over']))
    })

    it('scatters the flyover if its field stops being desert, as on Undo', () => {
        const squares = emptyBoard()
        dryField(squares, 2, 2)
        const f = fixture(squares)
        f.director.summon()
        f.env.ticker.run(2)
        squares[2][2] = { type: SquareType.Empty, hasPalmTree: false }
        f.env.ticker.run(15)
        expect(f.director.hasFlock).toBe(false)
    })
})

describe('bird director during a transition', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('startles a landed flock as soon as the incoming state dries its field', () => {
        const squares = emptyBoard()
        plantField(squares, 3, 2)
        const f = fixture(squares)
        f.director.summon()
        f.env.ticker.run(6)
        expect(f.director.hasFlock).toBe(true)
        const drying = emptyBoard()
        dryField(drying, 3, 2)
        Object.defineProperty(f.host, 'incomingGameState', { get: () => ({ board: { squares: drying } }) })
        f.env.ticker.run(8)
        expect(f.director.hasFlock).toBe(false)
    })
})
