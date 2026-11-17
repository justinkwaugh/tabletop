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
                'impassable',
                'track',
                'lines',
                'cities',
                'ground'
            ]
            // In a pick an unlit city's passenger lays the scrim's own fill over itself (it is
            // drawn above the scrim, over the red impassable lines): that shade is the scrim too.
            return stack
                .filter((element) => element !== svg && svg.contains(element))
                .map((element) =>
                    element.closest('[data-scrim-shade]')
                        ? 'scrim'
                        : (layers.find((layer) => element.closest(`g.${layer}`)) ??
                          element.closest('g[class]')?.getAttribute('class') ??
                          element.tagName)
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

/**
 * A screen point where a city's passenger stands over an impassable side's red line, well inside
 * both: the figure's fill half a unit round it in its own units, and the red stroke (not only
 * its pale casing) a board unit round it. `candidates` counts the points that qualified.
 */
function crossingPoint(page: Page, hexId: string) {
    return board(page).evaluate((svg, id) => {
        if (!(svg instanceof SVGSVGElement)) throw new Error('the board is not an SVG')
        const hit = svg.querySelector(`g.hits [data-hex-id="${id}"]`)
        const corners = (hit?.getAttribute('points')?.trim().split(/\s+/) ?? []).map((pair) =>
            pair.split(',').map(Number)
        )
        const centre = corners.reduce(
            ([sx, sy], [x, y]) => [sx + (x ?? 0) / corners.length, sy + (y ?? 0) / corners.length],
            [0, 0]
        )
        // The waiting passenger nearest the hex's centre is its city's own.
        const own = [...svg.querySelectorAll('g.passengers > g[transform]')]
            .map((figure) => {
                const [, x, y] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(
                    figure.getAttribute('transform') ?? ''
                ) ?? ['', '0', '0']
                return {
                    figure,
                    distance: Math.hypot(Number(x) - (centre[0] ?? 0), Number(y) - (centre[1] ?? 0))
                }
            })
            .sort((a, b) => a.distance - b.distance)[0]?.figure
        const path = own?.querySelector('[data-passenger="waiting"] path')
        if (!(path instanceof SVGPathElement)) throw new Error(`no passenger in ${id}`)
        const red = svg.querySelector('[data-impassable-sides] path:last-of-type')
        if (!(red instanceof SVGPathElement)) throw new Error('no impassable side')
        // The figure's own units to board units.
        const toBoard = (svg.getScreenCTM()?.inverse() ?? new DOMMatrix()).multiply(
            path.getScreenCTM() ?? new DOMMatrix()
        )
        const inFigure = (x: number, y: number) =>
            [
                [0, 0],
                [0.5, 0.5],
                [0.5, -0.5],
                [-0.5, 0.5],
                [-0.5, -0.5]
            ].every(([dx, dy]) => path.isPointInFill(new DOMPoint(x + (dx ?? 0), y + (dy ?? 0))))
        const onRed = (point: DOMPoint) =>
            [
                [0, 0],
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ].every(([dx, dy]) =>
                red.isPointInStroke(new DOMPoint(point.x + (dx ?? 0), point.y + (dy ?? 0)))
            )
        const found: DOMPoint[] = []
        for (let x = -5; x <= 5; x += 0.2) {
            for (let y = -7.5; y <= 6.8; y += 0.2) {
                if (inFigure(x, y) && onRed(new DOMPoint(x, y).matrixTransform(toBoard))) {
                    found.push(new DOMPoint(x, y))
                }
            }
        }
        const middle = found[Math.floor(found.length / 2)] ?? new DOMPoint()
        const screen = middle.matrixTransform(path.getScreenCTM() ?? undefined)
        return { x: screen.x, y: screen.y, candidates: found.length }
    }, hexId)
}

/**
 * Points on an impassable side's red line by a lit hex, clear of every passenger: `inLit`, the
 * middle one inside the lit hex (a hole in the scrim), if any is clear, and `beside`, the one
 * nearest the lit hex's centre over a hex the scrim dims. `reaches` counts the line's points
 * inside the lit hex, passengers or not.
 */
function besideLit(page: Page, litHexId: string, holes: string[]) {
    return board(page).evaluate(
        (svg, [lit, holeIds]) => {
            if (!(svg instanceof SVGSVGElement)) throw new Error('the board is not an SVG')
            const red = svg.querySelector('[data-impassable-sides] path:last-of-type')
            if (!(red instanceof SVGPathElement)) throw new Error('no impassable side')
            const hexes = [...svg.querySelectorAll('g.hits [data-hex-id]')].filter(
                (hex): hex is SVGPolygonElement => hex instanceof SVGPolygonElement
            )
            const hexOf = (point: DOMPoint) =>
                hexes.find((hex) => hex.isPointInFill(point))?.getAttribute('data-hex-id')
            // The hex a point stands in, a unit clear of its sides; none on a side.
            const hexAt = (point: DOMPoint) => {
                const id = hexOf(point)
                const firm = [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1]
                ].every(([dx, dy]) => hexOf(new DOMPoint(point.x + dx, point.y + dy)) === id)
                return firm ? id : undefined
            }
            const litHex = hexes.find((hex) => hex.getAttribute('data-hex-id') === lit)
            if (!litHex) throw new Error(`no hex ${lit}`)
            const corners = [...litHex.points]
            const centre = new DOMPoint(
                corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
                corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length
            )
            // Each waiting passenger's shape, with board units to its own.
            const figures = [
                ...svg.querySelectorAll('g.passengers [data-passenger="waiting"] path')
            ]
                .filter((path): path is SVGPathElement => path instanceof SVGPathElement)
                .map((path) => ({
                    path,
                    toFigure: (path.getScreenCTM() ?? new DOMMatrix())
                        .inverse()
                        .multiply(svg.getScreenCTM() ?? new DOMMatrix())
                }))
            // Clear of every passenger, its edge included, by 2 board units.
            const clear = (point: DOMPoint) =>
                figures.every(({ path, toFigure }) =>
                    [
                        [0, 0],
                        [2, 0],
                        [-2, 0],
                        [0, 2],
                        [0, -2]
                    ].every(([dx, dy]) => {
                        const own = new DOMPoint(
                            point.x + (dx ?? 0),
                            point.y + (dy ?? 0)
                        ).matrixTransform(toFigure)
                        return !path.isPointInFill(own) && !path.isPointInStroke(own)
                    })
                )
            const away = (point: DOMPoint) => Math.hypot(point.x - centre.x, point.y - centre.y)
            let reaches = 0
            const inLit: DOMPoint[] = []
            const dimmed: DOMPoint[] = []
            for (let at = 0; at < red.getTotalLength(); at += 0.5) {
                const point = red.getPointAtLength(at)
                // Only the line within about a hex of the lit one.
                if (away(point) > 80) continue
                for (const [dx, dy] of [
                    [0, 0],
                    [2, 0],
                    [-2, 0],
                    [0, 2],
                    [0, -2]
                ]) {
                    const near = new DOMPoint(point.x + (dx ?? 0), point.y + (dy ?? 0))
                    if (!red.isPointInStroke(near)) continue
                    const hexId = hexAt(near)
                    if (hexId === lit) reaches++
                    if (!hexId || !clear(near)) continue
                    if (hexId === lit) inLit.push(near)
                    else if (!holeIds.includes(hexId)) dimmed.push(near)
                }
            }
            const nearest = dimmed.sort((a, b) => away(a) - away(b))[0]
            if (!nearest) throw new Error('the red line runs over no dimmed hex')
            const screen = (point: DOMPoint) => {
                const at = point.matrixTransform(svg.getScreenCTM() ?? undefined)
                return { x: at.x, y: at.y }
            }
            const middle = inLit[Math.floor(inLit.length / 2)]
            return {
                reaches,
                inLit: middle ? screen(middle) : undefined,
                beside: screen(nearest),
                distance: away(nearest)
            }
        },
        [litHexId, holes] as const
    )
}

