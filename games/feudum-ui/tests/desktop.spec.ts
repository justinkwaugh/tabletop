import type { Point } from '@tabletop/common'
import { existsSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { ActionType } from '@tabletop/feudum'
import { settled } from './helpers.js'
import { StarPath } from '../src/lib/utils/pieceShapes.js'
import { openFixture } from './scenarioTable.js'

/**
 * A desk at 1440 x 900, and a small laptop at 1280 x 720: where things stand on the real table, read
 * off the page.
 */

const problems = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const seen: string[] = []
    problems.set(page, seen)
    page.on('pageerror', (error) => seen.push(error.message))
    page.on('console', (message) => {
        if (/Error (applying|handling)/.test(message.text())) {
            seen.push(message.text())
        }
    })
})

test.afterEach(({ page }) => {
    expect(problems.get(page)).toEqual([])
})

const panel = (page: Page) => page.locator('[data-action-panel]')

const Target = 44

/** How far a press at a target's middle reaches across and down while still landing on it. */
async function reach(target: Locator) {
    return target.evaluate((element, wanted) => {
        const { x, y, width, height } = element.getBoundingClientRect()
        const middle = { x: x + width / 2, y: y + height / 2 }
        const inside = (px: number, py: number) => {
            const hit = document.elementFromPoint(px, py)
            return hit !== null && (hit === element || element.contains(hit))
        }
        const along = (step: (n: number) => [number, number]) => {
            let n = 0
            while (n < wanted && inside(...step(n + 1))) {
                n += 1
            }
            return n
        }
        const across =
            along((n) => [middle.x + n, middle.y]) + along((n) => [middle.x - n, middle.y])
        const down = along((n) => [middle.x, middle.y + n]) + along((n) => [middle.x, middle.y - n])
        return { across: across + 1, down: down + 1 }
    }, Target)
}

/** On a desk, opens the side a guild area stands on, unless a pick opened it already. */
async function openSideOf(page: Page, guild: string) {
    const side = ['alchemist', 'merchant', 'farmer'].includes(guild) ? 'west' : 'east'
    if ((await page.locator(`[data-guild-view="${side}"]`).count()) === 0) {
        await page.locator(`[data-guild-side="${side}"]`).click()
        await settled(page)
    }
}

