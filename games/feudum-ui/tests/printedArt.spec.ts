import { expect, test, type Locator, type Page } from '@playwright/test'
import { GuildById, GuildIds, MarketSpaces } from '@tabletop/feudum'
import { createGame, playToHands, settled } from './helpers.js'

/**
 * The printed board under the pieces and the presses, where the folder holds it: each panel's print
 * fills its area exactly, at board and bench scale, and the bench's presses and the pieces they move
 * stand on the same printed spaces. With no files, the drawn board is proved by the other specs, and
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
        await page.locator(`[data-board-surface] [data-pick="guild:${guild}"]`).click()
    }
    await page.locator('[data-board-popup] button').filter({ hasText: fn }).first().click()
    await settled(page)
}

/** Whether the folder holds the printed panels: their image draws in place of the plate. */
async function printed(page: Page) {
    return (
        (await page
            .locator('[data-board-surface] svg[aria-label$="guild panel"] > image')
            .count()) > 0
    )
}

test('R-3.1 each printed card fills its face, and at standard size carries no name plate over its print', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await createGame(page)
    await playToHands(page)
    await settled(page)
    const rows = page.locator('[data-action-panel] [data-cards] [data-row]')
    await expect(rows).toHaveCount(11)
    const prints = rows.locator('svg[role="img"] > image[href*="card.action."]')
    test.skip(
        (await prints.count()) === 0 ||
            !(await prints.first().getAttribute('href'))?.match(/card\.action\.\w+\.\w+\./),
        'no printed cards in the folder, or a seat colour the print lacks'
    )
    for (let index = 0; index < 11; index++) {
        const row = rows.nth(index)
        const face = row.locator('svg[role="img"]').first()
        expectSameBox(await boxOf(face.locator('> image')), await boxOf(face))
        expect((await boxOf(face)).width, `card ${index + 1}`).toBeGreaterThanOrEqual(60)
        await expect(face.locator('> rect'), `card ${index + 1}`).toHaveCount(0)
        const name = (await row.getAttribute('data-row')) ?? ''
        await expect(face).toHaveAccessibleName(new RegExp(`^${name.split(':')[0]} card, `))
    }
})

test('S71 each printed seat piece stands centred where the drawn piece stood', async ({ page }) => {
    await openTable(page, 'guildPick')
    const prints = page.locator('[data-board-surface] svg[role="img"] > image[href*="piece."]')
    test.skip((await prints.count()) === 0, 'no printed pieces in the folder')
    const seen = { marker: 0, disc: 0 }
    for (let index = 0; index < (await prints.count()); index++) {
        const image = prints.nth(index)
        const token = image.locator('xpath=..')
        const box = await boxOf(token)
        const print = await boxOf(image)
        const at = centre(print)
        const middle = centre(box)
        expect(Math.abs(at.x - middle.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(at.y - middle.y)).toBeLessThanOrEqual(1)
        expect(print.width).toBeLessThanOrEqual(box.width + 0.5)
        expect(print.height).toBeLessThanOrEqual(box.height + 0.5)
        await expect(token.locator('text')).toHaveText(/^\S$/)
        const href = (await image.getAttribute('href')) ?? ''
        for (const kind of ['marker', 'disc'] as const) {
            if (href.includes(`piece.${kind}.`)) {
                seen[kind]++
            }
        }
    }
    expect(seen.marker).toBeGreaterThan(0)
    expect(seen.disc).toBeGreaterThan(0)
})

test('R-1.3 each printed panel fills its guild area, and the printed ring the whole board', async ({
    page
}) => {
    await openTable(page, 'guildPick')
    test.skip(!(await printed(page)), 'no printed board in the folder')
    const surface = page.locator('[data-board-surface]')
    for (const guild of GuildIds) {
        const frame = panelImage(surface, guild)
        expectSameBox(await boxOf(frame.locator('> image')), await boxOf(frame))
    }
    const ring = surface.locator('svg[aria-label="The board\'s edge"]')
    expectSameBox(await boxOf(ring.locator('> image')), await boxOf(ring))
})

test('R-4.6.2 on the printed market, each good stands in the bin its press covers', async ({
    page
}) => {
    await openFunction(page, 'merchantTrade', 'merchant', /^\s*Trade/)
    test.skip(!(await printed(page)), 'no printed board in the folder')
    const area = page.locator('[data-bench-area="merchant"]')
    const panel = await boxOf(panelImage(area, 'merchant').locator('> image'))
    let seen = 0
    for (const { id, good } of MarketSpaces) {
        const piece = area.locator(`[data-world="good:${id}"]`)
        if ((await piece.count()) === 0) {
            continue
        }
        const press = await boxOf(area.locator(`[data-bench-place="good:${good}"]`))
        expect(inside(centre(press), panel)).toBe(true)
        expect(inside(centre(await boxOf(piece.first())), press), id).toBe(true)
        seen++
    }
    expect(seen).toBeGreaterThan(0)
})

test('R-4.6.3 on the printed Knight panel, each row’s markers stand in its press', async ({
    page
}) => {
    await openFunction(page, 'knightPush', 'knight', /^\s*Push/)
    test.skip(!(await printed(page)), 'no printed board in the folder')
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

test('R-4.6.3 on the printed rosary, every bead lies on the panel', async ({ page }) => {
    await openFunction(page, 'monkTrade', 'monk', /^\s*Trade/)
    test.skip(!(await printed(page)), 'no printed board in the folder')
    const area = page.locator('[data-bench-area="monk"]')
    const panel = await boxOf(panelImage(area, 'monk').locator('> image'))
    const beads = area.locator('[data-world^="bead:"]')
    expect(await beads.count()).toBeGreaterThan(0)
    for (let index = 0; index < (await beads.count()); index++) {
        expect(inside(centre(await boxOf(beads.nth(index))), panel)).toBe(true)
    }
})
