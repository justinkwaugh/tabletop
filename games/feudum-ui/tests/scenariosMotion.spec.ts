import { expect } from '@playwright/test'
import { ActionType } from '@tabletop/feudum'
import { scenario, type ScenarioTable } from './scenarioTable.js'

/** The contract's motion scenarios S63 to S66, on the real table at both widths. */

const Badlands1 = 'space:space.badlands.1'
const Pawn = 'pawn:p1:1'
const Food = '[data-world^="good:space.badlands.1:food"]'
/** The contract's fast fallback, and a frame or two either side of it at 60 a second. */
const FastMs = 200
const FrameSlackMs = 50

/** One painted frame: what moved, what flew, what was hidden, and where each piece stood. */
interface Frame {
    readonly at: number
    /** Board pieces with a tween's transform written on them. */
    readonly moving: readonly string[]
    /** Each flying copy, by id, and where it stood. */
    readonly flights: Readonly<Record<string, string>>
    readonly tokens: readonly string[]
    /** Elements hidden outside the flight layer: a source waiting for its copy to land. */
    readonly hidden: number
    readonly pawn: string
    readonly food: number
    /** The pilfered good's own token: how much of it shows, or -1 while there is none. */
    readonly good: number
}

declare global {
    interface Window {
        feudumFrames?: Frame[]
    }
}

/** Every frame painted from just before `act` until the table has settled. */
async function framesOf(table: ScenarioTable, act: () => Promise<void>): Promise<Frame[]> {
    await table.page.evaluate(
        ([pawn, food]) => {
            const frames: Frame[] = []
            window.feudumFrames = frames
            const sample = () => {
                if (window.feudumFrames !== frames) {
                    return
                }
                const flights: Record<string, string> = {}
                for (const copy of document.querySelectorAll('[data-flight]')) {
                    const { x, y } = copy.getBoundingClientRect()
                    flights[copy.getAttribute('data-flight') ?? ''] =
                        `${x.toFixed(1)}:${y.toFixed(1)}`
                }
                frames.push({
                    at: performance.now(),
                    moving: [...document.querySelectorAll('[data-motion]')]
                        .filter(
                            (piece) =>
                                piece.getAttribute('transform') || piece.getAttribute('style')
                        )
                        .map((piece) => piece.getAttribute('data-motion') ?? ''),
                    flights,
                    tokens: [...document.querySelectorAll('[data-transient]')].map(
                        (token) => token.getAttribute('data-token') ?? ''
                    ),
                    hidden: [...document.querySelectorAll('[style*="visibility: hidden"]')].filter(
                        (element) => !element.closest('[data-flight-layer]')
                    ).length,
                    pawn: [...document.querySelectorAll(`[data-motion="${pawn}"]`)]
                        .map((piece) => {
                            // On the board's own scale, so a view that pans or zooms is no step.
                            const board = document
                                .querySelector('[data-board-surface]')
                                ?.getBoundingClientRect()
                            const { x, y } = piece.getBoundingClientRect()
                            const scale = (board?.width ?? 1) / 2500
                            const across = (x - (board?.x ?? 0)) / scale
                            const down = (y - (board?.y ?? 0)) / scale
                            return `${across.toFixed(0)}:${down.toFixed(0)}`
                        })
                        .join(),
                    food: document.querySelectorAll(food).length,
                    good: Math.max(
                        -1,
                        ...[
                            ...document.querySelectorAll('[data-transient][data-token="good"]')
                        ].map((token) => Number(getComputedStyle(token).opacity))
                    )
                })
                requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        },
        [Pawn, Food] as const
    )
    await act()
    await table.settled()
    // Two more frames, so the last one painted is the table at rest.
    await table.page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    )
    return table.page.evaluate(() => {
        const frames = window.feudumFrames ?? []
        window.feudumFrames = undefined
        return frames
    })
}

/**
 * The frame the farmer first stands where it ends, and the frame the pilfer first shows: its good's token
 * seen, or with no token drawn, the food gone from the space.
 */
function orderOf(frames: readonly Frame[]) {
    const end = frames.at(-1)?.pawn
    const shown = frames.findIndex(({ good }) => good > 0)
    return {
        arrived: frames.findIndex(({ pawn }) => pawn === end),
        pilfered: shown >= 0 ? shown : frames.findIndex(({ food }) => food === 0)
    }
}

const inMotion = (frame: Frame) => frame.moving.length > 0 || Object.keys(frame.flights).length > 0