async function openFunction(page: Page, scene: string, guild: string, fn: RegExp) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import { openBenchTable } from '/src/lib/testing/benchTablePage.ts'
            await openBenchTable('${scene}')
            document.body.dataset.benchTable = ''`
    })
    await page.waitForSelector('body[data-bench-table]', { timeout: 45_000 })
    await settled(page)
    await panel(page)
        .getByRole('button', { name: /^Guild/ })
        .first()
        .click()
    await settled(page)
    if ((await page.locator('[data-board-popup]').count()) === 0) {
        await openSideOf(page, guild)
        await page.locator(`[data-guild-view] [data-pick="guild:${guild}"]`).click()
        await settled(page)
    }
    await page.locator('[data-board-popup] button').filter({ hasText: fn }).first().click()
    await settled(page)
}

async function rect(target: Locator) {
    const box = await target.boundingBox()
    if (!box) {
        throw new Error('not on the page')
    }
    return box
}

function holds(box: { x: number; y: number; width: number; height: number }, { x, y }: Point) {
    return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
}

/** The table's first seat, whose turn it is, sends a function of its Guild card. */
async function sentByTrader(page: Page, guildId: string, params: Record<string, unknown>) {
    await page.evaluate(
        ([type, guild, sent]) => {
            const { host } = window.feudumFixture
            const [trader] = host.order
            return host.send(trader, { type, guildId: guild, fn: 'trade', params: sent })
        },
        [ActionType.GuildAction, guildId, params] as const
    )
    await settled(page)
}

/**
 * What moved while `act` ran, frame by frame: each flying copy's row and where it stood first and
 * last; where each token or piece stood while it moved inside an open guild side; and how many
 * pieces in that side were hidden at once while their copies flew.
 */
async function motionWhile(page: Page, act: () => Promise<void>) {
    await page.evaluate(() => {
        const seen = {
            flights: new Map<string, { row: string; first: Point; last: Point }>(),
            movingInView: [] as Point[],
            hiddenInView: 0
        }
        Object.assign(window, { feudumMotionSeen: seen })
        const centre = (element: Element) => {
            const box = element.getBoundingClientRect()
            return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        }
        const sample = () => {
            for (const copy of document.querySelectorAll('[data-flight]')) {
                if (getComputedStyle(copy).visibility !== 'visible') {
                    continue
                }
                const id = copy.getAttribute('data-flight') ?? ''
                const at = centre(copy)
                const known = seen.flights.get(id)
                if (known) {
                    known.last = at
                } else {
                    seen.flights.set(id, {
                        row: copy.getAttribute('data-flight-row') ?? '',
                        first: at,
                        last: at
                    })
                }
            }
            const view = document.querySelector('[data-guild-view]')
            for (const moving of view?.querySelectorAll('[data-transient], [data-motion]') ?? []) {
                const shown = Number(moving.getAttribute('opacity') ?? '1') > 0
                if (moving.getAttribute('transform') && shown) {
                    seen.movingInView.push(centre(moving))
                }
            }
            const hidden = [...(view?.querySelectorAll('[data-motion]') ?? [])].filter(
                (piece) => piece instanceof SVGElement && piece.style.visibility === 'hidden'
            ).length
            seen.hiddenInView = Math.max(seen.hiddenInView, hidden)
            if (Reflect.get(window, 'feudumMotionSeen') === seen) {
                requestAnimationFrame(sample)
            }
        }
        requestAnimationFrame(sample)
    })
    await act()
    return page.evaluate(() => {
        const seen = Reflect.get(window, 'feudumMotionSeen') as {
            flights: Map<string, { row: string; first: Point; last: Point }>
            movingInView: Point[]
            hiddenInView: number
        }
        Object.assign(window, { feudumMotionSeen: undefined })
        return { ...seen, flights: [...seen.flights.values()] }
    })
}

/** A desk's guild button: "West guilds" or "East guilds". */
/** The two guild buttons, 45 px each, and their 4 px gaps to the map: what the map gives up. */
const Gutters = 2 * (45 + 4)
/** The guild faces are in the folder, so the buttons carry them. */
const printed = existsSync(new URL('../src/lib/art/supplied/face.merchant.webp', import.meta.url))

const sideButton = (page: Page, side: 'West' | 'East') =>
    page.getByRole('button', { name: `${side} guilds`, exact: true })

/** The guilds an open side shows, in order. */
const openGuilds = (page: Page, side: 'west' | 'east') =>
    page
        .locator(`[data-guild-view="${side}"] [data-open-guild]`)
        .evaluateAll((areas) => areas.map((area) => area.getAttribute('data-open-guild')))

test.describe('a 1440 px desk', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('S10a R-3.2 a picked card’s presses and Forfeit share one row in its tray', async ({
        page
    }) => {
        await openFixture(page, 'cards-improve-town')
        await page
            .locator('[data-action-panel] [data-cards="hand"] button.face[aria-label="Improve"]')
            .click()
        const tray = page.locator('[data-card-tray="Improve"]')
        await expect(tray.locator('[data-row="Forfeit"]')).toBeVisible()
        await expect(tray.locator('[data-row^="Tend Landscape"]')).toHaveCount(0)
        const boxes = await Promise.all((await tray.getByRole('button').all()).map(rect))
        const band = boxes.reduce((tall, box) => (box.height > tall.height ? box : tall))
        for (const box of boxes) {
            expect(box.y).toBeLessThan(band.y + band.height)
            expect(box.y + box.height).toBeGreaterThan(band.y)
        }
    })

    test('Contract, Symbol key: a Key button beside the zoom controls opens the vocabulary', async ({
        page
    }) => {
        await openFixture(page, 'cards-tile-gone-epoch-1')
        const toggle = page.locator('[data-symbol-key-toggle]')
        const controls = page.getByRole('button', { name: 'Enter full screen' })
        const beside = await rect(controls)
        const box = await rect(toggle)
        expect(box.x).toBeGreaterThanOrEqual(beside.x + beside.width)
        expect(Math.abs(box.y + box.height - (beside.y + beside.height))).toBeLessThan(8)

        await toggle.click()
        const key = page.getByRole('group', { name: 'Symbol key' })
        await expect(key).toBeVisible()
        await expect(key.locator('[data-key-caption]').first()).toHaveText('Farmer')
        const board = await rect(page.locator('[data-board-view]'))
        const card = await rect(key)
        expect(card.y).toBeGreaterThanOrEqual(board.y - 0.5)
        expect(card.x + card.width).toBeLessThanOrEqual(board.x + board.width + 0.5)
        await page.keyboard.press('Escape')
        await expect(key).toHaveCount(0)
    })

    test('Contract, Supply: no strip under the board; a Supply button beside the Key opens the general supply', async ({
        page
    }) => {
        await openFixture(page, 'cards-tile-gone-epoch-1')
        await expect(page.locator('[data-margin-layer], [data-layer="margin"]')).toHaveCount(0)

        // The board is its own height: the frame reaches past the surface's foot, the desk drawing the
        // map inside the board, and the map fills the view between the guild buttons one way.
        const surface = await rect(page.locator('[data-board-surface]'))
        const frame = await rect(page.locator('[data-board-surface] > svg').first())
        const row = await rect(page.locator('[data-board-row]'))
        const view = await rect(page.locator('[data-board-view]'))
        expect(frame.y + frame.height).toBeGreaterThanOrEqual(surface.y + surface.height - 1)
        expect(Math.abs(row.height - surface.height)).toBeLessThan(1)
        expect(
            Math.max(row.width / (view.width - Gutters), row.height / view.height)
        ).toBeGreaterThan(0.97)

        const key = await rect(page.locator('[data-symbol-key-toggle]'))
        const toggle = page.getByRole('button', { name: 'Supply' })
        const box = await rect(toggle)
        expect(box.x).toBeGreaterThanOrEqual(key.x + key.width)
        expect(Math.abs(box.y + box.height - (key.y + key.height))).toBeLessThan(2)

        const card = page.getByRole('group', { name: 'General supply' })
        await toggle.click()
        await expect(card).toBeVisible()
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        for (const name of [
            'Writ deck',
            'Haversack',
            "King's seals",
            'Vessels',
            'Influence markers',
            'Start player'
        ]) {
            await expect(card.getByRole('group', { name })).toBeVisible()
        }
        await expect(card.locator('[data-general-count="haversack-iron"]')).toHaveText(/^[0-9]+$/)
        const open = await rect(card)
        expect(open.y).toBeGreaterThanOrEqual(view.y - 0.5)
        expect(open.x + open.width).toBeLessThanOrEqual(view.x + view.width + 0.5)

        await page.keyboard.press('Escape')
        await expect(card).toHaveCount(0)
        await toggle.click()
        await card.click()
        await expect(card).toHaveCount(0)
        await toggle.click()
        await page.mouse.click(view.x + view.width - 20, view.y + 20)
        await expect(card).toHaveCount(0)
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    test('Contract, Supply: the zoom row stands right under the guild standings’ strip, not at the column’s foot', async ({
        page
    }) => {
        await openFixture(page, 'seats-four-mid-game')
        await settled(page)
        const strip = await rect(page.locator('[data-guild-strip]'))
        const view = await rect(page.locator('[data-board-view]'))
        const zoom = await rect(page.getByRole('button', { name: 'Zoom in' }))
        const key = await rect(page.locator('[data-symbol-key-toggle]'))
        const stripFoot = strip.y + strip.height
        // The row stands in the band under the strip: below it, and no further down than the band,
        // 128 board units scaled with the map.
        const scale = (await rect(page.locator('[data-board-surface]'))).width / 1598
        expect(zoom.y).toBeGreaterThanOrEqual(stripFoot)
        expect(key.y + key.height - stripFoot).toBeLessThan(128 * scale + 2)
        // The board's view ends with the band, so the row is the last thing in it.
        expect(Math.abs(view.y + view.height - (key.y + key.height))).toBeLessThan(8)
        // The map takes the column's width less the two guild buttons and their gaps, or a few
        // pixels less where the column's height binds first.
        const surface = await rect(page.locator('[data-board-surface]'))
        expect(surface.width).toBeLessThanOrEqual(view.width - Gutters + 1)
        expect(surface.width).toBeGreaterThan(view.width - Gutters - 12)
    })

    test('Contract, Desk layout: the board view is the map alone, with no score track and no ring raster, a West and an East guilds button at its sides', async ({
        page
    }) => {
        await openFixture(page, 'seats-four-mid-game')
        await settled(page)
        const surface = page.locator('[data-board-surface]')
        expect(await surface.getAttribute('viewBox')).toBe('452 60 1598 833')
        const map = await rect(surface)
        const view = await rect(page.locator('[data-board-view]'))
        // The freed width goes to the map, less the buttons: about 998 x 520 at 1440 x 900.
        expect(Math.abs(map.width - 998)).toBeLessThan(2)
        expect(Math.abs(map.height - 520)).toBeLessThan(2)
        const west = await rect(sideButton(page, 'West'))
        const east = await rect(sideButton(page, 'East'))
        for (const button of [west, east]) {
            expect(Math.abs(button.width - 45)).toBeLessThan(1)
            expect(Math.abs(button.height - map.height)).toBeLessThan(1.5)
            expect(Math.abs(button.y - map.y)).toBeLessThan(1)
        }
        expect(Math.abs(west.x - view.x)).toBeLessThan(1)
        expect(Math.abs(map.x - (west.x + west.width) - 4)).toBeLessThan(1)
        expect(Math.abs(east.x - (map.x + map.width) - 4)).toBeLessThan(1)
        // The labels run up the West button and down the East one.
        const turns = await Promise.all(
            ['West', 'East'].map((side) =>
                page
                    .locator(`[data-guild-side="${side.toLowerCase()}"] [data-side-label]`)
                    .evaluate((label) => {
                        const style = getComputedStyle(label)
                        return `${style.writingMode} ${style.transform}`
                    })
            )
        )
        expect(turns[0]).toMatch(/^vertical-rl matrix\(-1, [^,]+, [^,]+, -1, 0, 0\)$/)
        expect(turns[1]).toBe('vertical-rl none')
        for (const side of ['West', 'East'] as const) {
            await expect(sideButton(page, side)).toHaveAttribute('aria-expanded', 'false')
        }
        // No score track and no ring print: the scores are the seat panels' and the zoom row's.
        await expect(page.locator('[data-score-space], [data-score-ring]')).toHaveCount(0)
        const ringImages = await page.evaluate(
            () =>
                [...document.querySelectorAll('image')].filter((image) =>
                    (image.getAttribute('href') ?? '').includes('board.ring')
                ).length
        )
        expect(ringImages).toBe(0)
        // One view: no guild area on the board and no focus buttons.
        await expect(page.locator('[data-board-surface] [data-guild]')).toHaveCount(0)
        await expect(page.locator('[data-guild-view]')).toHaveCount(0)
        await expect(page.getByRole('group', { name: 'Focus the board' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Whole board', exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveCount(0)
        // The standings' strip stands under the map, across its width.
        const strip = await rect(page.locator('[data-guild-strip]'))
        expect(Math.abs(strip.x - map.x)).toBeLessThan(2)
        expect(Math.abs(strip.width - map.width)).toBeLessThan(2)
        expect(strip.y).toBeGreaterThanOrEqual(map.y + map.height - 1)
        // Zoom and pan still work on the map, and the buttons stay at its rest.
        await page.getByRole('button', { name: 'Zoom in' }).click()
        await settled(page)
        expect((await rect(surface)).width).toBeGreaterThan(map.width)
        expect(await rect(sideButton(page, 'West'))).toEqual(west)
    })

    test('Contract, Desk layout: each guild button is wood with a gold edge, its label in the title font, and under it its side’s three faces, upright; the label stays its name', async ({
        page
    }) => {
        await openFixture(page, 'seats-four-mid-game')
        await settled(page)
        const Faces = {
            west: ['alchemist', 'merchant', 'farmer'],
            east: ['knight', 'noble', 'monk']
        } as const
        for (const [side, name] of [
            ['west', 'West guilds'],
            ['east', 'East guilds']
        ] as const) {
            const button = page.locator(`[data-guild-side="${side}"]`)
            await expect(button).toHaveAccessibleName(name)
            const look = await button.evaluate((element) => {
                const style = getComputedStyle(element)
                const label = getComputedStyle(element.querySelector('[data-side-label]')!)
                return {
                    wood: style.backgroundImage,
                    edge: style.borderTopWidth,
                    corner: style.borderTopLeftRadius,
                    font: label.fontFamily,
                    ink: label.color,
                    shadow: label.textShadow
                }
            })
            expect(look.wood).toMatch(/^linear-gradient\(90deg, /)
            expect(look.edge).toBe('2px')
            expect(look.corner).toBe('10px')
            expect(look.font).toMatch(/^MedievalSharp/)
            expect(look.ink).toBe('rgb(239, 227, 200)')
            expect(look.shadow).not.toBe('none')

            const box = await rect(button)
            const label = await rect(button.locator('[data-side-label]'))
            const faces = button.locator('[data-guild-face]')
            if (!printed) {
                // With no prints the button keeps its wood and label, centred, and draws no face.
                await expect(faces).toHaveCount(0)
                const above = label.y - box.y
                const below = box.y + box.height - (label.y + label.height)
                expect(Math.abs(above - below)).toBeLessThan(2)
                continue
            }
            await expect(button.locator('[data-guild-faces]')).toHaveAttribute(
                'aria-hidden',
                'true'
            )
            // Each face is its own small file, decoration with empty alt text.
            expect(
                await faces.evaluateAll((all) =>
                    all.map((face) => [
                        face.getAttribute('data-guild-face'),
                        face.getAttribute('alt'),
                        /face\.([a-z]+)\.webp/.exec(face.getAttribute('src') ?? '')?.[1]
                    ])
                )
            ).toEqual(Faces[side].map((guild) => [guild, '', guild]))
            const rings = await Promise.all(
                (await button.locator('[data-face-ring]').all()).map((ring) => rect(ring))
            )
            expect(rings).toHaveLength(3)
            // Each a 36 px face in its 2 px gold ring, centred across the button: 22 px under the
            // label, 10 px apart.
            let above = label.y + label.height
            for (const [index, ring] of rings.entries()) {
                expect(Math.abs(ring.width - 40)).toBeLessThan(1)
                expect(Math.abs(ring.height - 40)).toBeLessThan(1)
                expect(Math.abs(ring.x + ring.width / 2 - (box.x + box.width / 2))).toBeLessThan(1)
                expect(Math.abs(ring.y - above - (index === 0 ? 22 : 10))).toBeLessThan(1.5)
                above = ring.y + ring.height
            }
            // The label and the faces stand centred down the button as one group.
            const top = label.y - box.y
            const foot = box.y + box.height - above
            expect(Math.abs(top - foot)).toBeLessThan(2)
        }

        // At rest no guild print is drawn or fetched: the faces are their own small files.
        expect(
            await page.evaluate(() => ({
                drawn: [...document.querySelectorAll('image, img')].filter((image) =>
                    (image.getAttribute('href') ?? image.getAttribute('src') ?? '').includes(
                        'board.guild'
                    )
                ).length,
                fetched: performance
                    .getEntriesByType('resource')
                    .filter(({ name }) => name.includes('board.guild')).length
            }))
        ).toEqual({ drawn: 0, fetched: 0 })

        // Open, the button's edge is light gold and it glows; a keyboard focus ring shows.
        const west = sideButton(page, 'West')
        await west.click()
        await settled(page)
        const open = await west.evaluate((element) => getComputedStyle(element))
        expect(open.borderTopColor).toBe('rgb(252, 211, 77)')
        expect(open.boxShadow).toMatch(/rgb\(252, 211, 77\)/)
        await page.keyboard.press('Escape')
        await settled(page)
        const east = sideButton(page, 'East')
        await east.focus()
        const focus = await east.evaluate((element) => ({
            visible: element.matches(':focus-visible'),
            outline: getComputedStyle(element).outlineStyle,
            width: getComputedStyle(element).outlineWidth
        }))
        expect(focus).toEqual({ visible: true, outline: 'solid', width: '2px' })
    })

    test('Contract, Desk layout: a guild button opens its three areas upright over the map; again, Escape or the scrim closes it', async ({
        page
    }) => {
        await openFixture(page, 'seats-four-mid-game')
        await settled(page)
        const map = await rect(page.locator('[data-board-surface]'))
        const west = sideButton(page, 'West')
        const east = sideButton(page, 'East')

        await west.click()
        await settled(page)
        await expect(west).toHaveAttribute('aria-expanded', 'true')
        const westView = page.locator('[data-guild-view="west"]')
        await expect(westView).toBeVisible()
        const view = await rect(westView)
        expect(Math.abs(view.x - map.x)).toBeLessThan(1)
        expect(Math.abs(view.width - map.width)).toBeLessThan(1)
        expect(Math.abs(view.height - map.height)).toBeLessThan(1)
        expect(await openGuilds(page, 'west')).toEqual(['alchemist', 'merchant', 'farmer'])
        let last: { x: number; y: number; width: number; height: number } | undefined
        for (const guild of ['alchemist', 'merchant', 'farmer']) {
            const area = westView.locator(`[data-open-guild="${guild}"]`)
            const box = await rect(area)
            // As large as the map's box allows: about 314 x 444 at 1440 x 900, 2.5 times the board's.
            expect(Math.abs(box.width - 314)).toBeLessThan(2)
            expect(Math.abs(box.height - 444)).toBeLessThan(2)
            expect(box.x).toBeGreaterThanOrEqual(map.x)
            expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width)
            expect(box.y).toBeGreaterThanOrEqual(map.y)
            expect(box.y + box.height).toBeLessThanOrEqual(map.y + map.height)
            if (last) {
                expect(box.x).toBeGreaterThan(last.x + last.width)
                expect(Math.abs(box.y - last.y)).toBeLessThan(1)
            }
            last = box
            // Upright: a west area turned a quarter clockwise, and live with its state.
            await expect(area.locator('[data-upright-turned]')).toHaveAttribute(
                'style',
                /rotate\(90deg\)/
            )
            await expect(area.locator(`[data-guild="${guild}"]`)).toBeVisible()
        }

        await east.click()
        await settled(page)
        await expect(west).toHaveAttribute('aria-expanded', 'false')
        await expect(east).toHaveAttribute('aria-expanded', 'true')
        await expect(westView).toHaveCount(0)
        expect(await openGuilds(page, 'east')).toEqual(['knight', 'noble', 'monk'])
        await expect(
            page.locator('[data-guild-view="east"] [data-upright-turned]').first()
        ).toHaveAttribute('style', /rotate\(-90deg\)/)

        await page.keyboard.press('Escape')
        await expect(page.locator('[data-guild-view]')).toHaveCount(0)
        await expect(east).toHaveAttribute('aria-expanded', 'false')

        await west.click()
        await west.click()
        await expect(page.locator('[data-guild-view]')).toHaveCount(0)

        await west.click()
        await page.locator('[data-guild-scrim]').click({ position: { x: 4, y: 4 } })
        await expect(page.locator('[data-guild-view]')).toHaveCount(0)

        // Keyboard reachable.
        await west.focus()
        await page.keyboard.press('Enter')
        await expect(westView).toBeVisible()

        // A press on a guild's print enlarges it, over the view; Escape closes the card first.
        await westView
            .locator('[data-enlarge="Merchant guild"]')
            .click({ position: { x: 12, y: 12 } })
        await expect(page.locator('[data-enlarged]')).toHaveAttribute('data-enlarged', 'guild')
        await page.keyboard.press('Escape')
        await expect(page.locator('[data-enlarged]')).toHaveCount(0)
        await expect(westView).toBeVisible()
    })

    test('Contract, Pick framing: a pick wholly in the West guilds opens them, lit; closing leaves the dot', async ({
        page
    }) => {
        await openFixture(page, 'guild-pick-west')
        await settled(page)
        await expect(page.locator('[data-guild-view]')).toHaveCount(0)
        await panel(page)
            .getByRole('button', { name: /^Guild/ })
            .first()
            .click()
        await settled(page)
        const westView = page.locator('[data-guild-view="west"]')
        await expect(westView).toBeVisible()
        await expect(sideButton(page, 'West')).toHaveAttribute('aria-expanded', 'true')
        // The Farmer offers this seat no function: the Alchemist and the Merchant light.
        const lit = westView.locator('[data-pick-role="lit"]')
        await expect(lit).toHaveCount(2)
        await expect(sideButton(page, 'West').locator('[data-lit-dot]')).toHaveCount(1)
        await expect(sideButton(page, 'East').locator('[data-lit-dot]')).toHaveCount(0)

        await page.keyboard.press('Escape')
        await expect(westView).toHaveCount(0)
        await expect(sideButton(page, 'West').locator('[data-lit-dot]')).toHaveCount(1)

        // Opened again, a lit area is pressed there and its popup stands beside it.
        await sideButton(page, 'West').click()
        await settled(page)
        await westView.locator('[data-pick="guild:merchant"] [role="button"]').click()
        await settled(page)
        const popup = page.locator('[data-board-popup="guild:merchant"]')
        await expect(popup).toBeVisible()
        const merchant = await rect(westView.locator('[data-open-guild="merchant"]'))
        expect((await rect(popup)).x).toBeGreaterThanOrEqual(merchant.x + merchant.width - 2)
    })

    test('Contract, Desk layout: a good leaving an open side flies from its place in the upright area', async ({
        page
    }) => {
        await openFixture(page, 'guild-merchant-trade-watched')
        await settled(page)
        await sideButton(page, 'West').click()
        await settled(page)
        const area = await rect(page.locator('[data-open-guild="merchant"]'))
        const seen = await motionWhile(page, () =>
            sentByTrader(page, 'merchant', { goods: ['iron', 'iron'] })
        )
        const goods = seen.flights.filter(({ row }) => row === 'goods')
        expect(goods).toHaveLength(2)
        for (const { first } of goods) {
            expect(holds(area, first), JSON.stringify({ area, first })).toBe(true)
        }
        // Each leaves from its own good, which hides while it flies.
        expect(seen.hiddenInView).toBeGreaterThanOrEqual(2)
    })

    test('Contract, Desk layout: with the side closed, a good leaving it flies from its button', async ({
        page
    }) => {
        await openFixture(page, 'guild-merchant-trade-watched')
        await settled(page)
        const button = await rect(sideButton(page, 'West'))
        const seen = await motionWhile(page, () =>
            sentByTrader(page, 'merchant', { goods: ['iron', 'iron'] })
        )
        const goods = seen.flights.filter(({ row }) => row === 'goods')
        expect(goods).toHaveLength(2)
        for (const { first } of goods) {
            // At the button's outer edge, where the board view ends.
            expect(Math.abs(first.x - button.x), JSON.stringify({ button, first })).toBeLessThan(6)
        }
    })

    test('Contract, Desk layout: in an open East side a tame moves the row’s marker onto its icon there, and the others fly home from their places', async ({
        page
    }) => {
        await openFixture(page, 'guild-knight-trade-watched')
        await settled(page)
        await sideButton(page, 'East').click()
        await settled(page)
        const area = await rect(page.locator('[data-open-guild="knight"]'))
        const deploy = await page.evaluate(() => {
            const { host } = window.feudumFixture
            const [trader] = host.order
            return host.state.players
                .find(({ playerId }) => playerId === trader)
                ?.pawns.find(({ spaceId }) => spaceId)?.spaceId
        })
        const seen = await motionWhile(page, () =>
            sentByTrader(page, 'knight', { monster: 'behemoth', deploySpaceId: deploy })
        )
        // The board's own motion: the top marker onto the behemoth's icon, inside the open area.
        expect(seen.movingInView.length).toBeGreaterThan(0)
        for (const at of seen.movingInView) {
            expect(holds(area, at), JSON.stringify({ area, at })).toBe(true)
        }
        // The flight layer's: the rest leave from their places in the upright area, hidden as they go.
        const markers = seen.flights.filter(({ row }) => row === 'markers')
        expect(markers.length).toBeGreaterThan(0)
        for (const { first } of markers) {
            expect(holds(area, first), JSON.stringify({ area, first })).toBe(true)
        }
        expect(seen.hiddenInView).toBeGreaterThan(0)
    })

    test('Contract, Pick framing: a pick in both sides opens nothing and dots each side', async ({
        page
    }) => {
        await openFixture(page, 'guild-pick')
        await settled(page)
        await panel(page)
            .getByRole('button', { name: /^Guild/ })
            .first()
            .click()
        await settled(page)
        await expect(page.locator('[data-guild-view]')).toHaveCount(0)
        for (const side of ['West', 'East'] as const) {
            const dot = sideButton(page, side).locator('[data-lit-dot]')
            await expect(dot).toHaveCount(1)
            // The dot stands clear of the label and of every face.
            const at = await rect(dot)
            for (const part of await sideButton(page, side)
                .locator('[data-side-label], [data-face-ring]')
                .all()) {
                const box = await rect(part)
                const apart =
                    at.y + at.height <= box.y ||
                    box.y + box.height <= at.y ||
                    at.x + at.width <= box.x ||
                    box.x + box.width <= at.x
                expect(apart).toBe(true)
            }
        }
        await sideButton(page, 'East').click()
        await settled(page)
        await expect(page.locator('[data-guild-view="east"] [data-pick-role="lit"]')).toHaveCount(3)
    })

    test('Contract, Supply and Seat panel: the scores in the zoom row and the seat panels, the leader marked, a score flying to its panel', async ({
        page
    }) => {
        await openFixture(page, 'cards-defend')
        await settled(page)
        const line = page.getByRole('list', { name: 'Scores' })
        const seats = await page
            .locator('[data-seat-panel]')
            .evaluateAll((all) => all.map((one) => one.getAttribute('data-seat-panel')))
        const entries = line.getByRole('listitem')
        await expect(entries).toHaveCount(seats.length)
        expect(
            await entries.evaluateAll((all) => all.map((one) => one.getAttribute('data-score-of')))
        ).toEqual(seats)
        // In the zoom row, after Supply, inside the view.
        const lineBox = await rect(line)
        const supply = await rect(page.locator('[data-supply-toggle]'))
        const view = await rect(page.locator('[data-board-view]'))
        expect(lineBox.x).toBeGreaterThan(supply.x + supply.width)
        expect(lineBox.x + lineBox.width).toBeLessThanOrEqual(view.x + view.width)
        expect(
            Math.abs(lineBox.y + lineBox.height / 2 - (supply.y + supply.height / 2))
        ).toBeLessThan(4)
        await expect(page.locator('[data-score-leader]')).toHaveCount(0)

        const seat = seats[0] ?? ''
        await panel(page).locator('[data-cards] [data-row="Defend"] button').first().click()
        const score = page.locator(`[data-seat-panel="${seat}"] [data-seat-score]`)
        await page.evaluate(() => {
            const seen: Point[] = []
            Object.assign(window, { scoreFlight: seen })
            const sample = () => {
                const copy = document.querySelector('[data-flight-row="score"] [data-flight-side]')
                if (copy) {
                    const { x, y, width, height } = copy.getBoundingClientRect()
                    seen.push({ x: x + width / 2, y: y + height / 2 })
                }
                requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        })
        await panel(page).locator('[data-primary]').click()
        await settled(page)
        await expect(score).toHaveAttribute('data-seat-score', '1')
        const path = await page.evaluate(() => Reflect.get(window, 'scoreFlight') as Point[])
        expect(path.length).toBeGreaterThan(2)
        const landing = path[path.length - 1]
        const target = await rect(score)
        expect(Math.abs((landing?.x ?? 0) - (target.x + target.width / 2))).toBeLessThan(24)
        expect(Math.abs((landing?.y ?? 0) - (target.y + target.height / 2))).toBeLessThan(24)

        const mine = line.locator(`[data-score-of="${seat}"]`)
        await expect(mine).toHaveAttribute('data-score', '1')
        await expect(mine).toHaveAttribute('data-leading', '')
        await expect(page.locator('[data-score-leader]')).toHaveCount(2)
        await expect(page.locator(`[data-seat-panel="${seat}"] [data-score-leader]`)).toHaveCount(1)
        // The lead is a small star, so the start player leading shows one crown, by its name.
        for (const mark of await page.locator('[data-score-leader] path').all()) {
            await expect(mark).toHaveAttribute('d', StarPath)
        }
        await expect(
            page.locator(`[data-seat-panel="${seat}"] [data-start-player-crown]`)
        ).toHaveCount(1)
        const name = await page.locator(`[data-seat-panel="${seat}"] .name`).textContent()
        await expect(mine).toHaveAccessibleName(`${name}: 1 vp, leading`)
        await expect(
            page.locator(`[data-seat-panel="${seat}"] [data-open-seat-of]`)
        ).toHaveAccessibleName(`Open ${name}'s seat · 1 vp, leading`)
    })

    test('R-1.4.8 the starting-goods choice shows all five goods in the panel, in sight', async ({
        page
    }) => {
        await openFixture(page, 'setup-goods')
        const rows = panel(page).locator('[data-rows="goods"] [data-row]')
        await expect(rows).toHaveCount(5)
        const view = page.viewportSize()!
        const area = await rect(panel(page))
        for (const row of await rows.all()) {
            await expect(row).toBeVisible()
            const box = await rect(row)
            expect(box.x).toBeGreaterThanOrEqual(Math.max(0, area.x) - 0.5)
            expect(box.x + box.width).toBeLessThanOrEqual(
                Math.min(view.width, area.x + area.width) + 0.5
            )
            expect(box.y).toBeGreaterThanOrEqual(Math.max(0, area.y) - 0.5)
            expect(box.y + box.height).toBeLessThanOrEqual(view.height)
        }
    })

    test('R-6.2 a sealed charter’s score reads as vp beneath its face', async ({ page }) => {
        await openFixture(page, 'game-end')
        const charter = panel(page).locator('[data-game-end-charter]')
        await expect(charter).toHaveCount(1)
        const score = charter.locator('[data-charter-score]')
        await expect(score).toHaveText('5 vp')
        const face = await rect(charter.locator('svg').first())
        expect((await rect(score)).y).toBeGreaterThanOrEqual(face.y + face.height - 1)
    })

    test('S68 R-4.6.5 each Knight row press reaches 44 px across, over its printed row', async ({
        page
    }) => {
        await openFunction(page, 'knightPush', 'knight', /^\s*Push/)
        const presses = page.locator('[data-bench-place^="row:"] button.face')
        expect(await presses.count()).toBeGreaterThan(1)
        for (const press of await presses.all()) {
            const { across, down } = await reach(press)
            expect(across).toBeGreaterThanOrEqual(Target)
            expect(down).toBeGreaterThanOrEqual(Target)
            const box = await rect(press)
            const row = await rect(press.locator('.ring'))
            expect(box.x).toBeLessThanOrEqual(row.x + 0.5)
            expect(box.x + box.width).toBeGreaterThanOrEqual(row.x + row.width - 0.5)
        }
    })
})

