import { expect, test, type Page } from '@playwright/test'
import { board, collectPageErrors, openScenario, settled } from './helpers.js'

// Art plan, Passenger: a waiting passenger stands up and right in its city's hex, its feet clear
// of the cubes and its head in the hex above, drawn over the cubes so neither hides it, at the
// desktop (1440 × 900) and phone (390 × 844) sizes.
collectPageErrors()

test.beforeEach(async ({ page }, testInfo) => {
    await page.setViewportSize(
        testInfo.project.use.hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    )
})

type ScreenPoint = { x: number; y: number }

/**
 * The screen points of a city's passenger, in the meeple's own units: the middle of its head and
 * a point just above the sole of each foot.
 */
function passengerPoints(page: Page, hexId: string) {
    return board(page).evaluate((svg, id) => {
        const hit = svg.querySelector(`g.hits [data-hex-id="${id}"]`)
        const corners = (hit?.getAttribute('points')?.trim().split(/\s+/) ?? []).map((pair) =>
            pair.split(',').map(Number)
        )
        const centre = corners.reduce(
            ([sx, sy], [x, y]) => [sx + (x ?? 0) / corners.length, sy + (y ?? 0) / corners.length],
            [0, 0]
        )
        // The waiting passenger nearest the hex's centre is its city's own.
        const figures = [...svg.querySelectorAll('g.passengers > g[transform]')].map((figure) => {
            const [, x, y] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(
                figure.getAttribute('transform') ?? ''
            ) ?? ['', '0', '0']
            const distance = Math.hypot(Number(x) - (centre[0] ?? 0), Number(y) - (centre[1] ?? 0))
            return { figure, distance }
        })
        const own = figures.sort((a, b) => a.distance - b.distance)[0]?.figure
        const path = own?.querySelector('[data-passenger="waiting"] path')
        if (!(path instanceof SVGPathElement)) throw new Error(`no passenger in ${id}`)
        const matrix = path.getScreenCTM() ?? undefined
        const at = (x: number, y: number) => {
            const point = new DOMPoint(x, y).matrixTransform(matrix)
            return { x: point.x, y: point.y }
        }
        return { head: at(0, -4.9), leftFoot: at(-2.1, 6), rightFoot: at(2.1, 6) }
    }, hexId)
}

/** What is drawn at a screen point, top first, each shape named by its layer. */
function drawnAt(page: Page, point: ScreenPoint) {
    return board(page).evaluate(
        (svg, [px, py]) => {
            // Every shape takes the hit test for this read only, so the stack is the paint order.
            const style = document.createElement('style')
            style.textContent = '[data-map-board] * { pointer-events: visiblePainted !important; }'
            document.head.append(style)
            const stack = document.elementsFromPoint(px ?? 0, py ?? 0)
            style.remove()
            const layers = [
                'hits',
                'picks',
                'flights',
                'scrim',
                'passengers',
                'track',
                'lines',
                'cities',
                'ground'
            ]
            return stack
                .filter((element) => element !== svg && svg.contains(element))
                .map(
                    (element) =>
                        layers.find((layer) => element.closest(`g.${layer}`)) ??
                        element.closest('g[class]')?.getAttribute('class') ??
                        element.tagName
                )
        },
        [point.x, point.y]
    )
}

/** Whether a screen point is on screen and on the board, not under a control over it. */
function onBoard(page: Page, point: ScreenPoint) {
    const view = page.viewportSize()
    if (!view || point.x < 0 || point.y < 0 || point.x > view.width || point.y > view.height) {
        return Promise.resolve(false)
    }
    return page.evaluate(
        ([px, py]) =>
            document.elementFromPoint(px ?? 0, py ?? 0)?.closest('[data-map-board]') !== null,
        [point.x, point.y]
    )
}

/**
 * Zooms out until each of these cities' passengers is wholly on screen: the phone's board rests
 * zoomed in.
 */
async function showPassengers(page: Page, hexIds: string[]) {
    const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
    const allOnBoard = async () => {
        for (const hexId of hexIds) {
            const points = Object.values(await passengerPoints(page, hexId))
            for (const point of points) if (!(await onBoard(page, point))) return false
        }
        return true
    }
    for (let step = 0; step < 6 && !(await allOnBoard()); step++) {
        if (test.info().project.use.hasTouch) await zoomOut.tap()
        else await zoomOut.click()
        await settled(page)
    }
    await expect.poll(allOnBoard).toBe(true)
}

