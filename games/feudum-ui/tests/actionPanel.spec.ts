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

/** Contract, Hand selection: a desk's draft, the eleven beside tray A, stays under about 350 px. */
const DeskDraftHeight = 350
const lit = (page: Page) => page.locator('[data-pick-role="lit"]')
const bright = (page: Page) => page.locator('[data-bright]')
const enlarged = (page: Page) => page.locator('[data-enlarged]')
const primary = (page: Page) => panel(page).locator('[data-primary]')
const row = (page: Page, label: string) => panel(page).locator(`[data-row="${label}"]`)

async function rowBy(page: Page, block: string, label: RegExp): Promise<Locator> {
    return panel(page)
        .locator(`[data-rows="${block}"]`)
        .getByRole('button', { name: label })
        .first()
}

test('S1 R-1.4.8 the goods are rows with their tokens, and the sulfur asks on its own line', async ({
    page
}) => {
    await createGame(page)
    await expect(panel(page).locator('[data-rows="goods"] [data-row]')).toHaveCount(5)
    await expect(panel(page).locator('[data-rows="goods"] svg[aria-label="iron"]')).toBeVisible()
    await (await rowBy(page, 'goods', /^\s*(saltpeter)?\s*Saltpeter/i)).click()
    await (await rowBy(page, 'goods', /Sulfur/)).click()
    const asked = panel(page).locator('[data-rows="sulfur"]')
    await expect(asked.getByRole('button', { name: 'Keep the sulfur', exact: true })).toBeVisible()
    await (await rowBy(page, 'goods', /Food/)).click()
    await shot(page, 'goods-sulfur-asks')
    await expect(primary(page)).toHaveText('Take saltpeter, sulfur, food')
    await asked.getByRole('button', { name: 'Put the sulfur into the barrel', exact: true }).click()
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

    await expect(primary(page)).toHaveAccessibleName(
        "Long live the king · finalise · can't be undone"
    )
    await expect(primary(page).locator('[data-primary-label]')).toHaveText('Long live the king')
    await primary(page).click()
    await settled(page)
    await expect(panel(page).locator('[data-finalise-seat][data-finalised]')).toHaveCount(1)
    await expect(panel(page).locator('[data-hand-count]')).toHaveText('0 of 4')
    await shot(page, 'draft-next-seat')
})

test('S5 R-3.3 a dimmed pouch choice says why in place of what it does, once', async ({ page }) => {
    await createGame(page)
    await playToHands(page)
    const dimmed = panel(page).locator('[data-rows="pouch"] button[aria-disabled="true"]')
    await expect(dimmed.first()).toBeVisible()
    await expect(dimmed.first().locator('[data-pouch-caption]')).toHaveText(/^You hold no /)
    // It only looks disabled: it takes the press, and says nothing more.
    await dimmed.first().click({ force: true })
    await expect(panel(page).locator('[data-rows="pouch"] [data-refusal]')).toHaveCount(0)
    // A desk says why in the caption's place, so the phone's line under the pair stays hidden.
    await expect(panel(page).locator('[data-pouch-reason]')).toBeHidden()
    await shot(page, 'pouch-refused')
})