/** The game column holding the board view: how far its content runs past its height, and its foot. */
async function columnOf(page: Page) {
    return page.locator('[data-board-view]').evaluate((view) => {
        let column = view.parentElement
        while (column && getComputedStyle(column).display === 'contents') {
            column = column.parentElement
        }
        if (!column) {
            throw new Error('the board view has no column')
        }
        return {
            over: column.scrollHeight - column.clientHeight,
            foot: column.getBoundingClientRect().bottom
        }
    })
}

for (const { handLayout, ...viewport } of [
    { width: 1280, height: 800, handLayout: 'strip' },
    { width: 1440, height: 900, handLayout: 'strip' },
    { width: 1850, height: 880, handLayout: 'column' },
    { width: 1920, height: 1080, handLayout: 'column' }
] as const) {
    test.describe(`a ${viewport.width} x ${viewport.height} desk`, () => {
        test.use({ viewport })

        test('R-3.1 while a hand is chosen the board scales down, so the standings and the zoom row stay in the column', async ({
            page
        }) => {
            await openFixture(page, 'hands-five-seats')
            await expect(page.locator('[data-hand-tray]')).toBeVisible()
            await settled(page)
            const column = await columnOf(page)
            expect(column.over).toBeLessThanOrEqual(1)
            const zoom = await rect(page.getByRole('button', { name: 'Zoom in' }))
            const key = await rect(page.locator('[data-symbol-key-toggle]'))
            // The shrink applies in either layout: the strip under the map, or, where the height
            // left binds the map, the side column, its six standings over the zoom row.
            const side = page.locator('[data-desk-column]')
            await expect(page.locator('[data-board-view]')).toHaveAttribute(
                'data-desk-layout',
                handLayout
            )
            if (handLayout === 'column') {
                const box = await rect(side)
                expect(box.y + box.height).toBeLessThanOrEqual(zoom.y)
                const rails = await columnRails(page)
                expect(rails).toHaveLength(6)
                expect(rails.at(-1)!.box.bottom).toBeLessThanOrEqual(box.y + box.height + 0.5)
                expect((await overflowOf(page)).side).toBe(0)
            } else {
                const strip = await rect(page.locator('[data-guild-strip]'))
                expect(strip.y + strip.height).toBeLessThanOrEqual(zoom.y)
            }
            expect(key.y + key.height).toBeLessThanOrEqual(column.foot + 0.5)
            // R-1.2 Whole: smaller, the map keeps its shape, the guild buttons at its sides.
            const surface = await rect(page.locator('[data-board-surface]'))
            expect(surface.width / surface.height).toBeCloseTo(1598 / 833, 1)
            const east = await rect(page.locator('[data-guild-side="east"]'))
            expect(Math.abs(east.height - surface.height)).toBeLessThan(1.5)
            expect(Math.abs(east.x - (surface.x + surface.width) - 4)).toBeLessThan(1)
        })

        test('R-3.2 in card play the map is back at the column’s full width between the guild buttons, or its full height, and the column holds it all', async ({
            page
        }) => {
            await openFixture(page, 'seats-four-mid-game')
            await settled(page)
            const surface = await rect(page.locator('[data-board-surface]'))
            const view = await rect(page.locator('[data-board-view]'))
            const column = await columnOf(page)
            // The width binds, or the column's height does and the view reaches its foot.
            const across = Math.abs(surface.width - (view.width - Gutters)) < 2
            const down = Math.abs(view.y + view.height - column.foot) < 2
            expect(across || down).toBe(true)
            expect(column.over).toBeLessThanOrEqual(1)
            const key = await rect(page.locator('[data-symbol-key-toggle]'))
            expect(key.y + key.height).toBeLessThanOrEqual(column.foot + 0.5)
        })

        test('R-3.2 card play’s hand row is about 120 px tall, each card still a 44 px press with its magnifier', async ({
            page
        }) => {
            await openFixture(page, 'cards-migrate')
            await settled(page)
            const area = await rect(page.locator('[data-action-cap]'))
            expect(area.height).toBeLessThanOrEqual(124)
            const cards = page.locator('[data-cards="hand"] [data-row]')
            await expect(cards).toHaveCount(4)
            for (const card of await cards.all()) {
                const face = await rect(card.locator('button').first())
                expect(face.width).toBeGreaterThanOrEqual(Target)
                expect(face.height).toBeGreaterThanOrEqual(Target)
                await expect(card.locator('[data-enlarge]')).toHaveCount(1)
            }
        })

        test('R-3.1 the hand-choosing tray keeps its size', async ({ page }) => {
            await openFixture(page, 'hands-first-sulfur')
            await expect(page.locator('[data-hand-tray]')).toBeVisible()
            await settled(page)
            const tray = await rect(page.locator('[data-hand-tray]'))
            expect(Math.abs(tray.height - 206)).toBeLessThanOrEqual(2)
            expect(Math.abs(tray.width - 368)).toBeLessThanOrEqual(2)
        })
    })
}

