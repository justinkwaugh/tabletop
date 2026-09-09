import { expect, test, type Page } from '@playwright/test'
import type {
    recordMotion,
    recordPlacement
} from '../src/lib/model/tests/boatTransitions.fixture.js'
type RecordedMotion = Awaited<ReturnType<typeof recordMotion>>
type PlacementFrames = Awaited<ReturnType<typeof recordPlacement>>

async function fixture(page: Page) {
    await page.goto('/')
    return page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.setup()
    })
}

async function boatPosition(page: Page, id: string) {
    return page.locator(`[data-boat-id="${id}"]`).evaluate((node) => {
        const bounds = node.getBoundingClientRect()
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    })
}

test('Undo clears a manual hut choice before there is any committed action', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.setup('initial-huts')
    })
    await page.getByRole('button', { name: 'boatbuilder Boat', exact: true }).click()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByText('Choose a hut type', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Back/ })).toHaveCount(0)
})

test('initial boat placement keeps the action panel visible until hut choice returns', async ({
    page
}) => {
    await page.goto('/')
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.setup('initial-huts')
    })
    await page.getByRole('button', { name: 'boatbuilder Boat', exact: true }).click()
    await expect(page.getByText('Place your boat building hut', { exact: true })).toBeVisible()
    const frames: PlacementFrames = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.recordPlacement('boat')
    })
    expect(frames.length).toBeGreaterThan(2)
    expect(frames.filter((frame) => frame.huts === 0)).toEqual([])
    expect(Math.min(...frames.map((frame) => frame.height))).toBeGreaterThanOrEqual(
        Math.min(frames[0].height, frames[frames.length - 1].height)
    )
    await expect(page.getByText('Choose a hut type', { exact: true })).toBeVisible()
})

test('Undo walks back manual build stages, skips the automatic action, then undoes a move', async ({
    page
}) => {
    const { moverId } = await fixture(page)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.stageBuild()
    })
    expect(
        await page
            .locator(`[data-boat-id="${moverId}"]`)
            .evaluate((node) => node.closest('[data-raised-piece-layer]') !== null)
    ).toBe(true)
    expect(
        await page
            .locator(`[data-boat-id]:not([data-boat-id="${moverId}"])`)
            .evaluateAll((nodes) =>
                nodes.every((node) => node.closest('[data-piece-layer]') !== null)
            )
    ).toBe(true)
    const expected = [
        { boat: moverId, destination: { q: 0, r: 1 }, hut: null, source: 'manual' },
        { boat: moverId, destination: null, hut: null, source: 'manual' },
        { boat: null, destination: null, hut: null, source: 'manual' },
        { boat: null, destination: null, hut: null, source: 'auto', action: 'Move', canUndo: false }
    ]
    for (const stage of expected) {
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        const draft = await page.evaluate(async () => {
            const fixture = await import(
                new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
            )
            return fixture.draft()
        })
        expect(draft).toMatchObject({ ...stage, count: 0 })
    }
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.move()
    })
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByTestId('boat-fixture')).toHaveAttribute('data-updating', 'false')
    const after = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.draft()
    })
    expect(after).toMatchObject({ action: 'Move', source: 'auto', count: 0, canUndo: false })
})

test('a boat and its tile appear together and Undo removes both in place', async ({ page }) => {
    await page.goto('/')
    const placed: PlacementFrames = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.setup('initial-huts')
        return fixture.recordPlacement('boat')
    })
    expect(placed.some((frame) => frame.pieceOpacity > 0 && frame.pieceOpacity < 1)).toBe(true)
    expect
        .soft(placed.filter((frame) => frame.pieceOpacity > 0.05 && frame.tileOpacity === 0))
        .toEqual([])
    const removed: PlacementFrames = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.recordPlacement('boat', true)
    })
    expect(removed.some((frame) => frame.pieceOpacity > 0 && frame.pieceOpacity < 1)).toBe(true)
    expect(
        removed.every((frame) => Math.abs(frame.pieceX) < 0.1 && Math.abs(frame.pieceY) < 0.1)
    ).toBe(true)
    expect(removed.every((frame) => Math.abs(frame.pieceOpacity - frame.tileOpacity) < 0.1)).toBe(
        true
    )
    await expect(page.locator('[data-boat-id]')).toHaveCount(0)
})

