import { expect, test, type Page } from '@playwright/test'
import {
    board,
    collectPageErrors,
    litHex,
    litHexes,
    openScenario,
    pressHex,
    reportRectsUnzoomed,
    settled
} from './helpers.js'

// Contract, Animation plan: a placement's locomotive lands in its slot and a journey's passenger
// ends on its last city, wherever the board is drawn. A phone draws both above the board, in the
// board's units mapped to where the board is on screen, so the mapping is measured here.
collectPageErrors()

type Landing = { dx: number; dy: number; x: number; y: number }

/**
 * Each frame, how far every flyer is drawn from a copy of it placed inside the board's own SVG,
 * which the board draws in its own units, and the flyer's last position in board units. Boxes are
 * read as drawn, with the browser's own `getBoundingClientRect` kept by `reportRectsUnzoomed`.
 */
function watchLandings(page: Page): Promise<void> {
    return page.evaluate(() => {
        const rect: (element: Element) => DOMRect =
            Reflect.get(window, 'rtrDrawnRect') ?? ((element) => element.getBoundingClientRect())
        const root = document.querySelector('svg[data-map-board]')
        if (!root) throw new Error('The board is not drawn')
        const copies = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        copies.setAttribute('opacity', '0')
        copies.setAttribute('pointer-events', 'none')
        root.append(copies)
        const landings: Record<string, Landing> = {}
        Reflect.set(window, 'rtrLandings', landings)
        const watch = () => {
            const flyers = [...document.querySelectorAll<SVGGElement>('[data-flyer]')].filter(
                (flyer) => !copies.contains(flyer)
            )
            for (const flyer of flyers) {
                const box = rect(flyer)
                if (box.width === 0) continue
                const copy = flyer.cloneNode(true)
                copies.replaceChildren(copy)
                if (!(copy instanceof Element)) continue
                const drawn = rect(copy)
                const at = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(
                    flyer.getAttribute('transform') ?? ''
                )
                landings[flyer.dataset.flyer ?? ''] = {
                    dx: box.left + box.width / 2 - (drawn.left + drawn.width / 2),
                    dy: box.top + box.height / 2 - (drawn.top + drawn.height / 2),
                    x: Number(at?.[1]),
                    y: Number(at?.[2])
                }
            }
            requestAnimationFrame(watch)
        }
        watch()
    })
}

async function landing(page: Page, prefix: string): Promise<Landing> {
    const landings: Record<string, Landing> = JSON.parse(
        await page.evaluate(() => JSON.stringify(Reflect.get(window, 'rtrLandings') ?? {}))
    )
    const key = Object.keys(landings).find((name) => name.startsWith(prefix))
    expect(key, `a ${prefix} flyer was drawn`).toBeDefined()
    return landings[key ?? ''] ?? { dx: NaN, dy: NaN, x: NaN, y: NaN }
}

/** The centres of the board's cubes, in board units. */
function cubeCentres(page: Page): Promise<{ x: number; y: number }[]> {
    return board(page)
        .locator('g.track rect[data-cube]')
        .evaluateAll((cubes) =>
            cubes.map((cube) => ({
                x: Number(cube.getAttribute('x')) + Number(cube.getAttribute('width')) / 2,
                y: Number(cube.getAttribute('y')) + Number(cube.getAttribute('height')) / 2
            }))
        )
}

/** A city's centre, in board units. */
async function cityCentre(page: Page, cityId: string): Promise<{ x: number; y: number }> {
    const transform = await board(page)
        .locator(`[data-city-marks="${cityId}"]`)
        .getAttribute('transform')
    const at = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(transform ?? '')
    return { x: Number(at?.[1]), y: Number(at?.[2]) }
}

async function dragBoard(page: Page, dx: number, dy: number) {
    const box = await board(page).evaluate((root) => {
        let frame: Element | null = root.parentElement
        while (frame && getComputedStyle(frame).overflow === 'visible') frame = frame.parentElement
        const clip = frame?.getBoundingClientRect()
        return {
            x: (clip?.left ?? 0) + (clip?.width ?? 0) / 2,
            y: (clip?.top ?? 0) + (clip?.height ?? 0) / 2
        }
    })
    await page.mouse.move(box.x, box.y)
    await page.mouse.down()
    for (let step = 1; step <= 10; step++) {
        await page.mouse.move(box.x + (dx * step) / 10, box.y + (dy * step) / 10)
    }
    await page.mouse.up()
}

const VIEWS: { name: string; set: (page: Page) => Promise<void> }[] = [
    { name: 'at rest', set: async () => {} },
    { name: 'after a pan', set: (page) => dragBoard(page, -40, 20) },
    {
        name: 'zoomed in',
        set: (page) => page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    }
]

async function placeAndMeasure(page: Page) {
    await settled(page)
    await watchLandings(page)
    await pressHex(page, litHexes(page).first())
    await settled(page)
    const locomotive = await landing(page, 'locomotive:')
    expect(Math.abs(locomotive.dx)).toBeLessThanOrEqual(1)
    expect(Math.abs(locomotive.dy)).toBeLessThanOrEqual(1)
    const nearest = Math.min(
        ...(await cubeCentres(page)).map((cube) =>
            Math.hypot(cube.x - locomotive.x, cube.y - locomotive.y)
        )
    )
    expect(nearest).toBeLessThanOrEqual(1)
}

async function rideAndMeasure(page: Page) {
    await settled(page)
    await pressHex(page, litHex(page, 'Washington: start a journey with its passenger'))
    await pressHex(page, litHex(page, 'Baltimore: link by Blue'))
    await watchLandings(page)
    await page
        .getByRole('button', { name: 'Ride', exact: true })
        .and(page.locator('button:not([data-map-ride])'))
        .click()
    await settled(page)
    const passenger = await landing(page, 'flyer:passenger:')
    expect(Math.abs(passenger.dx)).toBeLessThanOrEqual(1)
    expect(Math.abs(passenger.dy)).toBeLessThanOrEqual(1)
    const baltimore = await cityCentre(page, 'city.usa.baltimore')
    expect(Math.hypot(passenger.x - baltimore.x, passenger.y - baltimore.y)).toBeLessThanOrEqual(1)
}

for (const view of VIEWS) {
    test(`A placed locomotive lands in its slot, ${view.name}`, async ({ page }) => {
        await openScenario(page, 'First placement')
        await view.set(page)
        await placeAndMeasure(page)
    })

    test(`A journey's passenger ends on its last city, ${view.name}`, async ({ page }) => {
        await openScenario(page, 'Round one ends')
        await view.set(page)
        await rideAndMeasure(page)
    })
}

test('Flights land on target where the browser reports boxes inside CSS zoom unzoomed', async ({
    page
}) => {
    await reportRectsUnzoomed(page)
    await openScenario(page, 'First placement')
    await placeAndMeasure(page)
    await openScenario(page, 'Round one ends')
    await rideAndMeasure(page)
})