/** Whether anything runs past the page, the game column or the side column, which would scroll. */
async function overflowOf(page: Page) {
    const column = await columnOf(page)
    const rest = await page.evaluate(() => {
        const root = document.documentElement
        const side = document.querySelector('[data-desk-column]')
        return {
            down: root.scrollHeight - window.innerHeight,
            across: root.scrollWidth - window.innerWidth,
            side: side ? side.scrollHeight - side.clientHeight : 0
        }
    })
    return { ...rest, column: column.over }
}

/** Which layout the desk shows, read over several frames so a flicker between the two shows. */
async function layoutsOver(page: Page, frames: number) {
    return page.evaluate(async (count) => {
        const seen = new Set<string>()
        for (let frame = 0; frame < count; frame += 1) {
            await new Promise((done) => requestAnimationFrame(done))
            seen.add(
                document.querySelector('[data-desk-column]')
                    ? 'column'
                    : document.querySelector('[data-guild-strip]')
                      ? 'strip'
                      : 'none'
            )
        }
        return [...seen]
    }, frames)
}

/** The standings in the side column, in the page's order, with their boxes. */
async function columnRails(page: Page) {
    return page.locator('[data-desk-column] [data-guild-rail]').evaluateAll((rails) =>
        rails.map((rail) => ({
            guild: rail.getAttribute('data-guild-rail'),
            box: rail.getBoundingClientRect().toJSON() as DOMRect
        }))
    )
}

