import { existsSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { GuildById, GuildIds, MarketSpaces } from '@tabletop/feudum'
import { createGame, playToHands, pressGuildArea, settled } from './helpers.js'

/**
 * The printed board under the pieces and the presses, where the folder holds it: each panel's print
 * fills its area exactly, at board and bench scale, and the presses and rings beside the pieces they
 * move stand on the same printed spaces, on the bench and on the trade picker's upright board. With no files, the drawn board is proved by the other specs, and
 * these skip.
 */

type Box = { x: number; y: number; width: number; height: number }

const panelImage = (scope: Locator, guild: string) =>
    scope.locator(
        `svg[aria-label="${GuildById[guild as keyof typeof GuildById].name} guild panel"]`
    )

async function boxOf(locator: Locator): Promise<Box> {
    const box = await locator.boundingBox()
    expect(box).not.toBeNull()
    return box as Box
}

function expectSameBox(a: Box, b: Box, slack = 1) {
    expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(slack)
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(slack)
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(slack)
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(slack)
}

function centre({ x, y, width, height }: Box) {
    return { x: x + width / 2, y: y + height / 2 }
}

function inside(point: { x: number; y: number }, { x, y, width, height }: Box) {
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height
}

async function openTable(page: Page, scene: string) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import { openBenchTable } from '/src/lib/testing/benchTablePage.ts'
            await openBenchTable('${scene}')
            document.body.dataset.benchTable = ''`
    })
    await page.waitForSelector('body[data-bench-table]', { timeout: 45_000 })
    await settled(page)
}

async function openFunction(page: Page, scene: string, guild: string, fn: RegExp) {
    await openTable(page, scene)
    await page
        .locator('[data-action-panel]')
        .getByRole('button', { name: /^Guild/ })
        .first()
        .click()
    await settled(page)
    if ((await page.locator('[data-board-popup]').count()) === 0) {
        await pressGuildArea(page, guild)
    }
    await page.locator('[data-board-popup] button').filter({ hasText: fn }).first().click()
    await settled(page)
}

/**
 * Whether the folder holds the printed panels, so their image draws in place of the plate. Read from
 * the folder: a desk draws no guild area at rest, so the page can't say.
 */
function printed(): boolean {
    return existsSync(new URL('../src/lib/art/supplied/board.guild.merchant.webp', import.meta.url))
}

test('R-3.1 each printed card fills its face, its art inside the drawn print, and at standard size carries no name plate over it', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await createGame(page)
    await playToHands(page)
    await settled(page)
    const rows = page.locator('[data-action-panel] [data-cards] [data-row]')
    await expect(rows).toHaveCount(11)
    const prints = rows.locator('svg[role="img"] > g[data-print]')
    test.skip(
        (await prints.count()) === 0,
        'no card art in the folder, or a seat colour the print lacks'
    )
    for (let index = 0; index < 11; index++) {
        const row = rows.nth(index)
        const face = row.locator('svg[role="img"]').first()
        const faceBox = await boxOf(face)
        // The print's proportion, as tall as the face and centred across it.
        const band = await boxOf(face.locator('[data-print-band]'))
        expect(Math.abs(band.height - faceBox.height)).toBeLessThanOrEqual(1)
        expect(Math.abs(band.width - (faceBox.height * 580) / 938)).toBeLessThanOrEqual(1)
        expect(Math.abs(centre(band).x - centre(faceBox).x)).toBeLessThanOrEqual(1)
        // The art stands inside the band, never past it.
        const art = await boxOf(face.locator('g[data-print] > image'))
        expect(art.x).toBeGreaterThanOrEqual(band.x - 1)
        expect(art.x + art.width).toBeLessThanOrEqual(band.x + band.width + 1)
        expect(faceBox.width, `card ${index + 1}`).toBeGreaterThanOrEqual(60)
        await expect(face.locator('> rect'), `card ${index + 1}`).toHaveCount(0)
        const name = (await row.getAttribute('data-row')) ?? ''
        await expect(face).toHaveAccessibleName(new RegExp(`'s ${name.split(':')[0]} card$`))
    }
})