/** From the first frame anything moved to the last: how long the table was in motion. */
function motionSpan(frames: readonly Frame[]): number {
    const moving = frames.filter(inMotion)
    return moving.length === 0 ? 0 : (moving.at(-1)?.at ?? 0) - (moving[0]?.at ?? 0)
}

const standings = (frames: readonly Frame[]) =>
    frames.map(({ pawn }) => pawn).filter((pawn, index, all) => pawn !== all[index - 1])

/** Every board piece's world placement: the table as a fresh page would draw it. */
const worldOf = (table: ScenarioTable) =>
    table.page
        .locator('[data-board-surface] [data-world]')
        .evaluateAll((pieces) =>
            pieces
                .map(
                    (piece) =>
                        `${piece.getAttribute('data-world')}@${piece.getAttribute('transform')}`
                )
                .sort()
        )

/** R-3.7.1, R-3.7.4 The farmer walks to the badlands; it pilfers the food there, or not. */
async function stageMove(table: ScenarioTable, pilfer: boolean) {
    await table.press(table.card('Move'))
    await table.pressPick(Badlands1)
    if (pilfer) {
        await table.pressPick('pilfer:space.badlands.1:space:food')
    } else {
        await table.press(table.row('No pilfer'))
    }
}

const stepBack = (table: ScenarioTable) =>
    table.page.locator('button[aria-label="step backwards"]:visible')
const stepForward = (table: ScenarioTable) =>
    table.page.locator('button[aria-label="step forwards"]:visible')
const viewingHistory = (table: ScenarioTable) =>
    table.page.evaluate(() => window.feudumSession.isViewingHistory)

/** The log's last line for the Move, as the History tab lists it. */
async function moveLine(table: ScenarioTable): Promise<string> {
    await table.press(table.page.getByRole('tab', { name: 'History' }))
    const lines = await table.page
        .locator('[data-history-list] [data-action-line]')
        .evaluateAll((all) => all.map((line) => line.getAttribute('data-action-line') ?? ''))
    await table.press(table.page.getByRole('tab', { name: 'Players' }))
    return lines.filter((line) => / moved /.test(line)).at(-1) ?? 'no line'
}

scenario(
    'S63 R-X.2, R-2.2 Fast fallback: Undo and history steps',
    'move-last-step-farmer',
    async (table) => {
        const home = await worldOf(table)
        await stageMove(table, false)
        await table.press(table.primary())
        const moved = await worldOf(table)
        expect(moved).not.toEqual(home)

        // Undo a sent Move: the pieces interpolate back in the fast fallback, no longer.
        const undone = await framesOf(table, () => table.press(table.undo()))
        expect(undone.filter(inMotion).length).toBeGreaterThan(0)
        expect(motionSpan(undone)).toBeLessThanOrEqual(FastMs + FrameSlackMs)
        expect(standings(undone).length).toBeGreaterThan(2)
        expect(await worldOf(table)).toEqual(home)

        await stageMove(table, false)
        await table.press(table.primary())
        // History opens on the latest Action, the Move; the steps from there go back and forth.
        const entered = await framesOf(table, () => table.press(stepBack(table)))
        expect(motionSpan(entered)).toBeLessThanOrEqual(FastMs + FrameSlackMs)
        for (const step of [stepBack, stepForward]) {
            const frames = await framesOf(table, () => table.press(step(table)))
            expect(frames.filter(inMotion).length).toBeGreaterThan(0)
            expect(motionSpan(frames)).toBeLessThanOrEqual(FastMs + FrameSlackMs)
            expect(frames.at(-1)?.hidden).toBe(0)
        }
        expect(await worldOf(table)).toEqual(moved)
    }
)

scenario(
    'S63 R-2.2 Silent restore: a reconnect shows the state with no motion',
    'move-last-step-farmer',
    async (table) => {
        const home = await worldOf(table)
        await table.page.evaluate((move) => window.feudumFixture.host.sendUnheard('p1', move), {
            type: ActionType.Move,
            steps: [
                {
                    piece: { kind: 'pawn', playerId: 'p1', n: 1 },
                    to: 'space.badlands.1',
                    medium: 'road'
                }
            ]
        } as const)
        expect(await worldOf(table)).toEqual(home)
        const frames = await framesOf(table, () =>
            table.page.evaluate(() => window.feudumFixture.host.reconcile('p1'))
        )
        expect(frames.filter(inMotion)).toEqual([])
        expect(frames.flatMap(({ tokens }) => tokens)).toEqual([])
        expect(standings(frames).length).toBeLessThanOrEqual(2)
        expect(await worldOf(table)).not.toEqual(home)
        await expect(table.primary()).toHaveCount(0)
    }
)

