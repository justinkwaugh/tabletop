import { expect, test, type Locator, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
}

async function viewOffTheClock(page: Page): Promise<string | undefined> {
    return page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.viewOffTheClock()
    })
}

const FORGE = 'edifice.nomad.ancient-forge'
const SPIRE = 'edifice.arcane.great-spire'
const DISTRICT = 'edifice.discord.festival-district'
const RAMPART = 'edifice.order.sprawling-rampart'

const panel = (page: Page) => page.locator('.panel')
const grid = panel
const tile = (page: Page, label: string) =>
    grid(page).locator('.majors button').filter({ hasText: label })
const preview = (page: Page) => page.locator('.card-preview')
const otherSide = (page: Page) => preview(page).locator('[data-other-side]')
const boardCardNamed = (page: Page, name: string) =>
    page.locator('.board-card').filter({ has: page.locator(`img[alt="${name}"]`) })
const usePower = (page: Page) =>
    panel(page).getByRole('button', { name: 'Use a power', exact: true })
const powerRow = (page: Page, cardId: string) =>
    panel(page).locator(`[data-action-power="${cardId}"]`)
const history = (page: Page) => page.locator('.history')
const undoButton = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })

async function box(locator: Locator) {
    const found = await locator.boundingBox()
    expect(found).not.toBeNull()
    return found ?? { x: 0, y: 0, width: 0, height: 0 }
}

/** On a phone the map opens on one region: frame `region` and wait for the glide to stop. */
async function showRegion(page: Page, region: string) {
    await page
        .locator('.chooser__view', { hasText: region })
        .evaluate((view) => view instanceof HTMLElement && view.click())
    const card = page.locator('.board-card').first()
    let last = ''
    await expect
        .poll(async () => {
            const now = JSON.stringify(await card.boundingBox())
            const still = now === last
            last = now
            return still
        })
        .toBe(true)
}

async function noOverflow(page: Page, width: number) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
    )
}

async function openHistory(page: Page) {
    await page.getByRole('tab', { name: 'History' }).click()
}

/** Every button in the panel that is shown is 44 px tall on a phone. */
async function phoneButtons(page: Page) {
    const heights = await panel(page)
        .locator('button:visible:not(.magnifier)')
        .evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().height)))
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
}

