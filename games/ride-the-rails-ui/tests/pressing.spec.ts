import { expect, test, type Page } from '@playwright/test'
import { board, collectPageErrors, openScenario, settled } from './helpers.js'

// The contract's Phone layout and Look: hex detail: a press goes to the hex under it, even on the
// whole map, where a hex is a few pixels wide and a lit neighbour sits beside it.
collectPageErrors()

type HexOnScreen = { hexId: string; x: number; y: number }

/** Zooms out as far as the board goes: on phones the whole map, where hexes are smallest. */
async function wholeMap(page: Page) {
    const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
    for (let step = 0; step < 10 && (await zoomOut.isEnabled()); step++) {
        if (test.info().project.use.hasTouch) await zoomOut.tap()
        else await zoomOut.click()
        await page.waitForTimeout(300)
    }
    await settled(page)
}

/**
 * Unlit hexes beside a lit one, with the screen point at each one's centre, where the topmost
 * element is that hex's own hit polygon.
 */
function unlitBesideLit(page: Page): Promise<HexOnScreen[]> {
    return board(page).evaluate((root) => {
        const hits = [...root.querySelectorAll<SVGPolygonElement>('g.hits polygon[data-hex-id]')]
        const lit = new Set(
            hits
                .filter((hit) => hit.getAttribute('role') === 'button')
                .map((hit) => hit.dataset.hexId)
        )
        const byId = new Map(hits.map((hit) => [hit.dataset.hexId, hit]))
        const found: { hexId: string; x: number; y: number }[] = []
        for (const hexId of lit) {
            const [row, column] = (hexId ?? '').replace('hex.usa.', '').split('-').map(Number)
            const neighbours = [
                [row, column - 2],
                [row, column + 2],
                [row - 1, column - 1],
                [row - 1, column + 1],
                [row + 1, column - 1],
                [row + 1, column + 1]
            ].map(([r, c]) => `hex.usa.${r}-${c}`)
            for (const neighbour of neighbours) {
                const hit = byId.get(neighbour)
                if (!hit || lit.has(neighbour) || found.some((hex) => hex.hexId === neighbour)) {
                    continue
                }
                const box = hit.getBoundingClientRect()
                const x = box.left + box.width / 2
                const y = box.top + box.height / 2
                const onTop = document.elementFromPoint(x, y)
                if (onTop === hit && x > 0 && y > 0 && x < innerWidth && y < innerHeight) {
                    found.push({ hexId: neighbour, x, y })
                }
            }
        }
        return found
    })
}

function trackCount(page: Page): Promise<number> {
    return page.evaluate(
        () =>
            Object.values(window.rtrSession.gameState.track).flatMap((railroads) => railroads)
                .length
    )
}

/** A lit hex whose centre is on screen, with its own hit polygon on top there. */
async function litCentre(page: Page): Promise<HexOnScreen> {
    const found = await board(page).evaluate((root) => {
        for (const hit of root.querySelectorAll<SVGPolygonElement>('g.hits [role="button"]')) {
            const box = hit.getBoundingClientRect()
            const x = box.left + box.width / 2
            const y = box.top + box.height / 2
            if (document.elementFromPoint(x, y) === hit) {
                return { hexId: hit.dataset.hexId ?? '', x, y }
            }
        }
        return undefined
    })
    expect(found).toBeDefined()
    return found ?? { hexId: '', x: 0, y: 0 }
}

async function press(page: Page, x: number, y: number) {
    if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y)
    else await page.mouse.click(x, y)
    await settled(page)
}

test('On the whole map a press on an unlit hex beside a lit one shows that hex', async ({
    page
}) => {
    await openScenario(page, 'Two railroads meet')
    await wholeMap(page)
    const hexes = await unlitBesideLit(page)
    expect(hexes.length).toBeGreaterThan(5)
    for (const hex of hexes.slice(0, 12)) {
        await press(page, hex.x, hex.y)
        expect(await page.evaluate(() => window.rtrSession.hexDetailHexId)).toBe(hex.hexId)
        expect(await page.evaluate(() => window.rtrSession.buildHexId)).toBeUndefined()
        await page.keyboard.press('Escape')
        await settled(page)
    }

    // A press at a lit hex's centre still picks it.
    const before = await trackCount(page)
    const lit = await litCentre(page)
    await press(page, lit.x, lit.y)
    const picked = await page.evaluate(() => window.rtrSession.buildHexId)
    expect(picked === lit.hexId || (await trackCount(page)) === before + 1).toBe(true)
})