test('S71 markers and discs are drawn shapes; a reeve’s print stands centred on its disc', async ({
    page
}) => {
    await openTable(page, 'merchantPush')
    const holders = ['[data-board-surface]', '[data-guild-view]']
    const within = (inner: string) => page.locator(holders.map((h) => `${h} ${inner}`).join(', '))
    const reeves = within('svg[role="img"] > image[href*="piece.reeve"]')
    const seen = { marker: 0, disc: 0, reeve: 0 }
    const check = async () => {
        await expect(within('image[href*="piece.marker"], image[href*="piece.disc"]')).toHaveCount(
            0
        )
        seen.marker += await within('svg[aria-label$="influence marker"] > polygon').count()
        seen.disc += await within('svg[aria-label$="player disc"] > circle').count()
        for (let index = 0; index < (await reeves.count()); index++) {
            const image = reeves.nth(index)
            const token = image.locator('xpath=..')
            const at = centre(await boxOf(image))
            const middle = centre(await boxOf(token))
            expect(Math.abs(at.x - middle.x)).toBeLessThanOrEqual(1)
            expect(Math.abs(at.y - middle.y)).toBeLessThanOrEqual(1)
            await expect(token).toHaveAttribute('aria-label', /^.+'s reeve$/)
            seen.reeve++
        }
    }
    // On a desk the guild tracks' markers stand behind the side buttons: each side in turn.
    const sides = page.locator('[data-guild-side]')
    if ((await sides.count()) === 0) {
        await check()
    }
    for (const side of await sides.all()) {
        await side.click()
        await settled(page)
        await check()
    }
    expect(seen.marker).toBeGreaterThan(0)
    expect(seen.disc).toBeGreaterThan(0)
    // Without the supplied art a reeve is drawn, with no print.
    const supplied = await page.locator('[data-board-surface] image[href*="board.map"]').count()
    expect(seen.reeve > 0).toBe(supplied > 0)
})

test('R-1.3 each printed panel fills its guild area; a desk draws no ring print', async ({
    page
}) => {
    await openTable(page, 'guildPick')
    test.skip(!printed(), 'no printed board in the folder')
    const surface = page.locator('[data-board-surface]')
    // A desk's guild areas stand behind its side buttons: each side in turn.
    for (const guild of GuildIds) {
        const side = ['alchemist', 'merchant', 'farmer'].includes(guild) ? 'west' : 'east'
        if ((await page.locator(`[data-guild-view="${side}"]`).count()) === 0) {
            await page.locator(`[data-guild-side="${side}"]`).click()
            await settled(page)
        }
        const frame = panelImage(page.locator('[data-guild-view]'), guild)
        await expect(frame.locator('> image')).toBeVisible()
        expectSameBox(await boxOf(frame.locator('> image')), await boxOf(frame))
    }
    const ring = surface.locator('svg[aria-label="The board\'s edge"]')
    await expect(ring.locator('image')).toHaveCount(0)
})

test('R-1.3 on a phone the printed ring fills the whole board', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await openTable(page, 'guildPick')
    test.skip(!printed(), 'no printed board in the folder')
    const ring = page.locator('[data-board-surface] svg[aria-label="The board\'s edge"]')
    const pieces = await ring.locator('[data-ring-piece]').evaluateAll((all) =>
        all.map((piece) => {
            const { left, top, right, bottom } = piece.getBoundingClientRect()
            return { left, top, right, bottom }
        })
    )
    expect(pieces.length).toBeGreaterThan(0)
    const x = Math.min(...pieces.map((piece) => piece.left))
    const y = Math.min(...pieces.map((piece) => piece.top))
    const union = {
        x,
        y,
        width: Math.max(...pieces.map((piece) => piece.right)) - x,
        height: Math.max(...pieces.map((piece) => piece.bottom)) - y
    }
    expectSameBox(union, await boxOf(ring))
})

test('R-4.6.2 on the printed market in the trade picker, each good stands in the bin its ring marks', async ({
    page
}) => {
    await openFunction(page, 'merchantTrade', 'merchant', /^\s*Trade/)
    test.skip(!printed(), 'no printed board in the folder')
    const area = page.locator('[data-upright-guild="merchant"]')
    const panel = await boxOf(panelImage(area, 'merchant').locator('> image'))
    let seen = 0
    for (const { id, good } of MarketSpaces) {
        const piece = area.locator(`[data-world="good:${id}"]`)
        if ((await piece.count()) === 0) {
            continue
        }
        const ring = await boxOf(area.locator(`[data-bench-place="good:${good}"]`))
        expect(inside(centre(ring), panel)).toBe(true)
        expect(inside(centre(await boxOf(piece.first())), ring), id).toBe(true)
        seen++
    }
    expect(seen).toBeGreaterThan(0)
})

