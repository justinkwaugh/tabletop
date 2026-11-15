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

const ENVOY = 'denizen.nomad.special-envoy'
const PLAYMATES = 'denizen.beast.animal-playmates'
const PRESSGANGS = 'denizen.order.pressgangs'
const BLOOD_PACT = 'denizen.arcane.blood-pact'
const ORACLE = 'denizen.nomad.oracle'
const WHISTLE = 'relic.whistle'
const SCEPTER = 'relic.grand-scepter'
const GARRISON = 'denizen.order.garrison'
const BOOK_BINDERS = 'denizen.hearth.book-binders'
const ROUND_OF_ALE = 'denizen.hearth.a-round-of-ale'

const panel = (page: Page) => page.locator('.panel')
const bar = (page: Page) => panel(page).locator('.bg-oath-accent-soft').first()
const badge = (page: Page, cardId: string) => page.locator(`[data-use-badge="${cardId}"]`)
const badges = (page: Page) => page.locator('[data-use-badge]')
const tag = (page: Page) => page.locator('[data-seat-use-tag]')
const seat = (page: Page, playerId: string) => page.locator(`[data-seat="${playerId}"]`)
const tile = (page: Page, label: string) =>
    panel(page).locator('.majors button').filter({ hasText: label })
const cardToggle = (page: Page, cardId: string) =>
    panel(page).locator(`[data-card-row="${cardId}"] button[aria-pressed]`)
const undoButton = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })

async function box(locator: Locator) {
    const found = await locator.boundingBox()
    expect(found).not.toBeNull()
    return found ?? { x: 0, y: 0, width: 0, height: 0 }
}

/** Waits until the element stands still: the map and the seat row glide to their frames. */
async function still(locator: Locator) {
    let last = ''
    await expect
        .poll(async () => {
            const now = JSON.stringify(await locator.boundingBox())
            const same = now === last
            last = now
            return same
        })
        .toBe(true)
}

/** On a phone the map is framed on the region named, as a pan would. */
async function frame(page: Page, region: string) {
    await page
        .locator('.chooser__view', { hasText: region })
        .evaluate((view) => view instanceof HTMLElement && view.click())
    await still(page.locator('.board-card').first())
}

/** On a phone the seats sit off the screen's left edge: the tag slides them in. */
async function seatsIn(page: Page, phone: boolean) {
    if (!phone) return
    await expect(tag(page)).toBeVisible()
    await tag(page).click()
    await expect(tag(page)).toHaveCount(0)
}