scenario(
    'S64 R-2.2, R-3.7.4 Replay a Move and its pilfer',
    'move-last-step-farmer',
    async (table) => {
        await stageMove(table, true)
        await table.press(table.primary())
        const after = await worldOf(table)
        await table.press(table.page.getByRole('tab', { name: 'History' }))
        const replay = table.page.locator('[data-history-list] [data-history-replay]').last()
        const frames = await framesOf(table, async () => {
            await table.press(replay)
            await expect.poll(() => viewingHistory(table)).toBe(false)
        })
        // The steps play along the route, then the pilfer: the food goes once the farmer stands there.
        const walk = standings(frames)
        expect(walk.length).toBeGreaterThan(3)
        const { arrived, pilfered } = orderOf(frames)
        expect(arrived).toBeGreaterThanOrEqual(0)
        expect(pilfered).toBeGreaterThanOrEqual(arrived)
        expect(frames.at(-1)?.hidden).toBe(0)
        expect(await worldOf(table)).toEqual(after)
    }
)

scenario(
    'S65 R-3.7.1 Reduced motion: no tween, the same order, the same line',
    'move-last-step-farmer',
    async (table) => {
        await table.page.emulateMedia({ reducedMotion: 'reduce' })
        await stageMove(table, true)
        const still = await framesOf(table, () => table.press(table.primary()))
        const stillLine = await moveLine(table)
        const stillWorld = await worldOf(table)
        for (const id of new Set(still.flatMap(({ flights }) => Object.keys(flights)))) {
            expect(new Set(still.map(({ flights }) => flights[id]).filter(Boolean)).size).toBe(1)
        }
        expect(standings(still).length).toBe(2)

        await table.press(table.undo())
        await table.page.emulateMedia({ reducedMotion: 'no-preference' })
        await stageMove(table, true)
        const moving = await framesOf(table, () => table.press(table.primary()))
        expect(standings(moving).length).toBeGreaterThan(3)
        expect(await worldOf(table)).toEqual(stillWorld)
        expect(await moveLine(table)).toBe(stillLine)
        expect(stillLine).toMatch(/^You moved .*pilfer/)
        // The same order: the farmer stands on the badlands no later than the food leaves it.
        for (const run of [orderOf(still), orderOf(moving)]) {
            expect(run.arrived).toBeGreaterThanOrEqual(0)
            expect(run.pilfered).toBeGreaterThanOrEqual(run.arrived)
        }
    }
)

scenario(
    'S66 R-X.2 Interruption: a second Action mid-flight',
    'move-last-step-farmer',
    async (table) => {
        await stageMove(table, true)
        // The next seat's forfeit reaches the host the frame the Move first moves anything.
        await table.page.evaluate(
            (forfeit) => {
                const watch = () => {
                    const flying =
                        document.querySelector('[data-flight]') ??
                        [...document.querySelectorAll('[data-motion]')].find(
                            (piece) =>
                                piece.getAttribute('transform') || piece.getAttribute('style')
                        )
                    if (flying) {
                        Object.assign(window, {
                            feudumInterrupted: window.feudumFixture.host.send('p2', forfeit)
                        })
                        return
                    }
                    requestAnimationFrame(watch)
                }
                requestAnimationFrame(watch)
            },
            { type: ActionType.ForfeitCard, kind: 'tax' } as const
        )
        const frames = await framesOf(table, () => table.press(table.primary()))
        await table.page.evaluate(() => Reflect.get(window, 'feudumInterrupted'))
        await table.settled()
        expect(frames.filter(inMotion).length).toBeGreaterThan(0)

        await expect(table.page.locator('[data-flight]')).toHaveCount(0)
        await expect(table.page.locator('[data-transient]')).toHaveCount(0)
        expect(
            await table.page.evaluate(
                () =>
                    [...document.querySelectorAll('[style*="visibility: hidden"]')].filter(
                        (element) => !element.closest('[data-flight-layer]')
                    ).length
            )
        ).toBe(0)
        expect(
            await table.page.evaluate(() => [
                window.feudumSession.gameState.activePlayerIds,
                window.feudumFixture.host.state.activePlayerIds
            ])
        ).toEqual([['p3'], ['p3']])
        // The latest state, as a fresh page would draw it.
        const shown = await worldOf(table)
        await table.showSeat('p1')
        expect(shown).toEqual(await worldOf(table))
    }
)
