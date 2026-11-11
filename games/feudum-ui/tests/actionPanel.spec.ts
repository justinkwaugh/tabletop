import { expect, test, type Locator, type Page } from '@playwright/test'
import { createGame, playToCards, playToHands, playToPawn, settled, shot } from './helpers.js'

/**
 * A real hotseat game: the panel's rows, faces and lines as a seat presses them. The session specs
 * prove what each says at every moment; this proves they draw, take the press and light the board.
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
const lit = (page: Page) => page.locator('[data-pick-role="lit"]')
const bright = (page: Page) => page.locator('[data-bright]')
const enlarged = (page: Page) => page.locator('[data-enlarged]')
const primary = (page: Page) => panel(page).locator('[data-primary]')
const row = (page: Page, label: string) => panel(page).locator(`[data-row="${label}"]`)

async function rowBy(page: Page, block: string, label: RegExp): Promise<Locator> {
    return panel(page).locator(`[data-rows="${block}"] button`).filter({ hasText: label }).first()
}

test('S1 R-1.4.8 the goods are rows with their tokens, and the sulfur asks beside itself', async ({
    page
}) => {
    await createGame(page)
    await expect(panel(page).locator('[data-rows="goods"] [data-row]')).toHaveCount(5)
    await expect(panel(page).locator('[data-rows="goods"] svg[aria-label="iron"]')).toBeVisible()
    await (await rowBy(page, 'goods', /^\s*(saltpeter)?\s*Saltpeter/i)).click()
    await (await rowBy(page, 'goods', /Sulfur/)).click()
    const asked = panel(page).locator('[data-row-popup]')
    await expect(asked.getByRole('button', { name: 'To supply', exact: true })).toBeVisible()
    await (await rowBy(page, 'goods', /Food/)).click()
    await shot(page, 'goods-sulfur-asks')
    await expect(primary(page)).toBeDisabled()
    await asked.getByRole('button', { name: 'To barrel', exact: true }).click()
    await expect(primary(page)).toHaveText('Take saltpeter, sulfur (barrel), food')
    await shot(page, 'goods-all-three')
    await primary(page).click()
    await settled(page)
    await expect(panel(page).locator('[data-rows="goods"] [data-row]')).toHaveCount(5)
})

test('S2 R-1.4.9 the characters stand as guild dice, their rows light the spaces on hover', async ({
    page
}) => {
    await createGame(page)
    await playToPawn(page)
    const characters = panel(page).locator('[data-rows="characters"] [data-row]')
    await expect(characters).toHaveCount(6)
    await expect(characters.first().locator('[data-die] svg')).toBeVisible()
    await expect(characters.first().locator('[data-badge]')).toBeVisible()
    await characters.first().locator('button').first().hover()
    await expect.poll(() => bright(page).count()).toBeGreaterThan(0)
    await shot(page, 'characters-hover')
    await page.mouse.move(1, 1)
    await expect(bright(page)).toHaveCount(0)
    await characters.first().locator('button').first().click()
    await settled(page)
    await expect.poll(() => lit(page).count()).toBeGreaterThan(0)
    await shot(page, 'character-picked')
})

test('S4 to S8 R-3.1 the finalise row, the eleven faces, the pouch and the send', async ({
    page
}) => {
    await createGame(page)
    await playToHands(page)
    const seats = panel(page).locator('[data-finalise-seat]')
    await expect(seats.first()).toBeVisible()
    const count = await seats.count()
    expect(count).toBeGreaterThan(1)

    const faces = panel(page).locator('[data-cards="draft"] [data-row]')
    await expect(faces).toHaveCount(11)
    const tops = await faces.evaluateAll((cells) =>
        cells.map((cell) => Math.round(cell.getBoundingClientRect().top))
    )
    expect(new Set(tops).size).toBe(2)
    expect(tops.filter((top) => top === tops[0])).toHaveLength(6)
    await expect(panel(page).locator('[data-hand-count]')).toHaveText('0 of 4')
    await shot(page, 'draft-empty')

    await faces.first().locator('[data-enlarge]').click()
    await expect(enlarged(page)).toBeVisible()
    await shot(page, 'draft-enlarged')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)
    await expect(panel(page).locator('[data-hand-count]')).toHaveText('0 of 4')

    for (const index of [0, 1, 2, 3]) {
        await faces.nth(index).locator('button').first().click()
    }
    await expect(panel(page).locator('[data-hand-count]')).toHaveText('4 of 4')
    await shot(page, 'draft-four-picked')

    await expect(primary(page)).toHaveText("Long live the king · can't be undone")
    await primary(page).click()
    await settled(page)
    await expect(panel(page).locator('[data-finalise-seat][data-finalised]')).toHaveCount(1)
    await expect(panel(page).locator('[data-hand-count]')).toHaveText('0 of 4')
    await shot(page, 'draft-next-seat')
})

test('S5 R-3.1 a dimmed pouch good gives its reason on the press', async ({ page }) => {
    await createGame(page)
    await playToHands(page)
    const dimmed = panel(page).locator('[data-rows="pouch"] button[aria-disabled="true"]')
    await expect(dimmed.first()).toBeVisible()
    // It only looks disabled: it takes the press, to say why.
    await dimmed.first().click({ force: true })
    await expect(panel(page).locator('[data-rows="pouch"] [data-refusal]')).toBeVisible()
    await shot(page, 'pouch-refused')
})

test('S9 S10 S10a S12 R-3.3 the hand is a row of faces; a Move shows its rows, a Forfeit and the toggle', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    const faces = panel(page).locator('[data-cards="hand"] [data-row]')
    await expect(faces.first()).toBeVisible()
    const tops = await faces.evaluateAll((cells) =>
        cells.map((cell) => Math.round(cell.getBoundingClientRect().top))
    )
    expect(new Set(tops).size).toBe(1)
    await expect(panel(page).locator('[data-turn-line]')).toBeVisible()
    await shot(page, 'hand-faces')

    const move = row(page, 'Move')
    await move.locator('button').first().hover()
    await expect.poll(() => bright(page).count()).toBeGreaterThan(0)
    await page.mouse.move(1, 1)
    await move.locator('button').first().click()
    await settled(page)
    await expect(panel(page).getByRole('button', { name: 'Forfeit', exact: true })).toBeVisible()
    await expect(panel(page).locator('[data-flow-line]')).toBeVisible()
    await expect(move.locator('button').first()).toHaveAttribute('aria-pressed', 'true')

    // R-3.2 The modes stand in a tray right of the picked card, on its line, Forfeit last.
    const tray = panel(page).locator('[data-card-tray="Move"]')
    await expect(tray).toBeVisible()
    const face = await move.locator('button.face').boundingBox()
    const box = await tray.boundingBox()
    expect(face && box).toBeTruthy()
    expect(box!.x).toBeGreaterThanOrEqual(face!.x + face!.width)
    expect(box!.y).toBeLessThan(face!.y + face!.height)
    await expect(tray.getByRole('button').last()).toHaveText('Forfeit')
    await shot(page, 'move-picked')
})

/** Every seat drafts the same four; the seat that opens the round comes back. */
async function draftForExplore(page: Page) {
    await playToHands(page)
    await page.evaluate(async () => {
        const session = window.feudumSession
        while (session.handPanel?.drafting) {
            for (const kind of ['influence', 'explore', 'move', 'tax'] as const) {
                session.toggleHandCard(kind)
            }
            await session.finaliseHand()
            await new Promise((resolve) => setTimeout(resolve, 300))
        }
    })
    await expect
        .poll(() => page.evaluate(() => window.feudumSession.gameState.machineState))
        .toBe('PlayingCards')
    return page.evaluate(() => window.feudumSession.myPlayerId)
}