const CAEN = 'hex.fr.8-8'
// Le Havre's neighbour south-east, lit for Orange, where the Seine's red line ends.
const LIT_BESIDE_THE_SEINE = 'hex.fr.9-7'

test("Caen's passenger is drawn over the Seine's red line where its head reaches Le Havre, at rest (France paris ring)", async ({
    page
}) => {
    await openScenario(page, 'France paris ring')
    // A seat not deciding: no pick, so no scrim.
    await page.evaluate(() => window.rtrSession.setViewingAsNonActivePlayer(true))
    await settled(page)
    await expect(board(page).locator('g.scrim path')).toHaveCount(0)
    await showPassengers(page, [CAEN])

    // Under the hit targets, the passenger is the topmost shape where it crosses the line, and
    // the line is drawn there, under it.
    const crossing = await crossingPoint(page, CAEN)
    expect(crossing.candidates).toBeGreaterThan(0)
    const drawn = (await drawnAt(page, crossing)).filter(
        (layer) => !['hits', 'picks', 'flights'].includes(layer)
    )
    expect(drawn[0], drawn.join(' > ')).toBe('passengers')
    expect(drawn, drawn.join(' > ')).toContain('impassable')
})

test("In a pick, the Seine's red line stays undimmed beside a lit hex, and Caen's unlit passenger stays dimmed, over the line (France paris ring)", async ({
    page
}) => {
    await openScenario(page, 'France paris ring')
    await settled(page)
    const holes = await page.evaluate(() => window.rtrSession.boardOffer.scrim?.holes ?? [])
    expect(holes).toContain(LIT_BESIDE_THE_SEINE)
    expect(holes).not.toContain(CAEN)
    await showPassengers(page, [CAEN])

    // Caen's passenger, unlit, is over the red line and dimmed: the scrim's fill is right over
    // it, then the figure, then the line, and the scrim proper under the line.
    const crossing = await crossingPoint(page, CAEN)
    expect(crossing.candidates).toBeGreaterThan(0)
    const atCaen = (await drawnAt(page, crossing)).filter(
        (layer) => !['hits', 'picks', 'flights'].includes(layer)
    )
    expect(atCaen.slice(0, 3), atCaen.join(' > ')).toEqual(['scrim', 'passengers', 'impassable'])
    expect(atCaen.lastIndexOf('scrim'), atCaen.join(' > ')).toBeGreaterThan(2)
    // And dimmed whole, at its head (in Le Havre's hex) and at each foot.
    for (const [part, point] of Object.entries(await passengerPoints(page, CAEN))) {
        const drawn = (await drawnAt(page, point)).filter(
            (layer) => !['hits', 'picks', 'flights'].includes(layer)
        )
        expect(drawn.slice(0, 2), `Caen's passenger's ${part}: ${drawn.join(' > ')}`).toEqual([
            'scrim',
            'passengers'
        ])
    }

    // The line itself is never dimmed. It reaches the lit hex, where Caen's shoulder stands over
    // its end, and past Caen, over hexes the scrim dims, it is the topmost shape, the scrim under
    // it.
    const line = await besideLit(page, LIT_BESIDE_THE_SEINE, holes)
    expect(line.reaches).toBeGreaterThan(0)
    expect(await onBoard(page, line.beside)).toBe(true)
    const beside = (await drawnAt(page, line.beside)).filter(
        (layer) => !['hits', 'picks', 'flights'].includes(layer)
    )
    expect(beside[0], beside.join(' > ')).toBe('impassable')
    expect(beside.indexOf('scrim'), beside.join(' > ')).toBeGreaterThan(0)
})