for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    const phone = viewport.width < 640
    const size = phone ? 'phone' : 'desktop'

    test.describe(`edifices on the map, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('an edifice sits first in its site’s row, drawn and named by the side that is up', async ({
            page
        }) => {
            await openTable(page, 'edificeMap')
            if (phone) await showRegion(page, 'Cradle')
            const hall = await box(boardCardNamed(page, 'Hall of Debate'))
            const wolves = await box(boardCardNamed(page, 'Wolves'))
            expect(hall.x).toBeLessThan(wolves.x)
            expect(Math.abs(hall.y - wolves.y)).toBeLessThan(2)
            if (phone) await showRegion(page, 'Hinterland')
            await expect(boardCardNamed(page, 'Broken Forge')).toBeVisible()
            await expect(page.locator(`[data-use-badge="${FORGE}"]`)).toHaveAttribute(
                'aria-label',
                'Use Broken Forge'
            )
            await noOverflow(page, viewport.width)
            await page.screenshot({ path: test.info().outputPath(`edifice-map-${size}.png`) })
        })

        test('an enlarged intact edifice: "ruled by", and its other side small, headed "Other side"', async ({
            page
        }) => {
            await openTable(page, 'edificeMap')
            if (phone) await showRegion(page, 'Cradle')
            await boardCardNamed(page, 'Hall of Debate').click()
            await expect(preview(page)).toContainText('ruled by')
            await expect(preview(page)).not.toContainText('No suit')
            await expect(otherSide(page)).toContainText('Other side')
            const other = otherSide(page).locator('img[alt="Hall of Mockery"]')
            await expect(other).toBeVisible()
            expect(Math.round((await box(other)).width)).toBe(phone ? 96 : 150)
            const card = await box(preview(page).locator('.card-preview__frame'))
            const small = await box(other)
            if (phone) {
                const boxes = await box(preview(page).locator('.card-preview__pieces').last())
                expect(small.y).toBeGreaterThan(boxes.y + boxes.height - 1)
            } else {
                // Beside the card, its foot on the card's foot.
                expect(small.x).toBeGreaterThan(card.x + card.width)
                expect(Math.abs(small.y + small.height - (card.y + card.height))).toBeLessThan(2)
            }
            await noOverflow(page, viewport.width)
            await page.screenshot({
                path: test.info().outputPath(`edifice-enlarged-intact-${size}.png`)
            })
        })

        test('an enlarged ruin: one line about its missing suit, no box when the bandits rule it', async ({
            page
        }) => {
            await openTable(page, 'edificeMap')
            if (phone) await showRegion(page, 'Hinterland')
            await boardCardNamed(page, 'Broken Forge').click()
            await expect(preview(page)).toContainText('No suit; can’t be used to Muster or Trade.')
            await expect(preview(page)).not.toContainText('ruled by')
            await expect(otherSide(page).locator('img[alt="Ancient Forge"]')).toBeVisible()
            await page.screenshot({
                path: test.info().outputPath(`edifice-enlarged-ruin-${size}.png`)
            })
        })

        test('the enlarged site names the edifice among the denizens by its face-up side', async ({
            page
        }) => {
            await openTable(page, 'edificeMap')
            if (phone) await showRegion(page, 'Hinterland')
            await page
                .locator('.site')
                .filter({ has: page.locator('img[alt="Standing Stones"]') })
                .locator('.board-card')
                .first()
                .click()
            const pieces = preview(page).locator('.card-preview__pieces').first()
            await expect(pieces).toContainText('1 bandit rules here')
            await expect(pieces).toContainText('Broken Forge')
            await expect(pieces).toContainText('1 relic')
            await page.screenshot({ path: test.info().outputPath(`edifice-site-${size}.png`) })
        })

        test('Broken Forge in Use a power, then flipped: Ancient Forge, its tokens, and the History', async ({
            page
        }) => {
            await openTable(page, 'edificeMap')
            await usePower(page).click()
            const row = powerRow(page, FORGE)
            await expect(row).toContainText('Broken Forge')
            const use = row.getByRole('button', { name: 'Use, paying 2 favor + 2 secrets' })
            await expect(use).toBeVisible()
            await page.screenshot({
                path: test.info().outputPath(`edifice-broken-forge-${size}.png`)
            })
            await use.click()
            if (phone) await showRegion(page, 'Hinterland')
            await expect(boardCardNamed(page, 'Ancient Forge')).toBeVisible()
            await expect(boardCardNamed(page, 'Broken Forge')).toHaveCount(0)
            await page.screenshot({ path: test.info().outputPath(`edifice-flipped-${size}.png`) })
            // Its tokens stay on it until Rest, so Ancient Forge cannot be used now: no "Use".
            await expect(page.locator(`[data-use-badge="${FORGE}"]`)).toHaveCount(0)
            await openHistory(page)
            // The History draws each count as its token.
            await expect(history(page)).toContainText(
                /used Broken Forge, placing 2\s*and 2\s*on it: flipped it to Ancient Forge/
            )
        })

        test('Ancient Forge draws a relic and asks "Take Cup of Plenty?"', async ({ page }) => {
            await openTable(page, 'edificeAncientForge')
            await usePower(page).click()
            const use = powerRow(page, FORGE).getByRole('button', {
                name: 'Use, paying 2 favor + 1 secret'
            })
            await expect(powerRow(page, FORGE)).toContainText('Ancient Forge')
            await use.click()
            await expect(panel(page)).toContainText('Take Cup of Plenty?')
            const take = panel(page).getByRole('button', { name: 'Take', exact: true })
            const bottom = panel(page).getByRole('button', { name: 'To the bottom', exact: true })
            expect(Math.round((await box(take)).width)).toBe(Math.round((await box(bottom)).width))
            await page.screenshot({
                path: test.info().outputPath(`edifice-forge-question-${size}.png`)
            })
            await take.click()
            await openHistory(page)
            await expect(history(page)).toContainText(
                /used Ancient Forge, placing 2\s*on it and burning 1\s*: drew a relic — take it, or put it on the bottom; you saw Cup of Plenty/
            )
            await expect(history(page)).toContainText('took Cup of Plenty')
        })
    })

    test.describe(`the edifice powers, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('Great Spire’s Cards row: "swap with the Dispossessed", its secret in gold', async ({
            page
        }) => {
            await openTable(page, 'greatSpireMenu')
            await tile(page, 'Search').click()
            const row = panel(page).locator(`[data-card-row="${SPIRE}"]`)
            await expect(row).toContainText('Great Spire')
            await expect(row).toContainText('swap with the Dispossessed')
            await expect(row.locator('.text-oath-accent')).toContainText('1')
            await page.screenshot({
                path: test.info().outputPath(`edifice-spire-menu-${size}.png`)
            })
            // In use, the source menu's gold line adds the secret it places.
            await row.getByRole('button').first().click()
            await expect(row).toContainText('in use')
            const deck = grid(page).getByRole('button', { name: /^Search the world deck/ })
            await expect(deck).toContainText(/2 Supply\s*\+\s*1/)
            await page.screenshot({
                path: test.info().outputPath(`edifice-spire-in-use-${size}.png`)
            })
        })

        test('Great Spire with the Dispossessed empty is still offered, and says so', async ({
            page
        }) => {
            await openTable(page, 'greatSpireMenuEmpty')
            await tile(page, 'Search').click()
            const row = panel(page).locator(`[data-card-row="${SPIRE}"]`)
            await expect(row).toContainText('the Dispossessed is empty')
            await expect(row.locator('.text-oath-accent')).toContainText('1')
        })

        test('Great Spire’s swap step: pick, Swap and No swap at one width, then Keep one; Undo stops at the swap', async ({
            page
        }) => {
            await openTable(page, 'greatSpireSwap')
            await expect(panel(page)).toContainText('Great Spire: swap which?')
            const swap = panel(page).getByRole('button', { name: 'Swap', exact: true })
            const noSwap = panel(page).getByRole('button', { name: 'No swap', exact: true })
            await expect(noSwap).toBeVisible()
            await expect(swap).toHaveCount(0)
            const bearTraps = panel(page).locator(
                '[data-swap-card="denizen.order.bear-traps"] button:not(.magnifier)'
            )
            await bearTraps.click()
            await expect(bearTraps).toHaveAttribute('aria-pressed', 'true')
            await panel(page)
                .locator('[data-swap-card="denizen.hearth.a-round-of-ale"] button:not(.magnifier)')
                .click()
            await expect(swap).toBeVisible()
            expect(Math.round((await box(swap)).width)).toBe(Math.round((await box(noSwap)).width))
            if (phone) await phoneButtons(page)
            await noOverflow(page, viewport.width)
            await page.screenshot({
                path: test.info().outputPath(`edifice-spire-swap-${size}.png`)
            })
            await swap.click()
            await expect(panel(page)).toContainText('Keep one.')
            // Augury keeps its place; the two that came in take the places of the two that went.
            const kept = panel(page).locator('button:not(.magnifier) img')
            await expect(kept).toHaveCount(3)
            await expect(kept.nth(0)).toHaveAttribute('alt', 'Augury')
            for (const n of [1, 2]) {
                await expect(kept.nth(n)).not.toHaveAttribute('alt', /Bear Traps|A Round of Ale/)
            }
            await expect(undoButton(page)).toHaveCount(0)
            await page.screenshot({
                path: test.info().outputPath(`edifice-spire-kept-${size}.png`)
            })
            await openHistory(page)
            await expect(history(page)).toContainText(
                /swapped Bear Traps and A Round of Ale for .+ and .+ from the Dispossessed \(Great Spire\)/
            )
        })

        test('No swap goes on to Keep one with nothing sent', async ({ page }) => {
            await openTable(page, 'greatSpireSwap')
            await panel(page).getByRole('button', { name: 'No swap', exact: true }).click()
            await expect(panel(page)).toContainText('Keep one.')
            const drawn = panel(page).locator('button:not(.magnifier) img')
            await expect(drawn.nth(1)).toHaveAttribute('alt', 'Bear Traps')
            await openHistory(page)
            await expect(history(page)).not.toContainText('Dispossessed')
        })

        test('a Vision stays in the row and cannot be tapped; picks stop at the Dispossessed’s count', async ({
            page
        }) => {
            await openTable(page, 'greatSpireSwapVision')
            const vision = panel(page).locator('[data-swap-card="vision.faith"]')
            await expect(vision).toHaveClass(/opacity-40/)
            await expect(vision.locator('button:not(.magnifier)')).toBeDisabled()
            const augury = panel(page).locator(
                '[data-swap-card="denizen.arcane.augury"] button:not(.magnifier)'
            )
            const traps = panel(page).locator(
                '[data-swap-card="denizen.order.bear-traps"] button:not(.magnifier)'
            )
            await augury.click()
            await traps.click()
            await expect(augury).toHaveAttribute('aria-pressed', 'true')
            await expect(traps).toHaveAttribute('aria-pressed', 'false')
            await page.screenshot({
                path: test.info().outputPath(`edifice-spire-vision-${size}.png`)
            })
        })

        test('Fallen Spire: five card backs labelled "Swap:", none picked, Use waits; a tap on the count clears it', async ({
            page
        }) => {
            await openTable(page, 'fallenSpire')
            await usePower(page).click()
            const row = powerRow(page, SPIRE)
            await expect(row).toContainText('Fallen Spire')
            const backs = row.locator('[data-count-backs] button')
            await expect(row.locator('[data-count-backs]')).toContainText('Swap:')
            await expect(backs).toHaveCount(5)
            const use = row.getByRole('button', { name: 'Use, paying 2 secrets' })
            await expect(use).toHaveCount(0)
            await backs.nth(2).click()
            await expect(use).toBeVisible()
            await page.screenshot({
                path: test.info().outputPath(`edifice-fallen-spire-${size}.png`)
            })
            await backs.nth(2).click()
            await expect(use).toHaveCount(0)
            await backs.nth(2).click()
            await use.click()
            await openHistory(page)
            await expect(history(page)).toContainText(
                /used Fallen Spire, placing 1\s*on it and burning 1\s*: swapped 3 denizens in the Provinces discard pile with the Dispossessed/
            )
        })

        test('Fallen Spire: backs past the pile’s count cannot be tapped', async ({ page }) => {
            await openTable(page, 'fallenSpireShort')
            await usePower(page).click()
            const backs = powerRow(page, SPIRE).locator('[data-count-backs] button')
            await expect(backs.nth(1)).toBeEnabled()
            for (const n of [2, 3, 4]) await expect(backs.nth(n)).toBeDisabled()
        })

        test('Squalid District asks its ruler: the roll, the End die panel’s line, three answers at one width', async ({
            page
        }) => {
            await openTable(page, 'squalidAsked')
            await expect(panel(page)).toContainText('Squalid District')
            await expect(panel(page)).toContainText('The end die rolled a 5.')
            await expect(panel(page)).toContainText('A 5 or higher ends the game:')
            await expect(panel(page)).toContainText('wins as the Chancellor.')
            const answers = ['Lower to 4', 'Raise to 6', 'Leave at 5'].map((name) =>
                panel(page).getByRole('button', { name, exact: true })
            )
            const widths = await Promise.all(
                answers.map(async (a) => Math.round((await box(a)).width))
            )
            expect(new Set(widths).size).toBe(1)
            await expect(answers[2]).not.toHaveClass(/bg-oath-primary/)
            await expect(answers[0]).toHaveClass(/bg-oath-primary/)
            if (phone) await phoneButtons(page)
            await page.screenshot({
                path: test.info().outputPath(`edifice-squalid-asked-${size}.png`)
            })
            await answers[0].click()
            await openHistory(page)
            await expect(history(page)).toContainText('lowered the end die to 4 (Squalid District)')
            await expect(history(page)).toContainText('play goes on to round 7')
            await page.screenshot({
                path: test.info().outputPath(`edifice-squalid-history-${size}.png`)
            })
        })

        test('everyone else sees the End die panel: the roll and "Waiting on"', async ({
            page
        }) => {
            await openTable(page, 'squalidAsked')
            await viewOffTheClock(page)
            await expect(panel(page)).toContainText('End die')
            await expect(panel(page)).toContainText('Rolled a 5.')
            await expect(panel(page)).toContainText('Waiting on')
            await expect(panel(page)).not.toContainText('Lower to 4')
            await page.screenshot({
                path: test.info().outputPath(`edifice-squalid-waiting-${size}.png`)
            })
        })

        test('a raise that ends the game ends it for the Chancellor', async ({ page }) => {
            await openTable(page, 'squalidAsked')
            await panel(page).getByRole('button', { name: 'Raise to 6', exact: true }).click()
            await expect(page.getByText(/Dana wins|wins/).first()).toBeVisible()
            await openHistory(page)
            await expect(history(page)).toContainText('raised the end die to 6 (Squalid District)')
            await expect(history(page)).toContainText('the game ends')
        })

        test('Festival District: favor, secrets and advisers, no relic row; Use shows once the terms are complete', async ({
            page
        }) => {
            await openTable(page, 'festivalDistrict')
            await usePower(page).click()
            const row = powerRow(page, DISTRICT)
            await expect(row).toContainText('Festival District')
            await expect(row.getByRole('button', { name: /^Use/ })).toHaveCount(0)
            await row.getByRole('button', { name: /rhys/i }).first().click()
            await expect(row.locator('img[alt="Cup of Plenty"]')).toHaveCount(0)
            await page.screenshot({ path: test.info().outputPath(`edifice-festival-${size}.png`) })
        })

        test('Bandit Rampart is in its ruler’s defender plan list', async ({ page }) => {
            await openTable(page, 'banditRampartDefender')
            const row = panel(page).locator(`[data-card-row="${RAMPART}"]`)
            await expect(row).toContainText('Bandit Rampart')
            await page.screenshot({
                path: test.info().outputPath(`edifice-rampart-plans-${size}.png`)
            })
        })

        test('the bandits’ use of Bandit Rampart is a note on the Campaign row', async ({
            page
        }) => {
            await openTable(page, 'banditRampartBandits')
            await openHistory(page)
            await expect(history(page)).toContainText(
                'the bandits took 2 attack dice (Bandit Rampart)'
            )
            await page.screenshot({
                path: test.info().outputPath(`edifice-rampart-bandits-${size}.png`)
            })
        })

        test('Ruined Temple hides a beast card’s faceup plays from its ruler’s enemy', async ({
            page
        }) => {
            await openTable(page, 'ruinedTemple')
            await panel(page)
                .locator('button:not(.magnifier)')
                .filter({ has: page.locator('img[alt="Wolves"]') })
                .click()
            await expect(panel(page)).toContainText('How do you play it?')
            const plays = panel(page)
            await expect(plays.getByRole('button', { name: /Adviser, facedown/ })).toBeVisible()
            await expect(plays.getByRole('button', { name: /^Discard/ })).toBeVisible()
            await expect(plays.getByRole('button', { name: /To your site/ })).toHaveCount(0)
            await expect(plays.getByRole('button', { name: /Adviser, faceup/ })).toHaveCount(0)
            await page.screenshot({ path: test.info().outputPath(`edifice-temple-${size}.png`) })
        })

        test('Forest Temple forbids nothing: the faceup plays are there', async ({ page }) => {
            await openTable(page, 'forestTempleSearch')
            await panel(page)
                .locator('button:not(.magnifier)')
                .filter({ has: page.locator('img[alt="Wolves"]') })
                .click()
            await expect(panel(page).getByRole('button', { name: /To your site/ })).toBeVisible()
            await expect(panel(page).getByRole('button', { name: /Adviser, faceup/ })).toBeVisible()
        })
    })
}
