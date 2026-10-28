import { expect, test, type Locator, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

// R-8 — the chronicle at the end of a won game: the winner's steps, what the others see, the story,
// the result, the History's rows and the Chronicle tab. Each at a desktop's width and a phone's.

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
}

async function viewOffTheClock(page: Page) {
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.viewOffTheClock()
    })
}

const panel = (page: Page) => page.locator('.panel')
const history = (page: Page) => page.locator('.history')
const button = (page: Page, name: string) => panel(page).getByRole('button', { name, exact: true })
const boardCardNamed = (page: Page, name: string) =>
    page.locator('.board-card').filter({ has: page.locator(`img[alt="${name}"]`) })

async function noOverflow(page: Page, width: number) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
    )
}

/** On a phone every shown button in the panel is 44 px tall. */
async function phoneButtons(page: Page) {
    const heights = await panel(page)
        .locator('button:visible:not(.magnifier)')
        .evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().height)))
    expect(heights.length).toBeGreaterThan(0)
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
}

/** A group of buttons shares its widest width. */
async function sharedWidth(group: Locator) {
    const widths = await group
        .locator('button:visible')
        .evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().width)))
    expect(new Set(widths).size, `widths ${widths.join(', ')}`).toBe(1)
}

/** On a phone the map opens on one region: frame `region` and let the glide stop. */
async function showRegion(page: Page, region: string) {
    await page
        .locator('.chooser__view', { hasText: region })
        .evaluate((view) => view instanceof HTMLElement && view.click())
    await page.waitForTimeout(600)
}

async function openTab(page: Page, name: string) {
    await page.getByRole('tab', { name }).click()
}