const CASES = [
    // Baltimore holds Red, a lone cube in the middle of the hex.
    { scenario: 'Two railroads meet', city: 'Baltimore', hexId: 'hex.usa.9-55', railroads: 1 },
    // Montréal holds Red and Orange side by side, on a flat hex.
    { scenario: 'Canada link in reach', city: 'Montréal', hexId: 'hex.ca.24-10', railroads: 2 }
]

for (const { scenario, city, hexId, railroads } of CASES) {
    test(`${city}'s passenger stands clear over its cubes, on top at its head and feet (${scenario})`, async ({
        page
    }) => {
        await openScenario(page, scenario)
        await settled(page)
        const held = await page.evaluate((id) => {
            const track: Record<string, string[] | undefined> = window.rtrSession.gameState.track
            return (track[id] ?? []).length
        }, hexId)
        expect(held).toBe(railroads)

        await showPassengers(page, [hexId])

        // Under the hit targets, picks and flights, and the pick's scrim (a translucent wash over
        // the land, holed at the lit hexes), the passenger is the topmost shape drawn at its head
        // and at each foot: no cube covers it.
        const points = await passengerPoints(page, hexId)
        for (const [part, point] of Object.entries(points)) {
            const drawn = (await drawnAt(page, point)).filter(
                (layer) => !['hits', 'picks', 'flights', 'scrim'].includes(layer)
            )
            expect(drawn[0], `${city}'s passenger's ${part}: ${drawn.join(' > ')}`).toBe(
                'passengers'
            )
        }

        // A press on its head still reaches a hex's hit target, as any press on the board does.
        const pressed = await page.evaluate(
            ([px, py]) =>
                document
                    .elementFromPoint(px ?? 0, py ?? 0)
                    ?.closest('g.hits [data-hex-id]')
                    ?.getAttribute('data-hex-id') ?? null,
            [points.head.x, points.head.y]
        )
        expect(pressed).not.toBeNull()
    })
}

const LIT_CASES = [
    // Milwaukee lights to start a journey with its passenger; Minneapolis, also waiting, does not.
    // (Each unlit city's head stands over land: the scrim never covers the sea.)
    {
        scenario: 'Journey choices',
        city: 'Milwaukee',
        hexId: 'hex.usa.3-41',
        unlitCity: 'Minneapolis',
        unlitHexId: 'hex.usa.2-36'
    },
    // Paris, on a flat hex, lights for Red; Reims does not.
    {
        scenario: 'France paris ring',
        city: 'Paris',
        hexId: 'hex.fr.13-13',
        unlitCity: 'Reims',
        unlitHexId: 'hex.fr.17-9'
    }
]

for (const { scenario, city, hexId, unlitCity, unlitHexId } of LIT_CASES) {
    test(`${city}'s passenger stays undimmed in a pick, the scrim under it; ${unlitCity}'s stays dimmed (${scenario})`, async ({
        page
    }) => {
        await openScenario(page, scenario)
        await settled(page)
        const holes = await page.evaluate(() => window.rtrSession.boardOffer.scrim?.holes ?? [])
        expect(holes).toContain(hexId)
        expect(holes).not.toContain(unlitHexId)

        await showPassengers(page, [hexId, unlitHexId])

        // The lit city's passenger stands mostly in the hex above, outside its hex's hole, yet no
        // part of the scrim is drawn over it: under the hit targets, picks and flights it is the
        // topmost shape at its head and at each foot.
        for (const [part, point] of Object.entries(await passengerPoints(page, hexId))) {
            const drawn = (await drawnAt(page, point)).filter(
                (layer) => !['hits', 'picks', 'flights'].includes(layer)
            )
            expect(drawn[0], `${city}'s passenger's ${part}: ${drawn.join(' > ')}`).toBe(
                'passengers'
            )
        }

        // An unlit city's passenger is dimmed with its hex: the scrim is drawn right over it, at
        // its head and at each foot.
        for (const [part, point] of Object.entries(await passengerPoints(page, unlitHexId))) {
            const drawn = (await drawnAt(page, point)).filter(
                (layer) => !['hits', 'picks', 'flights'].includes(layer)
            )
            expect(
                drawn.slice(0, 2),
                `${unlitCity}'s passenger's ${part}: ${drawn.join(' > ')}`
            ).toEqual(['scrim', 'passengers'])
        }
    })
}
