import { expect, test, type Page } from '@playwright/test'
import { pointAt } from '@tabletop/gipf-potentials'
import type { GipfPotentialsGameSession } from '../src/lib/model/session.svelte.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of the board's view-scale zoom,
// so nothing on the board may carry one, on any frame of a move.

declare global {
    interface Window {
        gipfPotentialsSession: GipfPotentialsGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function openScenario(page: Page, name: string) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.gipfPotentialsSession = getContext();'
            )
        })
    })
    await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.gipfPotentialsSession)).toBe(true)
    await page.clock.runFor(1500)
}

// Each transform on the board, sampled every 20 ms of the paused clock while the started step plays.
async function transformsWhile(page: Page, start: () => Promise<void>): Promise<string[]> {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await start()
    const seen = new Set<string>()
    for (let time = 0; time <= 1200; time += 20) {
        const transforms = await page.evaluate(() =>
            [...document.querySelectorAll('svg.gp-board [transform]')].map(
                (node) => node.getAttribute('transform') ?? ''
            )
        )
        for (const transform of transforms) seen.add(transform)
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    return [...seen]
}

function moving(transforms: string[]) {
    return transforms.filter((transform) => /translate\(-?\d*\.?\d+ -?\d*[1-9]/.test(transform))
}

test('a push, a row taken and its Undo move pieces with translate() alone', async ({ page }) => {
    await openScenario(page, 'Take a row')
    const seen = await transformsWhile(page, () =>
        page.evaluate(
            ([dot, to]) => {
                const session = window.gipfPotentialsSession
                session.chooseDot(dot)
                void session.push(to)
            },
            [pointAt('E1'), pointAt('E2')]
        )
    )
    seen.push(
        ...(await transformsWhile(page, () =>
            page.evaluate(() => void window.gipfPotentialsSession.removeChosenRow())
        )),
        ...(await transformsWhile(page, () =>
            page.evaluate(() => void window.gipfPotentialsSession.undo())
        ))
    )
    expect(moving(seen).length).toBeGreaterThan(0)
    expect(seen.filter((transform) => transform.includes('matrix('))).toEqual([])
})

test('a hop and a PÜNCT cover move pieces with translate() alone', async ({ page }) => {
    const seen: string[] = []
    for (const [from, to, cover] of [
        ['C4', 'F3', 0],
        ['G3', 'H2', 2]
    ] as const) {
        await openScenario(page, 'Potentials')
        seen.push(
            ...(await transformsWhile(page, () =>
                page.evaluate(
                    ([from, to, cover]) => {
                        const session = window.gipfPotentialsSession
                        session.chooseFrom(from)
                        const moved = session.movePotential(to)
                        if (cover > 0) void moved.then(() => session.coverWith(cover))
                    },
                    [pointAt(from), pointAt(to), cover] as const
                )
            ))
        )
    }
    expect(moving(seen).length).toBeGreaterThan(0)
    expect(seen.filter((transform) => transform.includes('matrix('))).toEqual([])
})
