import { expect, test, type Page } from '@playwright/test'
import { settled, shot } from './helpers.js'

/**
 * The follow-up panels on the real table. The session specs prove what each says and sends; this
 * proves they draw, that another seat's page is the same whichever hand the asked seat holds, and
 * that a row points at what it would touch.
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
const primary = (page: Page) => panel(page).locator('[data-primary]')
const lit = (page: Page) => page.locator('[data-bright]')

async function openTable(page: Page, call: string) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import * as tables from '/src/lib/testing/followUpTablePage.ts'
            await tables.${call}
            document.body.dataset.benchTable = ''`
    })
    await page.waitForSelector('body[data-bench-table]', { timeout: 45_000 })
    await settled(page)
    await page.evaluate(() => document.fonts.ready)
}

/**
 * What the page holds and shows for this seat, in one world. No whole-page picture: scaled art rasters
 * a few pixels differently between any two loads of one world, and the markup names every picture.
 */
async function worldOf(page: Page, call: string) {
    await openTable(page, call)
    return {
        markup: await page.locator('div[data-game-ui]').innerHTML(),
        panel: await panel(page).screenshot({ animations: 'disabled' })
    }
}

for (const [name, opener] of [
    ['S34 the ask to defend', 'openDefendTable'],
    ['S38 the ask to starve', 'openStarveTable']
] as const) {
    for (const role of ['attacker', 'third'] as const) {
        test(`${name}: the ${role}'s page is the same with Defend held and not held`, async ({
            page
        }) => {
            const held = await worldOf(page, `${opener}(true, '${role}')`)
            const not = await worldOf(page, `${opener}(false, '${role}')`)
            expect(not.markup).toBe(held.markup)
            expect(not.panel.equals(held.panel)).toBe(true)
            await shot(page, `${opener}-${role}`)
        })
    }
}

test('S33 with Defend: the line first, both buttons, the tally under it', async ({ page }) => {
    await openTable(page, `openDefendTable(true, 'asked')`)
    await expect(panel(page).locator('[data-flow-line]')).toContainText('conquers your knight')
    await expect(primary(page)).toHaveText([
        "Flip Defend · +1 defence · +1 vp · can't be undone",
        "Let it stand · can't be undone"
    ])
    await expect(panel(page).locator('[data-combat-tally]')).toBeVisible()
    await shot(page, 'S33-asked-held')
})

test('S34 without Defend: the same line, the note, one button', async ({ page }) => {
    await openTable(page, `openDefendTable(false, 'asked')`)
    await expect(panel(page).locator('[data-note-line]')).toHaveText('You hold no Defend.')
    await expect(primary(page)).toHaveText(["Let it stand · can't be undone"])
    await shot(page, 'S34-asked-not-held')
})

test('S38 the asked seat with and without an answer', async ({ page }) => {
    await openTable(page, `openStarveTable(true, 'asked')`)
    await expect(primary(page)).toHaveText([
        "Royal Immunity · 1 food · can't be undone",
        "Let it go · can't be undone"
    ])
    await shot(page, 'S38-asked-held')
    await openTable(page, `openStarveTable(false, 'asked')`)
    await expect(panel(page).locator('[data-note-line]')).toHaveText("You can't answer.")
    await expect(primary(page)).toHaveText(["Let it go · can't be undone"])
    await shot(page, 'S38-asked-not-held')
})

test('R-4.8 the commit: the stepper raises the tally the third seat reads afterwards', async ({
    page
}) => {
    await openTable(page, `openCommitTable('attacker')`)
    await expect(panel(page).locator('[data-rows="saltpeter"]')).toContainText('Saltpeter 0')
    await expect(primary(page)).toContainText('Attack')
    const before = await primary(page).innerText()
    await panel(page).getByRole('button', { name: 'Add saltpeter' }).click()
    await expect(primary(page)).not.toHaveText(before)
    await shot(page, 'commit-attacker')
    await openTable(page, `openCommitTable('third')`)
    await expect(panel(page).locator('[data-waiting]')).toContainText('adds to the attack')
    await expect(panel(page).locator('[data-combat-tally]')).toBeVisible()
    await shot(page, 'commit-third')
})

test('S50 the at-will row opens its lists; a card pick hides it; S51 no seal during play', async ({
    page
}) => {
    await openTable(page, 'openAtWillTable()')
    const chips = panel(page).locator('[data-rows="at-will"]')
    // The chips are their pieces with counts; the words are their names.
    await expect(chips.getByRole('button', { name: 'Writs 2' })).toHaveCount(1)
    await expect(chips.getByRole('button', { name: 'Tiles 2' })).toHaveCount(1)
    await chips.getByRole('button', { name: 'Writs 2' }).click()
    const offers = panel(page).locator('[data-writ-offer]')
    await expect(offers).toHaveCount(2)
    await expect(panel(page)).not.toContainText('Seal · 1 seal')
    await shot(page, 'S50-writs')
    await chips.getByRole('button', { name: 'Tiles 2' }).click()
    // R-4.3 Each tile is its art, reading "Spend"; its name is the button's name, not its text.
    const tile = panel(page).locator('[data-rows^="tile:"]').first().getByRole('button')
    await expect(tile).toHaveAccessibleName(/^Spend [A-Z][a-z]+ I{1,3}V?$/)
    await expect(tile.locator('svg[role="img"]')).toBeVisible()
    await expect(tile.locator('span.beside-art')).toHaveText('Spend')
    await shot(page, 'tile-rows')
    await tile.click()
    await expect(panel(page).locator('[data-rows="goods"]')).toContainText('food')
    await shot(page, 'tiles')
    await panel(page).locator('[data-cards] button').first().click()
    await expect(chips).toHaveCount(0)
})