test('moving a newly built boat through the cell click handler animates forward and on Undo', async ({
    page
}) => {
    await page.goto('/')
    const moverId: string = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.prepareBuiltBoatMove()
    })
    for (const operation of ['click-move', 'undo'] as const) {
        const motion: RecordedMotion = await page.evaluate(async (operation) => {
            const fixture = await import(
                new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
            )
            return fixture.recordMotion(operation)
        }, operation)
        const positions = motion.frames.flat().filter((boat) => boat.id === moverId)
        const xs = positions.map((boat) => boat.x)
        const ys = positions.map((boat) => boat.y)
        expect(
            xs.some((x) => x > Math.min(...xs) + 1 && x < Math.max(...xs) - 1) ||
                ys.some((y) => y > Math.min(...ys) + 1 && y < Math.max(...ys) - 1)
        ).toBe(true)
        expect(motion.durations).toEqual([0.2])
        expect(
            motion.frames
                .flat()
                .filter((boat) => boat.moving)
                .every((boat) => boat.aboveTiles && boat.raised)
        ).toBe(true)
    }
})

test('opening hut choices moves stationary boats with the board without tweening them', async ({
    page
}) => {
    await page.goto('/')
    const moverId: string = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return (await fixture.setup('moving', false)).moverId
    })
    const motion: RecordedMotion = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.recordMotion('preview-build')
    })
    const stationary = motion.frames.flat().filter((boat) => boat.id !== moverId)
    expect(
        stationary.every((boat) => Math.abs(boat.offsetX) < 0.1 && Math.abs(boat.offsetY) < 0.1)
    ).toBe(true)
    const first = motion.frames[0].find((boat) => boat.id !== moverId)
    const last = motion.frames[motion.frames.length - 1].find((boat) => boat.id === first?.id)
    expect(first?.y).not.toBe(last?.y)
})

for (const existing of [false, true]) {
    test(`the god ${existing ? 'moves above tiles' : 'appears with its tile'} and reverses on Undo`, async ({
        page
    }) => {
        await page.goto('/')
        const placed: PlacementFrames = await page.evaluate(async (existing) => {
            const fixture = await import(
                new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
            )
            await fixture.setup(existing ? 'existing-god' : 'new-god')
            return fixture.recordPlacement('god')
        }, existing)
        if (existing) {
            expect(
                placed.some((frame) => Math.abs(frame.pieceX) > 1 || Math.abs(frame.pieceY) > 1)
            ).toBe(true)
        } else {
            expect(placed.some((frame) => frame.pieceOpacity > 0 && frame.pieceOpacity < 1)).toBe(
                true
            )
            expect(
                placed.every((frame) => Math.abs(frame.pieceOpacity - frame.tileOpacity) < 0.1)
            ).toBe(true)
        }
        const removed: PlacementFrames = await page.evaluate(async () => {
            const fixture = await import(
                new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
            )
            return fixture.recordPlacement('god', true)
        })
        if (existing) {
            expect(
                removed.some((frame) => Math.abs(frame.pieceX) > 1 || Math.abs(frame.pieceY) > 1)
            ).toBe(true)
            await expect(page.locator('[data-god]')).toHaveCount(1)
        } else {
            expect(
                removed.every(
                    (frame) => Math.abs(frame.pieceX) < 0.1 && Math.abs(frame.pieceY) < 0.1
                )
            ).toBe(true)
            expect(
                removed.every((frame) => Math.abs(frame.pieceOpacity - frame.tileOpacity) < 0.1)
            ).toBe(true)
            await expect(page.locator('[data-god]')).toHaveCount(0)
        }
    })
}

test('sinking and Undo retain both boat identities, motion, and colors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const { moverId, victimId } = await fixture(page)
    await expect(page.locator('[data-boat-id]')).toHaveCount(4)
    const origin = await boatPosition(page, moverId)
    const destination = await boatPosition(page, victimId)
    const victimColor = await page.locator(`[data-boat-id="${victimId}"] svg`).getAttribute('fill')
    await page.evaluate(() => {
        void import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        ).then((fixture) => fixture.move())
    })
    await expect(page.getByTestId('boat-fixture')).toHaveAttribute('data-updating', 'true')
    await expect(page.getByTestId('boat-fixture')).toHaveAttribute('data-updating', 'false')
    await expect(page.locator(`[data-boat-id="${victimId}"]`)).toHaveCount(0)
    expect(await boatPosition(page, moverId)).toEqual(destination)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.undo()
    })
    await expect(page.locator('[data-boat-id]')).toHaveCount(4)
    expect(await boatPosition(page, moverId)).toEqual(origin)
    expect(await boatPosition(page, victimId)).toEqual(destination)
    expect(await page.locator(`[data-boat-id="${victimId}"] svg`).getAttribute('fill')).toBe(
        victimColor
    )
    expect(errors).toEqual([])
})