for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    const phone = viewport.width < 640
    test.describe(`a Use on every card the seat can use now, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        test('Special Envoy wears a Use beside Blood Pact; Animal Playmates, with no beast here, and the other seats’ cards wear none; there is no "Use a power" chip', async ({
            page
        }) => {
            await openTable(page, 'useOnEveryCard')
            await expect(badges(page)).toHaveCount(2)
            await expect(badge(page, BLOOD_PACT)).toHaveCount(1)
            await expect(badge(page, ENVOY)).toHaveCount(1)
            await expect(badge(page, ENVOY)).toHaveAccessibleName('Use Special Envoy')
            await expect(badge(page, ENVOY)).toHaveText('Use')
            for (const cardId of [PLAYMATES, GARRISON, BOOK_BINDERS, SCEPTER, ROUND_OF_ALE]) {
                await expect(badge(page, cardId)).toHaveCount(0)
            }
            await expect(seat(page, 'Dana').locator('[data-use-badge]')).toHaveCount(1)
            await expect(
                panel(page).getByRole('button', { name: 'Use a power', exact: true })
            ).toHaveCount(0)
            await expect(tile(page, 'Travel')).toHaveAttribute('aria-disabled', 'false')
        })

        test('every Use is 44 × 44 to tap, its face as before', async ({ page }) => {
            await openTable(page, 'useOnEveryCardBusy')
            await expect(badges(page)).toHaveCount(4)
            if (phone) await frame(page, 'Cradle')
            for (const cardId of [BLOOD_PACT, ORACLE]) {
                const area = await box(badge(page, cardId))
                expect(area.width).toBeGreaterThanOrEqual(43.5)
                expect(area.height).toBeCloseTo(44, 0)
            }
            await seatsIn(page, phone)
            for (const cardId of [ENVOY, WHISTLE]) {
                await badge(page, cardId).scrollIntoViewIfNeeded()
                const area = await box(badge(page, cardId))
                const face = await box(badge(page, cardId).locator('.use-badge__face'))
                expect(area.width).toBeGreaterThanOrEqual(43.5)
                expect(area.height).toBeCloseTo(44, 0)
                expect(face.width).toBeLessThan(area.width)
                expect(face.height).toBeLessThan(24)
            }
        })

        test('Special Envoy’s Use opens Travel with it in use; the Uses hide, and one Undo returns to the grid', async ({
            page
        }) => {
            await openTable(page, 'useOnEveryCard')
            await seatsIn(page, phone)
            await badge(page, ENVOY).click()
            await expect(bar(page)).toHaveText('Tap a lit site.')
            await expect(cardToggle(page, ENVOY)).toHaveAttribute('aria-pressed', 'true')
            await expect(badges(page)).toHaveCount(0)
            await expect(tag(page)).toHaveCount(0)

            // Its row puts it down.
            await cardToggle(page, ENVOY).click()
            await expect(cardToggle(page, ENVOY)).toHaveAttribute('aria-pressed', 'false')

            await undoButton(page).click()
            await expect(panel(page).locator('.majors')).toBeVisible()
            await expect(badges(page)).toHaveCount(2)
        })

        test('Blood Pact’s Use opens its power with the card named in the bar', async ({
            page
        }) => {
            await openTable(page, 'useOnEveryCard')
            if (phone) await frame(page, 'Cradle')
            await badge(page, BLOOD_PACT).click()
            await expect(bar(page)).toHaveText('Blood Pact')
            await expect(panel(page).locator(`[data-action-power="${BLOOD_PACT}"]`)).toBeVisible()
            await expect(panel(page).locator('[data-action-power]')).toHaveCount(1)
            await expect(badges(page)).toHaveCount(0)
            await undoButton(page).click()
            await expect(badges(page)).toHaveCount(2)
        })

        test('on Rhys’s turn the Use follows them: the Grand Scepter’s Use opens a choice of its two uses, 44 px tall and one width', async ({
            page
        }) => {
            await openTable(page, 'useOnEveryCardScepter')
            await expect(badge(page, SCEPTER)).toHaveCount(1)
            await expect(badge(page, ENVOY)).toHaveCount(0)
            await expect(badge(page, BLOOD_PACT)).toHaveCount(0)
            // The chips stay.
            for (const name of ['Offer Citizenship', 'Exile Citizen']) {
                await expect(
                    panel(page).locator('.minors').getByRole('button', { name, exact: true })
                ).toHaveCount(1)
            }
            await seatsIn(page, phone)
            await badge(page, SCEPTER).click()
            await expect(bar(page)).toHaveText('The Grand Scepter')
            const choices = panel(page).locator('[data-scepter-choice] button')
            await expect(choices).toHaveText(['Offer Citizenship', 'Exile Citizen'])
            const [offer, exile] = [await box(choices.nth(0)), await box(choices.nth(1))]
            expect(offer.height).toBeCloseTo(44, 0)
            expect(exile.height).toBeCloseTo(44, 0)
            expect(Math.abs(offer.width - exile.width)).toBeLessThanOrEqual(1)
            await expect(badges(page)).toHaveCount(0)

            await choices.nth(1).click()
            await expect(bar(page)).toHaveText('Exile Citizen')
            await undoButton(page).click()
            await expect(panel(page).locator('.majors')).toBeVisible()
            await expect(badge(page, SCEPTER)).toHaveCount(1)
        })

        test('a pair wears a Use on both cards; a tapped Muster rings both, read with its reason; either opens Muster with both in use', async ({
            page
        }) => {
            await openTable(page, 'useOnEveryCardPair')
            await expect(badges(page)).toHaveCount(2)
            await expect(badge(page, PLAYMATES)).toHaveCount(1)
            await expect(badge(page, PRESSGANGS)).toHaveCount(1)

            await tile(page, 'Muster').click({ force: true })
            const reason = panel(page).locator('.strip .text-oath-danger')
            await expect(reason).toHaveText('Needs 1 Supply; you have 0.')
            for (const cardId of [PLAYMATES, PRESSGANGS]) {
                await expect(badge(page, cardId)).toHaveClass(/use-badge--ring/)
                await expect(badge(page, cardId)).toHaveAccessibleDescription(
                    'Needs 1 Supply; you have 0.'
                )
            }
            if (phone) {
                await expect(tag(page)).toHaveClass(/seat-use-tag--ring/)
                await expect(tag(page)).toHaveAccessibleDescription('Needs 1 Supply; you have 0.')
            }
            // Another tile clears the ring with the reason.
            await tile(page, 'Travel').click({ force: true })
            await expect(badge(page, PLAYMATES)).not.toHaveClass(/use-badge--ring/)

            await seatsIn(page, phone)
            for (const cardId of [PRESSGANGS, PLAYMATES]) {
                await badge(page, cardId).click()
                await expect(bar(page)).toHaveText('Muster')
                for (const inUse of [PLAYMATES, PRESSGANGS]) {
                    await expect(cardToggle(page, inUse)).toHaveAttribute('aria-pressed', 'true')
                }
                // Neither can be put down.
                await cardToggle(page, cardId).click()
                await expect(cardToggle(page, cardId)).toHaveAttribute('aria-pressed', 'true')
                await undoButton(page).click()
                await expect(badges(page)).toHaveCount(2)
            }
        })
    })
}

test.describe('the seat’s "Use" tag, at 375 × 812', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('one tag on the screen’s edge stands for the seat’s Uses; a tap slides the seat in', async ({
        page
    }) => {
        await openTable(page, 'useOnEveryCardBusy')
        await expect(tag(page)).toBeVisible()
        await expect(tag(page)).toHaveCount(1)
        await expect(tag(page)).toHaveAccessibleName('Your cards')
        const area = await box(tag(page))
        expect(area.x).toBeCloseTo(0, 0)
        expect(area.width).toBeCloseTo(44, 0)
        expect(area.height).toBeCloseTo(44, 0)

        await tag(page).click()
        await expect(tag(page)).toHaveCount(0)
        const dana = seat(page, 'Dana')
        await still(dana)
        const where = await box(dana)
        expect(where.x).toBeGreaterThanOrEqual(-0.5)
        await expect(badge(page, ENVOY)).toBeInViewport()
        await expect(badge(page, WHISTLE)).toBeInViewport()
    })

    test('the tag comes back when the Players tab is opened again after another tab', async ({
        page
    }) => {
        await openTable(page, 'useOnEveryCardBusy')
        await expect(tag(page)).toBeVisible()
        // The tabs sit above the seats: tapping one brings the seats on screen.
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(seat(page, 'Dana')).toHaveCount(0)
        await page.getByRole('tab', { name: 'Players' }).click()
        await expect(seat(page, 'Dana')).toHaveCount(1)
        await expect(tag(page)).toHaveCount(0)
        // Swiped back to the board, the seat is off screen again.
        await page
            .locator('.table-scroller')
            .evaluate((scroller) => scroller.scrollTo({ left: scroller.scrollWidth }))
        await expect(tag(page)).toBeVisible()
        await tag(page).click()
        await expect(tag(page)).toHaveCount(0)
        await still(seat(page, 'Dana'))
        expect((await box(seat(page, 'Dana'))).x).toBeGreaterThanOrEqual(-0.5)
    })

    test('no tag while none of the seat’s own cards has a Use', async ({ page }) => {
        await openTable(page, 'useOnEveryCardScepter')
        await expect(badge(page, SCEPTER)).toHaveCount(1)
        await expect(tag(page)).toBeVisible()
        await openTable(page, 'useBadgeTribunal')
        await expect(badges(page)).toHaveCount(1)
        await expect(tag(page)).toHaveCount(0)
    })
})

test('at 1280 the seats are on screen, so there is no tag', async ({ page }) => {
    await openTable(page, 'useOnEveryCardBusy')
    await expect(badges(page)).toHaveCount(4)
    await expect(tag(page)).toHaveCount(0)
})