test.describe('a 1850 x 880 desk, where the map’s height binds', () => {
    test.use({ viewport: { width: 1850, height: 880 } })

    test('Contract, Desk layout: the standings and the zoom row stand in a column right of the East button, and the map grows to the width left', async ({
        page
    }) => {
        await openFixture(page, 'guild-pick')
        await settled(page)
        await expect(page.locator('[data-guild-strip]')).toHaveCount(0)
        const side = page.locator('[data-desk-column]')
        await expect(side).toBeVisible()
        const map = await rect(page.locator('[data-board-surface]'))
        const view = await rect(page.locator('[data-board-view]'))
        const panelBox = await rect(page.locator('[data-turn-controls]'))
        const east = await rect(sideButton(page, 'East'))
        const box = await rect(side)
        // About 1144 x 596: the room's width less the two buttons, the gap and the column; it would
        // be 1007 x 525 with the strip under it.
        expect(Math.abs(map.width - 1144)).toBeLessThan(2)
        expect(Math.abs(map.height - 596)).toBeLessThan(2)
        expect(Math.abs(map.y - view.y)).toBeLessThan(1)
        expect(Math.abs(east.height - map.height)).toBeLessThan(1.5)
        // The board view stays left-aligned with the panel, and ends with the column.
        expect(Math.abs(view.x - panelBox.x)).toBeLessThan(1)
        expect(Math.abs(box.x - (east.x + east.width) - 8)).toBeLessThan(1.5)
        expect(Math.abs(box.width - 256)).toBeLessThan(1)
        expect(Math.abs(view.x + view.width - (box.x + box.width))).toBeLessThan(1)
        // Top to bottom: the six standings one a row, West then East, as the strip orders them.
        const rails = await columnRails(page)
        expect(rails.map(({ guild }) => guild)).toEqual([
            'alchemist',
            'merchant',
            'farmer',
            'knight',
            'noble',
            'monk'
        ])
        for (const [index, { box: rail }] of rails.entries()) {
            expect(rail.x).toBeGreaterThanOrEqual(box.x - 0.5)
            expect(rail.right).toBeLessThanOrEqual(box.x + box.width + 0.5)
            if (index > 0) {
                expect(rail.y).toBeGreaterThanOrEqual(rails[index - 1]!.box.bottom - 0.5)
            }
        }
        // Then the score line, then Key, Supply and the zoom buttons along the column's foot.
        const score = await rect(page.locator('[data-score-line]'))
        const key = await rect(page.locator('[data-symbol-key-toggle]'))
        const supply = await rect(page.locator('[data-supply-toggle]'))
        const zoom = await rect(page.getByRole('button', { name: 'Zoom in' }))
        expect(score.y).toBeGreaterThanOrEqual(rails.at(-1)!.box.bottom - 0.5)
        expect(key.y).toBeGreaterThanOrEqual(score.y + score.height - 0.5)
        for (const part of [score, key, supply, zoom]) {
            expect(part.x).toBeGreaterThanOrEqual(box.x - 0.5)
            expect(part.x + part.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
        }
        expect(supply.x).toBeGreaterThan(key.x)
        expect(zoom.x).toBeGreaterThan(supply.x + supply.width)
        expect(Math.abs(key.y + key.height - (view.y + view.height))).toBeLessThan(1)
        // Nothing runs past the page, the game column or the side column.
        expect(await overflowOf(page)).toEqual({ down: 0, across: 0, side: 0, column: 0 })
    })

    test('Contract, Desk layout: with five seats the standings stand two a row in the column, West left and East right, and nothing scrolls', async ({
        page
    }) => {
        await openFixture(page, 'standings-five-seats')
        await settled(page)
        const box = await rect(page.locator('[data-desk-column]'))
        const map = await rect(page.locator('[data-board-surface]'))
        // About 1056 x 550: a column of two 170 px standings a row is wider.
        expect(Math.abs(map.width - 1056)).toBeLessThan(2)
        expect(Math.abs(box.width - 344)).toBeLessThan(1)
        const rails = await columnRails(page)
        const at = (guild: string) => rails.find((rail) => rail.guild === guild)!.box
        for (const [west, east] of [
            ['alchemist', 'knight'],
            ['merchant', 'noble'],
            ['farmer', 'monk']
        ] as const) {
            expect(Math.abs(at(west).y - at(east).y)).toBeLessThan(0.5)
            expect(at(east).x).toBeGreaterThan(at(west).right - 0.5)
        }
        expect(at('merchant').y).toBeGreaterThanOrEqual(at('alchemist').bottom - 0.5)
        expect(at('farmer').y).toBeGreaterThanOrEqual(at('merchant').bottom - 0.5)
        // At their own size, each holding its five seats' lines.
        expect(Math.abs(at('alchemist').width - 170)).toBeLessThan(1)
        const score = await rect(page.locator('[data-score-line]'))
        expect(score.y).toBeGreaterThanOrEqual(at('farmer').bottom - 0.5)
        expect(await page.locator('[data-desk-column] [data-score-of]').count()).toBe(5)
        expect(await overflowOf(page)).toEqual({ down: 0, across: 0, side: 0, column: 0 })
    })

    test('Contract, Desk layout: one layout per size, kept frame after frame, and back to the strip where the column would not enlarge the map', async ({
        page
    }) => {
        await openFixture(page, 'guild-pick')
        await settled(page)
        expect(await layoutsOver(page, 20)).toEqual(['column'])
        await page.setViewportSize({ width: 1920, height: 1080 })
        await settled(page)
        expect(await layoutsOver(page, 20)).toEqual(['strip'])
        await page.setViewportSize({ width: 1850, height: 880 })
        await settled(page)
        expect(await layoutsOver(page, 20)).toEqual(['column'])
    })

    test('Contract, Desk layout: in the column a guild side still opens over the map’s box, and Key opens its card inside the view', async ({
        page
    }) => {
        await openFixture(page, 'guild-pick')
        await settled(page)
        const map = await rect(page.locator('[data-board-surface]'))
        await sideButton(page, 'West').click()
        await settled(page)
        const open = await rect(page.locator('[data-guild-view="west"]'))
        expect(Math.abs(open.x - map.x)).toBeLessThan(1)
        expect(Math.abs(open.width - map.width)).toBeLessThan(1)
        await expect(page.locator('[data-desk-column]')).toBeVisible()
        await page.keyboard.press('Escape')
        await settled(page)
        await page.locator('[data-symbol-key-toggle]').click()
        const card = await rect(page.locator('#feudum-symbol-key'))
        const view = await rect(page.locator('[data-board-view]'))
        expect(card.x).toBeGreaterThanOrEqual(view.x - 0.5)
        expect(card.x + card.width).toBeLessThanOrEqual(view.x + view.width + 0.5)
        expect(card.y).toBeGreaterThanOrEqual(view.y - 0.5)
        expect(card.y + card.height).toBeLessThanOrEqual(
            (await rect(page.locator('[data-symbol-key-toggle]'))).y + 0.5
        )
    })
})

test.describe('a 1440 x 900 desk, where the map’s width binds', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('Contract, Desk layout: no column; the strip stands under the map, the zoom row at the view’s lower left, as before, and nothing scrolls', async ({
        page
    }) => {
        await openFixture(page, 'seats-four-mid-game')
        await settled(page)
        await expect(page.locator('[data-desk-column]')).toHaveCount(0)
        await expect(page.locator('[data-guild-strip]')).toBeVisible()
        const map = await rect(page.locator('[data-board-surface]'))
        const view = await rect(page.locator('[data-board-view]'))
        expect(Math.abs(map.width - 998)).toBeLessThan(2)
        expect(Math.abs(map.height - 520)).toBeLessThan(2)
        expect(Math.abs(view.width - 1096)).toBeLessThan(1)
        const zoom = await rect(page.getByRole('button', { name: 'Zoom in' }))
        expect(zoom.x).toBeLessThan(view.x + 60)
        expect(await layoutsOver(page, 20)).toEqual(['strip'])
        expect(await overflowOf(page)).toEqual({ down: 0, across: 0, side: 0, column: 0 })
    })
})