/** The other seats give up a card each until the table comes back to this one. */
async function passBackTo(page: Page, playerId: string | undefined) {
    for (let turns = 0; turns < 8; turns++) {
        const here = await page.evaluate(() => window.feudumSession.myPlayerId)
        if (here === playerId) {
            return
        }
        await panel(page).locator('[data-cards="hand"] [data-row] button').first().click()
        await panel(page).getByRole('button', { name: 'Forfeit', exact: true }).click()
        await settled(page)
    }
}

test('S18 R-3.10 a real Explore: its name, the drawn faces, the keep', async ({ page }) => {
    await createGame(page)
    const explorer = await draftForExplore(page)

    await row(page, 'Move').locator('button').first().click()
    await settled(page)
    const outpost = await page.evaluate(() => {
        const session = window.feudumSession
        const outposts = Object.entries(session.gameState.spaces)
            .filter(([, { location }]) => location.kind === 'outpost')
            .map(([id]) => `space:${id}`)
        return [...session.boardOffer.targets.keys()].find((target) => outposts.includes(target))
    })
    expect(outpost).toBeDefined()
    await page.locator(`[data-pick="${outpost}"] [role="button"]`).first().click()
    await settled(page)
    await panel(page).getByRole('button', { name: 'No pilfer', exact: true }).click()
    await primary(page).click()
    await settled(page)
    await passBackTo(page, explorer)

    await row(page, 'Influence').locator('button').first().click()
    await settled(page)
    await shot(page, 'influence-picked')
    await primary(page).click()
    await settled(page)
    await passBackTo(page, explorer)

    await row(page, 'Explore').locator('button').first().click()
    await settled(page)
    await expect(primary(page)).toContainText("can't be undone")
    await shot(page, 'explore-staged')
    await primary(page).click()
    await settled(page)
    const writs = panel(page).locator('[data-writs] [data-row]')
    await expect(writs.first()).toBeVisible()
    await shot(page, 'keep-writs')
    await writs.first().locator('button').first().click()
    await settled(page)
    await expect(primary(page).first()).toContainText('Keep')
    await shot(page, 'keep-picked')
})

test.describe('at phone width with no hover', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

    test('S9 a card has no preview button: its press is undoable and itself the preview', async ({
        page
    }) => {
        await createGame(page)
        await playToCards(page)
        await expect(panel(page).locator('[data-preview="Move"]')).toBeHidden()
        const card = row(page, 'Move').locator('button').first()
        await card.tap()
        await expect(card).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(() => page.locator('[data-pick-role="lit"]').count()).toBeGreaterThan(0)
        await shot(page, 'phone-hand-preview')
    })
})
