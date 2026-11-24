import type { Point } from '@tabletop/common'
import { expect } from './errorWatch.js'
import type { ScenarioTable } from './scenarioTable.js'

/** A piece or a moving copy as one frame painted it: its centre, in the page's pixels. */
interface Seen extends Readonly<Point> {
    readonly id: string
}

interface ReplayFrame {
    readonly replaying: boolean
    /** Board tokens, flight copies and drawn pieces in motion, each while it shows. */
    readonly movers: readonly Seen[]
    /** The drawn pieces the spec watches. */
    readonly drawn: readonly Seen[]
    /** Elements hidden outside the flight layer: a source waiting for its copy to land. */
    readonly hidden: number
    readonly tokens: number
}

declare global {
    interface Window {
        feudumReplay?: ReplayFrame[]
    }
}

/** A frame short of the landing, and a piece's box drawn off its centre: a third of a pawn, in board units. */
const LandingSlack = 20

/**
 * Contract, Replay: the History tab's last entry replayed, every frame painted from the press until
 * the table is at rest, with the drawn pieces `drawn` selects.
 */
export async function replayLast(table: ScenarioTable, drawn: string): Promise<ReplayFrame[]> {
    await table.press(table.page.getByRole('tab', { name: 'History' }))
    // The list is newest first: the entry the spec's own Actions made.
    const replay = table.page.locator('[data-history-list] [data-history-replay]').first()
    await table.page.evaluate((selector) => {
        const frames: ReplayFrame[] = []
        window.feudumReplay = frames
        // In the board's own units, so a view the replay frames differently is no step.
        const centre = (element: Element, id: string): Seen => {
            const surface = document.querySelector('svg[data-board-surface]')
            const board = surface?.getBoundingClientRect()
            const units = surface instanceof SVGSVGElement ? surface.viewBox.baseVal.width : 0
            const scale = board && units > 0 ? board.width / units : 1
            const box = element.getBoundingClientRect()
            return {
                id,
                x: (box.x + box.width / 2 - (board?.x ?? 0)) / scale,
                y: (box.y + box.height / 2 - (board?.y ?? 0)) / scale
            }
        }
        const sample = () => {
            if (window.feudumReplay !== frames) {
                return
            }
            const tokens = [...document.querySelectorAll('[data-transient]')]
            const shownTokens = tokens
                .filter((token) => Number(getComputedStyle(token).opacity) > 0)
                .map((token) => centre(token, `token:${token.getAttribute('data-transient')}`))
            const copies = [...document.querySelectorAll('[data-flight]')]
                .filter(
                    (copy) =>
                        copy instanceof HTMLElement &&
                        copy.style.visibility === 'visible' &&
                        Number(copy.style.opacity || '1') > 0
                )
                .map((copy) =>
                    centre(
                        copy.querySelector('[data-flight-side]:not([hidden]) svg') ?? copy,
                        `flight:${copy.getAttribute('data-flight')}`
                    )
                )
            // A drawn piece a board motion is moving: the animator writes its pose on it.
            const sliding = [...document.querySelectorAll('[data-motion][transform]')].map(
                (piece) => centre(piece, `piece:${piece.getAttribute('data-motion')}`)
            )
            frames.push({
                replaying: window.feudumSession.isViewingHistory,
                movers: [...shownTokens, ...copies, ...sliding],
                drawn: [...document.querySelectorAll(selector)]
                    .filter((piece) => getComputedStyle(piece).visibility !== 'hidden')
                    .map((piece) =>
                        centre(
                            piece,
                            piece.closest('[data-world]')?.getAttribute('data-world') ?? ''
                        )
                    ),
                hidden: [...document.querySelectorAll('[style*="visibility: hidden"]')].filter(
                    (element) => !element.closest('[data-flight-layer]')
                ).length,
                tokens: tokens.length
            })
            requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
    }, drawn)
    await table.press(replay)
    await expect
        .poll(() => table.page.evaluate(() => window.feudumSession.isViewingHistory))
        .toBe(false)
    await table.settled()
    // Two more frames, so the last one painted is the table at rest.
    await table.page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    )
    const frames = await table.page.evaluate(() => {
        const watched = window.feudumReplay ?? []
        window.feudumReplay = undefined
        return watched
    })
    await table.press(table.page.getByRole('tab', { name: 'Players' }))
    return frames
}

const apart = (a: Seen, b: Seen) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Contract, Replay: something moved for the watched pieces; each piece the entry put on the board is
 * drawn where a copy or token last stood, each it took off where one first stood, so nothing jumps;
 * and the table ends at rest, with no token, no copy and no source left hidden.
 */
export function expectReplayLands(frames: readonly ReplayFrame[]) {
    const replaying = frames.findIndex((frame) => frame.replaying)
    expect(replaying).toBeGreaterThanOrEqual(0)
    const watched = frames.slice(replaying)
    const [start] = watched
    const end = watched.at(-1)
    expect(end?.replaying).toBe(false)
    const movers = [...new Set(watched.flatMap(({ movers }) => movers.map(({ id }) => id)))]
    expect(movers.length).toBeGreaterThan(0)
    const seenOf = (id: string) =>
        watched.flatMap(({ movers }) => movers.filter((mover) => mover.id === id))
    const firsts = movers.flatMap((id) => seenOf(id).slice(0, 1))
    const lasts = movers.flatMap((id) => seenOf(id).slice(-1))
    const before = new Set(start.drawn.map(({ id }) => id))
    const after = new Set(end?.drawn.map(({ id }) => id))
    const arrived = (end?.drawn ?? []).filter(({ id }) => !before.has(id))
    const left = start.drawn.filter(({ id }) => !after.has(id))
    expect(arrived.length + left.length).toBeGreaterThan(0)
    for (const piece of arrived) {
        expect(Math.min(...lasts.map((last) => apart(last, piece)))).toBeLessThan(LandingSlack)
    }
    for (const piece of left) {
        expect(Math.min(...firsts.map((first) => apart(first, piece)))).toBeLessThan(LandingSlack)
    }
    expect(end?.movers).toEqual([])
    expect(end?.tokens).toBe(0)
    expect(end?.hidden).toBe(0)
}