test('S52 the writ limit: faces, the primary and the at-will row', async ({ page }) => {
    await openTable(page, 'openWritLimitTable()')
    await expect(panel(page).locator('[data-flow-line]').first()).toHaveText(
        'Hold at most 3 writs: 4 now'
    )
    await expect(panel(page).locator('[data-writs] > div')).toHaveCount(4)
    await expect(panel(page).locator('[data-rows="at-will"]')).toBeVisible()
    await shot(page, 'S52-writ-limit')
})

test('S53 nourish: the order row, the picker, and a feed brightens its pawn', async ({ page }) => {
    await openTable(page, `openNourishTable('seat')`)
    await expect(panel(page).locator('[data-order-row="nourish"]')).toBeVisible()
    // Contract, Round end: the summary stands beside the rows, and holds the send.
    const rows = panel(page).locator('[data-nourish-rows]')
    const summary = panel(page).locator('[data-nourish-summary]')
    const [rowsBox, summaryBox] = [await rows.boundingBox(), await summary.boundingBox()]
    expect(summaryBox && rowsBox && summaryBox.x >= rowsBox.x + rowsBox.width).toBe(true)
    await expect(summary.locator('[data-primary]')).toHaveText(/^Feed 2 · leave the /)
    await expect(panel(page).locator('[data-nourish-pawn] [data-pawn-cube]')).toHaveCount(3)
    await panel(page).getByRole('button', { name: 'Unfed' }).first().hover()
    await expect(lit(page).first()).toBeAttached()
    await shot(page, 'S53-nourish')
    await openTable(page, `openNourishTable('other')`)
    await expect(panel(page).locator('[data-order-row="nourish"]')).toBeVisible()
    await expect(panel(page).locator('[data-waiting]')).toContainText('feeds pawns')
    await shot(page, 'S53-nourish-waiting')
})

for (const [width, viewport] of [
    ['desk', { width: 1440, height: 900 }],
    ['phone', { width: 390, height: 844 }]
] as const) {
    test(`S53 R-4.10-H4 nourish at once, ${width}: a hotseat serves each seat deciding, and the waiting line names them`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await openTable(page, `openNourishTogetherTable('hotseat')`)
        const row = panel(page).locator('[data-order-row="nourish"]')
        await expect(row.locator('[data-deciding]')).toHaveCount(2)
        await expect(row.locator('[data-next]')).toHaveCount(0)
        await expect(panel(page).locator('[data-nourish-pawn]')).toHaveCount(3)
        await expect(panel(page).locator('[data-primary]')).toHaveText(/Feed 2/)
        await shot(page, `S53-nourish-together-first-${width}`)

        await panel(page).locator('[data-primary]').click()
        await settled(page)

        await expect(row.locator('[data-deciding]')).toHaveCount(1)
        await expect(row.locator('[data-done]')).toHaveCount(2)
        await expect(panel(page).locator('[data-nourish-pawn]')).not.toHaveCount(0)
        await expect(panel(page).locator('[data-primary]')).toHaveText(/^Feed/)
        await shot(page, `S53-nourish-together-second-${width}`)

        await openTable(page, `openNourishTogetherTable('watcher')`)
        await expect(panel(page).locator('[data-waiting]')).toHaveText(/^\S.* and \S.* feed pawns$/)
        await expect(row.locator('[data-deciding]')).toHaveCount(2)
        // No seat is next while seats feed at once: the header names the step, as for hands.
        await expect(page.locator('[data-table-header]')).toContainText('Feeding pawns')
        await shot(page, `S53-nourish-together-waiting-${width}`)
    })
}

test('S55 landscapes: the order row, each filled space, and a row brightens it', async ({
    page
}) => {
    await openTable(page, `openLandscapesTable('seat')`)
    await expect(panel(page).locator('[data-order-row="landscapes"]')).toBeVisible()
    await expect(primary(page)).toHaveText('Leave all')
    await panel(page)
        .getByRole('button', { name: /^collect/ })
        .first()
        .hover()
    await expect(lit(page).first()).toBeAttached()
    await shot(page, 'S55-landscapes')
    await openTable(page, `openLandscapesTable('other')`)
    await expect(panel(page).locator('[data-waiting]')).toContainText('collects landscapes')
    await shot(page, 'S55-landscapes-waiting')
})

test('S54 the dawn sheet stands in the action area, with the next decision above it', async ({
    page
}) => {
    await openTable(page, 'openDawnTable()')
    const sheet = panel(page).locator('[data-dawn-sheet]')
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('[data-dawn-row]')).toHaveCount(3)
    await expect(panel(page)).not.toContainText('Epoch II dawn')
    await expect(sheet).toContainText('Dawn of epoch II')
    await shot(page, 'S54-dawn-sheet')
})

test('S56 the summary replaces the panel: a charter stands face up with its score', async ({
    page
}) => {
    await openTable(page, 'openGameEndTable()')
    const summary = panel(page).locator('[data-game-end]')
    await expect(summary).toBeVisible()
    await expect(summary.locator('[data-game-end-seat]')).toHaveCount(3)
    await expect(summary.locator('[data-game-end-charter]')).toHaveCount(1)
    await expect(summary.locator('[data-game-winner]')).toContainText(/wins?$/)
    await expect(primary(page)).toHaveCount(0)
    await shot(page, 'S56-game-end')
})