test('In a pick, an impassable side’s red line is undimmed in and beside a lit hex (Canada toronto)', async ({
    page
}) => {
    // Toronto's neighbour to the south-west lights, and its south side, on the lake, is impassable.
    const lit = 'hex.ca.10-22'
    await openScenario(page, 'Canada toronto')
    await settled(page)
    const holes = await page.evaluate(() => window.rtrSession.boardOffer.scrim?.holes ?? [])
    expect(holes).toContain(lit)

    // The phone's board rests zoomed in: zoom out until both points are on screen.
    const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
    const pointsOnBoard = async () => {
        const line = await besideLit(page, lit, holes)
        return (
            line.inLit !== undefined &&
            (await onBoard(page, line.inLit)) &&
            (await onBoard(page, line.beside))
        )
    }
    for (let step = 0; step < 6 && !(await pointsOnBoard()); step++) {
        if (test.info().project.use.hasTouch) await zoomOut.tap()
        else await zoomOut.click()
        await settled(page)
    }
    await expect.poll(pointsOnBoard).toBe(true)

    const line = await besideLit(page, lit, holes)
    expect(line.distance).toBeLessThan(60)
    if (!line.inLit) throw new Error(`no point of the line clear in ${lit}`)
    // In the hole the line is topmost, with no scrim anywhere under it.
    const inLit = (await drawnAt(page, line.inLit)).filter(
        (layer) => !['hits', 'picks', 'flights'].includes(layer)
    )
    expect(inLit[0], inLit.join(' > ')).toBe('impassable')
    expect(inLit, inLit.join(' > ')).not.toContain('scrim')
    // Beside it, over a dimmed hex, the line is topmost too, the scrim under it.
    const beside = (await drawnAt(page, line.beside)).filter(
        (layer) => !['hits', 'picks', 'flights'].includes(layer)
    )
    expect(beside[0], beside.join(' > ')).toBe('impassable')
    expect(beside.indexOf('scrim'), beside.join(' > ')).toBeGreaterThan(0)
})