test('R-3.1 the plan: a press fills the next slot and numbers the card; the slot or the card takes it back', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await createGame(page)
    await playToHands(page)
    const faces = panel(page).locator('[data-cards="draft"] [data-row]')
    const slots = panel(page).locator('[data-plan] [data-slot]')
    await expect(slots).toHaveCount(4)
    await expect(panel(page).locator('[data-plan] [role="list"]')).toHaveAccessibleName(
        'Your hand · play in any order'
    )
    await expect(panel(page).locator('[data-finalise-caption]')).toContainText(
        'everyone at once · pouch goods shown when all have finalised'
    )

    await faces.nth(2).locator('button').first().click()
    await faces.nth(0).locator('button').first().click()
    const [third, first] = await Promise.all(
        [2, 0].map((index) => faces.nth(index).getAttribute('data-row'))
    )
    await expect(faces.nth(2).locator('[data-slot-badge]')).toHaveText('1')
    await expect(faces.nth(0).locator('[data-slot-badge]')).toHaveText('2')
    await expect(slots.nth(0).locator('[data-slot-card]')).toHaveAttribute(
        'data-slot-card',
        third ?? ''
    )
    await expect(slots.nth(1).locator('[data-slot-card]')).toHaveAttribute(
        'data-slot-card',
        first ?? ''
    )
    await expect(panel(page).locator('[data-hand-count]')).toHaveText('2 of 4')

    // Contract, Hand selection: tray A. Right of the eleven, one tray: the slots, the pouch under
    // them and the send under that, each as wide as the slots and on their left edge.
    const area = await panel(page).boundingBox()
    expect(area?.height ?? 0).toBeLessThanOrEqual(DeskDraftHeight)
    const box = async (locator: Locator) => {
        const found = await locator.boundingBox()
        expect(found).not.toBeNull()
        return found ?? { x: 0, y: 0, width: 0, height: 0 }
    }
    const cards = await box(panel(page).locator('[data-cards="draft"]'))
    const tray = await box(panel(page).locator('[data-hand-tray]'))
    // The heading runs the panel's width, the seats at its end, over the eleven and the tray.
    const head = await box(panel(page).locator('[data-finalise-row]'))
    const chips = await box(panel(page).locator('[data-finalise-seats]'))
    expect(Math.abs(chips.x + chips.width - (head.x + head.width))).toBeLessThan(1)
    expect(head.x + head.width).toBeGreaterThan(tray.x + tray.width)
    expect(chips.y + chips.height).toBeLessThanOrEqual(cards.y)
    const plan = await box(panel(page).locator('[data-plan] [role="list"]'))
    const pouch = await box(panel(page).locator('[data-rows="pouch"]'))
    // R-X.2 The send's row: the send appears there once the hand is picked.
    const send = await box(panel(page).locator('[data-tray-row="send"]'))
    expect(tray.x).toBeGreaterThanOrEqual(cards.x + cards.width)
    for (const part of [plan, pouch, send]) {
        expect(part.x).toBeGreaterThanOrEqual(tray.x)
        expect(part.x + part.width).toBeLessThanOrEqual(tray.x + tray.width)
    }
    expect(pouch.y).toBeGreaterThanOrEqual(plan.y + plan.height)
    expect(send.y).toBeGreaterThanOrEqual(pouch.y + pouch.height)
    for (const part of [pouch, send]) {
        expect(Math.abs(part.x - plan.x)).toBeLessThan(1)
        expect(Math.abs(part.width - plan.width)).toBeLessThan(1)
    }
    // The labels stand in their own column, level with their rows.
    const label = await box(panel(page).locator('[data-tray-label="hand"]'))
    expect(label.x + label.width).toBeLessThanOrEqual(plan.x)
    expect(label.y).toBeGreaterThanOrEqual(plan.y - 1)
    expect(label.y).toBeLessThan(plan.y + plan.height)
    const pouchLabel = await box(panel(page).locator('[data-tray-label="pouch"]'))
    expect(pouchLabel.y).toBeGreaterThanOrEqual(pouch.y - 1)
    expect(pouchLabel.y).toBeLessThan(pouch.y + pouch.height)
    // R-3.3 The two choices stack, each as wide as the slots, each with what it does beneath.
    const choices = panel(page).locator('[data-rows="pouch"] [data-pouch-choice]')
    await expect(choices).toHaveCount(2)
    const [upper, lower] = [await box(choices.nth(0)), await box(choices.nth(1))]
    expect(lower.y).toBeGreaterThanOrEqual(upper.y + upper.height)
    for (const choice of [upper, lower]) {
        expect(Math.abs(choice.x - plan.x)).toBeLessThan(1)
        expect(Math.abs(choice.width - plan.width)).toBeLessThan(1)
    }
    await expect(choices.locator('[data-pouch-caption]')).toHaveCount(2)
    await expect(choices.locator('[data-pouch-caption]').first()).toBeVisible()
    await shot(page, 'draft-two-picked')

    await slots.nth(0).locator('button').click()
    await expect(faces.nth(0).locator('[data-slot-badge]')).toHaveText('1')
    await expect(faces.nth(2).locator('[data-slot-badge]')).toHaveCount(0)
    await faces.nth(0).locator('button').first().click()
    await expect(panel(page).locator('[data-slot-card]')).toHaveCount(0)
    await expect(panel(page).locator('[data-hand-count]')).toHaveText('0 of 4')
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