test('R-4.6.3 on the printed Knight panel, each row’s markers stand in its press', async ({
    page
}) => {
    await openFunction(page, 'knightPush', 'knight', /^\s*Push/)
    test.skip(!printed(), 'no printed board in the folder')
    const area = page.locator('[data-bench-area="knight"]')
    const panel = await boxOf(panelImage(area, 'knight').locator('> image'))
    const rows = area.locator('[data-bench-place^="row:"]')
    const presses: Box[] = []
    for (let index = 0; index < (await rows.count()); index++) {
        const press = await boxOf(rows.nth(index))
        expect(inside(centre(press), panel)).toBe(true)
        presses.push(press)
    }
    expect(presses.length).toBeGreaterThan(0)
    const markers = area.locator('[data-world^="knight:"]')
    for (let index = 0; index < (await markers.count()); index++) {
        const at = centre(await boxOf(markers.nth(index)))
        expect(presses.some((press) => inside(at, press))).toBe(true)
    }
})

test('R-4.6.3 on the printed rosary in the trade picker, every bead lies on the panel', async ({
    page
}) => {
    await openFunction(page, 'monkTrade', 'monk', /^\s*Trade/)
    test.skip(!printed(), 'no printed board in the folder')
    const area = page.locator('[data-upright-guild="monk"]')
    const panel = await boxOf(panelImage(area, 'monk').locator('> image'))
    const beads = area.locator('[data-world^="bead:"]')
    expect(await beads.count()).toBeGreaterThan(0)
    for (let index = 0; index < (await beads.count()); index++) {
        expect(inside(centre(await boxOf(beads.nth(index))), panel)).toBe(true)
    }
})

test('R-1.3 the printed map carries no seam: no one-pixel yellow column stands out from its neighbours', async ({
    page
}) => {
    await openTable(page, 'guildPick')
    const map = page.locator('[data-board-surface] svg[aria-label="The map"] > image')
    test.skip((await map.count()) === 0, 'no printed map in the folder')
    const href = await map.first().getAttribute('href')
    expect(href).toBeTruthy()
    // The columns where, in more than a fifth of the rows, the print is yellow and stands apart from
    // the columns either side.
    const seams = await page.evaluate(async (url) => {
        const image = new Image()
        image.src = url
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) {
            throw new Error('no canvas')
        }
        context.drawImage(image, 0, 0)
        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
        const found: number[] = []
        for (let x = 1; x < width - 1; x += 1) {
            let apart = 0
            for (let y = 0; y < height; y += 1) {
                const at = (dx: number, channel: number) => data[(y * width + x + dx) * 4 + channel]
                let differs = 0
                for (let channel = 0; channel < 3; channel += 1) {
                    differs += Math.abs(at(0, channel) - (at(-1, channel) + at(1, channel)) / 2)
                }
                const [r, g, b] = [at(0, 0), at(0, 1), at(0, 2)]
                if (differs > 40 && r > 150 && g > 150 && b < r - 30) {
                    apart += 1
                }
            }
            if (apart / height > 0.2) {
                found.push(x)
            }
        }
        return found
    }, href as string)
    expect(seams).toEqual([])
})

test('the catalog’s cover is the supplied box front where the folder holds it', async ({
    page
}) => {
    test.skip(
        !existsSync(new URL('../src/lib/art/supplied/cover.webp', import.meta.url)),
        'no supplied cover in the folder'
    )
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import { UiDefinition } from '/src/lib/definitions/definition.ts'
            document.body.dataset.thumbnail = UiDefinition.info.thumbnailUrl`
    })
    await page.waitForSelector('body[data-thumbnail]')
    const thumbnail = await page.locator('body').getAttribute('data-thumbnail')
    expect(thumbnail).toContain('supplied/cover.webp')
    // It is the file itself, not a picture drawn in its place.
    const served = await page.evaluate(async (url) => {
        const response = await fetch(url)
        return { ok: response.ok, type: response.headers.get('content-type') }
    }, thumbnail as string)
    expect(served).toEqual({ ok: true, type: 'image/webp' })
})