test('destination preview cancels and a previewed move undoes to its original position', async ({
    page
}) => {
    const { moverId } = await fixture(page)
    const origin = await boatPosition(page, moverId)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.preview({ q: 0, r: 1 })
    })
    await expect(page.locator(`[data-boat-id="${moverId}"]`)).toHaveCount(1)
    await expect.poll(async () => (await boatPosition(page, moverId)).y).not.toBe(origin.y)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.preview()
    })
    await expect(page.locator(`[data-boat-id="${moverId}"]`)).toHaveCount(1)
    await expect.poll(() => boatPosition(page, moverId)).toEqual(origin)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.move(false, true)
    })
    expect(
        await page.locator(`[data-boat-id="${moverId}"]`).evaluate((node) => {
            const transform = new DOMMatrix(getComputedStyle(node).transform)
            return { x: transform.e, y: transform.f, scaleX: transform.a, scaleY: transform.d }
        })
    ).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 })
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.undo()
    })
    expect(await boatPosition(page, moverId)).toEqual(origin)
    await expect(page.locator('[data-boat-id]')).toHaveCount(4)
})

test('state-only history, full replay, and silent restoration preserve boat placement', async ({
    page
}) => {
    const { moverId, victimId } = await fixture(page)
    const origin = await boatPosition(page, moverId)
    const destination = await boatPosition(page, victimId)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.move()
        await fixture.history(-1, 'state-only')
    })
    expect(await boatPosition(page, moverId)).toEqual(origin)
    await expect(page.locator('[data-boat-id]')).toHaveCount(4)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.history(0, 'full-action')
    })
    expect(await boatPosition(page, moverId)).toEqual(destination)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.history(-1, 'silent-swap')
    })
    expect(await boatPosition(page, moverId)).toEqual(origin)
    await expect(page.locator('[data-boat-id]')).toHaveCount(4)
})

test('automatic action selection stays transient through Cancel and Undo', async ({ page }) => {
    await fixture(page)
    const initial = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.cancelManualAction()
    })
    expect(initial.manual).toMatchObject({ action: 'Move', source: 'manual', count: 0 })
    expect(initial.after).toMatchObject({ action: 'Move', source: 'auto', count: 0 })
    const after = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.move()
        await fixture.undo()
        return fixture.selection()
    })
    expect(after).toEqual({ action: 'Move', source: 'auto', count: 0 })
})

test('committed movement and Undo interpolate while silent swaps do not', async ({ page }) => {
    const { moverId } = await fixture(page)
    const origin = await boatPosition(page, moverId)
    const forward: RecordedMotion = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.recordMotion('move')
    })
    const positions = forward.frames.flat().filter((boat) => boat.id === moverId)
    const xs = positions.map((boat) => boat.x)
    expect(xs.some((x) => x > Math.min(...xs) + 1 && x < Math.max(...xs) - 1)).toBe(true)
    expect(forward.updating).toBe(false)
    expect(forward.durations).toEqual([0.2])
    const backward: RecordedMotion = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.recordMotion('undo')
    })
    const backXs = backward.frames
        .flat()
        .filter((boat) => boat.id === moverId)
        .map((boat) => boat.x)
    expect(backXs.some((x) => x > Math.min(...backXs) + 1 && x < Math.max(...backXs) - 1)).toBe(
        true
    )
    expect(backward.durations).toEqual([0.2])
    const silent: RecordedMotion = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.move()
        return fixture.recordMotion('silent')
    })
    expect(silent.durations).toEqual([])
    const silentXs = silent.frames
        .flat()
        .filter((boat) => boat.id === moverId)
        .map((boat) => boat.x)
    expect(
        silentXs.every(
            (x) =>
                Math.abs(x - Math.min(...silentXs)) < 1 || Math.abs(x - Math.max(...silentXs)) < 1
        )
    ).toBe(true)
    const replay: RecordedMotion = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        return fixture.recordMotion('replay')
    })
    const replayXs = replay.frames
        .flat()
        .filter((boat) => boat.id === moverId)
        .map((boat) => boat.x)
    expect(
        replayXs.some((x) => x > Math.min(...replayXs) + 1 && x < Math.max(...replayXs) - 1)
    ).toBe(true)
    expect(replay.durations).toEqual([0.2])
    expect(replay.updating).toBe(false)
    await expect(page.locator('[data-boat-id]')).toHaveCount(4)
    expect(await boatPosition(page, moverId)).toEqual(origin)
})

test('rapid preview changes and remounting during a transition release old elements', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const { moverId } = await fixture(page)
    const origin = await boatPosition(page, moverId)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        await fixture.preview({ q: 0, r: 1 })
        await fixture.preview({ q: -1, r: 0 })
        await fixture.preview()
    })
    await expect(page.locator(`[data-boat-id="${moverId}"]`)).toHaveCount(1)
    await expect.poll(() => boatPosition(page, moverId)).toEqual(origin)
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/model/tests/boatTransitions.fixture.ts', location.href).href
        )
        void fixture.move()
        await fixture.dispose()
        await fixture.setup()
    })
    await expect(page.locator('[data-boat-id]')).toHaveCount(4)
    expect(await boatPosition(page, moverId)).toEqual(origin)
    expect(errors).toEqual([])
})