for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    const phone = viewport.width < 640
    const size = phone ? 'phone' : 'desktop'
    const shot = (page: Page, name: string) =>
        page.screenshot({ path: test.info().outputPath(`chronicle-${name}-${size}.png`) })

    test.describe(`the chronicle, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('the Vow: three Oaths, never this game’s; a tap rings one and Confirm appears', async ({
            page
        }) => {
            await openTable(page, 'chronicleVow')
            await expect(page.locator('.information-panel, .panel').first()).toBeVisible()
            await expect(page.getByText('Chronicle', { exact: true }).first()).toBeVisible()
            const oaths = panel(page).getByRole('button', { name: /^Oath of / })
            await expect(oaths).toHaveCount(3)
            await expect(
                panel(page).getByRole('button', { name: /^Oath of Supremacy/ })
            ).toHaveCount(0)
            await expect(button(page, 'Confirm')).toHaveCount(0)
            await panel(page)
                .getByRole('button', { name: /^Oath of Protection/ })
                .click()
            await expect(button(page, 'Confirm')).toBeVisible()
            if (phone) await phoneButtons(page)
            await noOverflow(page, viewport.width)
            await shot(page, 'vow')
        })

        test('the offer: Ann’s chip toggles, "Offer" once picked, "No offer" always', async ({
            page
        }) => {
            await openTable(page, 'chronicleOffer')
            await expect(panel(page)).toContainText('Offer Citizenship to:')
            await expect(button(page, 'No offer')).toBeVisible()
            await expect(button(page, 'Offer')).toHaveCount(0)
            await panel(page).getByRole('button', { name: /ann/i }).click()
            await expect(button(page, 'Offer')).toBeVisible()
            await sharedWidth(panel(page).locator('.buttons'))
            if (phone) await phoneButtons(page)
            await noOverflow(page, viewport.width)
            await shot(page, 'offer')
        })

        test('the answer: the offered Exile sees the offer alone; Accept and Refuse', async ({
            page
        }) => {
            await openTable(page, 'chronicleAnswer')
            await expect(panel(page)).toContainText('offers you Citizenship.')
            await expect(button(page, 'Accept')).toBeVisible()
            await expect(button(page, 'Refuse')).toBeVisible()
            await expect(panel(page)).not.toContainText('You get')
            await sharedWidth(panel(page).locator('.answers'))
            if (phone) await phoneButtons(page)
            await noOverflow(page, viewport.width)
            await shot(page, 'answer')
        })

        test('everyone else waits on the chooser’s chip, with no panel and no rings', async ({
            page
        }) => {
            await openTable(page, 'chronicleBuild')
            await viewOffTheClock(page)
            await expect(panel(page)).toContainText('Waiting on')
            await expect(panel(page)).not.toContainText('Build an edifice.')
            await expect(page.locator('.board-card.offered')).toHaveCount(0)
            await noOverflow(page, viewport.width)
            await shot(page, 'waiting')
        })

        test('the build: ringed denizens on the map; a tap shows the edifice; Build and None', async ({
            page
        }) => {
            await openTable(page, 'chronicleBuild')
            await expect(panel(page)).toContainText('Build an edifice.')
            await expect(button(page, 'None')).toBeVisible()
            await expect(button(page, 'Build')).toHaveCount(0)
            await expect(page.locator('.board-card.offered')).toHaveCount(4)
            if (phone) await showRegion(page, 'Cradle')
            await shot(page, 'build')
            await boardCardNamed(page, 'Longbows').locator('.board-card__pick').click()
            await expect(boardCardNamed(page, 'Longbows')).toHaveClass(/pointed/)
            await expect(
                panel(page).locator('[data-build-preview] img[alt="Sprawling Rampart"]')
            ).toBeVisible()
            await expect(button(page, 'Build')).toBeVisible()
            await sharedWidth(panel(page).locator('.buttons'))
            if (phone) await phoneButtons(page)
            await noOverflow(page, viewport.width)
            await shot(page, 'build-picked')
        })

        test('a ruin: ringed for repair, its intact side shown; its site’s denizen is not ringed', async ({
            page
        }) => {
            await openTable(page, 'chronicleRepair')
            await expect(panel(page)).toContainText('Build or repair an edifice.')
            await expect(
                boardCardNamed(page, 'Alchemist').and(page.locator('.offered'))
            ).toHaveCount(0)
            if (phone) await showRegion(page, 'Provinces')
            await boardCardNamed(page, 'Fallen Spire').locator('.board-card__pick').click()
            await expect(
                panel(page).locator('[data-build-preview] img[alt="Great Spire"]')
            ).toBeVisible()
            // The map still shows the ruined side.
            await expect(boardCardNamed(page, 'Fallen Spire')).toBeVisible()
            await expect(button(page, 'Repair')).toBeVisible()
            if (phone) await phoneButtons(page)
            await noOverflow(page, viewport.width)
            await shot(page, 'repair')
        })

        test('the suit: one framed button per tied suit, each showing what it adds', async ({
            page
        }) => {
            await openTable(page, 'chronicleSuit')
            await expect(panel(page)).toContainText('Add to the world deck:')
            const suits = panel(page).locator('button[aria-pressed]')
            await expect(suits).toHaveCount(2)
            await expect(suits.first()).toHaveAttribute('aria-label', '3 Order, 2 Hearth, 1 Beast')
            await expect(suits.last()).toHaveAttribute('aria-label', '3 Hearth, 2 Beast, 1 Nomad')
            await suits.first().click()
            await expect(button(page, 'Confirm')).toBeVisible()
            if (phone) await phoneButtons(page)
            await noOverflow(page, viewport.width)
            await shot(page, 'suit')
        })

        test('the tied heal: "Heal the Archive from:" with each stack’s count', async ({
            page
        }) => {
            await openTable(page, 'chronicleHeal')
            await expect(panel(page)).toContainText('Heal the Archive from:')
            const stacks = panel(page).locator('button[aria-pressed]')
            await expect(stacks).toHaveCount(2)
            await expect(stacks.first()).toHaveAttribute('aria-label', '5 Order')
            await expect(stacks.last()).toHaveAttribute('aria-label', '5 Beast')
            if (phone) await phoneButtons(page)
            await noOverflow(page, viewport.width)
            await shot(page, 'heal')
        })

        test('the story: Skip always, Write once there is text, "70 left" near the cap', async ({
            page
        }) => {
            await openTable(page, 'chronicleStory')
            const box = panel(page).getByPlaceholder('Tell your story in your own way.')
            await expect(panel(page)).toContainText('The story of game 1:')
            await expect(button(page, 'Skip')).toBeVisible()
            await expect(button(page, 'Write')).toHaveCount(0)
            await shot(page, 'story-empty')
            await box.fill('The title stayed with me.')
            await expect(button(page, 'Write')).toBeVisible()
            await expect(panel(page).locator('[data-story-left]')).toHaveCount(0)
            await box.fill('a'.repeat(930))
            await expect(panel(page).locator('[data-story-left]')).toHaveText('70 left')
            // A long story scrolls inside its box.
            const scrolls = await box.evaluate((el) => el.scrollHeight > el.clientHeight)
            expect(scrolls).toBe(true)
            await box.fill('a'.repeat(1200))
            await expect(box).toHaveValue('a'.repeat(1000))
            await box.fill('a'.repeat(930))
            await sharedWidth(panel(page).locator('.buttons'))
            if (phone) await phoneButtons(page)
            await noOverflow(page, viewport.width)
            await shot(page, 'story')
            // The panel is drawn again in full screen and out of it; the story stays typed.
            await page.getByRole('button', { name: 'Enter full screen' }).click()
            const dialog = page.locator('dialog[aria-label="Full screen view"]')
            await expect(dialog.getByPlaceholder('Tell your story in your own way.')).toHaveValue(
                'a'.repeat(930)
            )
            await expect(dialog.locator('[data-story-left]')).toHaveText('70 left')
            await dialog.getByRole('button', { name: 'Exit full screen' }).click()
            await expect(dialog).toHaveCount(0)
            await expect(box).toHaveValue('a'.repeat(930))
            await expect(panel(page).locator('[data-story-left]')).toHaveText('70 left')
        })

        test('the result: today’s panel, and game 1’s History from the win to the story', async ({
            page
        }) => {
            await openTable(page, 'chronicleResult')
            await expect(page.getByText('The game is over')).toBeVisible()
            await expect(page.getByText(/won\s+as Usurper/).first()).toBeVisible()
            await noOverflow(page, viewport.width)
            await shot(page, 'result')
            await openTab(page, 'History')
            await expect(history(page)).toContainText('won as Usurper. The Chronicle begins.')
            await expect(history(page)).toContainText(
                'swore the Oath of Protection: the Oathkeeper holds the most relics and banners.'
            )
            await expect(history(page)).toContainText(
                'Kept Plains, Ancient City, Steppe and Deep Woods'
            )
            await expect(history(page)).toContainText('Rebuilt the world deck.')
            await expect(history(page)).toContainText('wrote the story of game 1.')
            await noOverflow(page, viewport.width)
            await shot(page, 'history')
        })

        test('the Chronicle tab: two entries, newest first; four tabs on one line', async ({
            page
        }) => {
            await openTable(page, 'chronicleRecord')
            const tabs = page.getByRole('tab')
            await expect(tabs).toHaveText(['Players', 'History', 'Chronicle', 'Chat'])
            const tops = await tabs.evaluateAll((all) =>
                all.map((tab) => Math.round(tab.getBoundingClientRect().top))
            )
            expect(new Set(tops).size).toBe(1)
            // Inside the side column: the last tab ends before the column does.
            const list = await page.getByRole('tablist').boundingBox()
            const chat = await tabs.last().boundingBox()
            expect(list && chat && chat.x + chat.width <= list.x + list.width + 1).toBe(true)
            await openTab(page, 'Chronicle')
            const entries = page.locator('.chronicle-tab article')
            await expect(entries).toHaveCount(2)
            await expect(entries.first()).toContainText('Game 2 · Thursday table')
            await expect(entries.first()).toContainText('Sprawling Rampart at Plains')
            await expect(entries.last()).toContainText('Game 1 · Thursday table')
            await expect(entries.last()).toContainText('Rhys held the Cradle')
            // Game 1's Dana keeps the red they played then, though Dana sits blue now.
            await expect(entries.last().locator('[data-record-chip="red"]').first()).toHaveText(
                'Dana'
            )
            await noOverflow(page, viewport.width)
            await shot(page, 'tab')
            await openTab(page, 'History')
            await expect(page.locator('[data-record-row]')).toHaveCount(2)
            await page.locator('[data-record-row="1"]').click()
            await expect(history(page).locator('article')).toContainText('Game 1 · Thursday table')
            await noOverflow(page, viewport.width)
            await shot(page, 'record-rows')
        })

        test('a game with no record has the three tabs of today', async ({ page }) => {
            await openTable(page, 'chronicleVow')
            await expect(page.getByRole('tab')).toHaveText(['Players', 'History', 'Chat'])
        })

        for (const table of ['chronicleVow', 'chronicleRecord'] as const) {
            test(`Chat behaves as today beside ${table === 'chronicleVow' ? 'three' : 'four'} tabs: opening it reads the messages, so no unread dot`, async ({
                page
            }) => {
                await openTable(page, table)
                const chat = page.getByRole('tab', { name: 'Chat' })
                const dot = chat.locator('[class*="bg-red"]')
                await chat.click()
                await expect(page.getByRole('tabpanel', { name: 'Chat' })).toBeVisible()
                await expect(dot).toHaveCount(0)
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toBeVisible()
            })
        }
    })
}
