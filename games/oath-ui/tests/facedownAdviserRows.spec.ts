import { expect, test, type Locator, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

type Fixture = typeof TableFixture

async function call<K extends keyof Fixture>(
    page: Page,
    name: K,
    ...args: Parameters<Fixture[K]>
): Promise<Awaited<ReturnType<Fixture[K]>>> {
    return page.evaluate(
        async ({ name, args }) => {
            const fixture = await import(
                new URL('/src/lib/testing/tableFixture.ts', location.href).href
            )
            return fixture[name](...args)
        },
        { name, args }
    )
}

const DREAM_THIEF = 'denizen.arcane.dream-thief'
const INQUISITOR = 'denizen.arcane.inquisitor'
const IVORY_EYE = 'relic.ivory-eye'

const panel = (page: Page) => page.locator('.panel')
const usePower = (page: Page) =>
    panel(page).getByRole('button', { name: 'Use a power', exact: true })
const power = (page: Page, cardId: string) => panel(page).locator(`[data-action-power="${cardId}"]`)
/** The power's picks: everything beside its own card. */
const picker = (page: Page, cardId: string) => power(page, cardId).locator(':scope > div.grow')
const pickCards = (page: Page, cardId: string) =>
    picker(page, cardId).locator('button[aria-pressed]')
const pickCard = (page: Page, cardId: string, name: string) =>
    picker(page, cardId).getByRole('button', { name, exact: true })
const seatRows = (page: Page, cardId: string) => picker(page, cardId).locator('[data-seat-row]')
const magnifiers = (page: Page, cardId: string) => picker(page, cardId).locator('button.magnifier')
const useButton = (page: Page, cardId: string) =>
    picker(page, cardId).getByRole('button', { name: /^Use/ })
const redLines = (page: Page, cardId: string) => picker(page, cardId).locator('.text-oath-danger')
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })

async function openPicker(page: Page, name: TableFixture.TableName, cardId: string) {
    await page.goto('/')
    await call(page, 'open', name)
    await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
    await usePower(page).click()
    await expect(power(page, cardId)).toBeVisible()
}

async function layoutSize(locator: Locator) {
    return locator.evaluate((element) =>
        element instanceof HTMLElement
            ? { width: element.offsetWidth, height: element.offsetHeight }
            : { width: 0, height: 0 }
    )
}

/** Each seat row: its chip's words, then each card's name (a face's card name, a back's label). */
async function rowsOf(page: Page, cardId: string) {
    return seatRows(page, cardId).evaluateAll((rows) =>
        rows.map((row) => {
            // innerText, as drawn: the viewer's own chip prints "you", capitalised.
            const chip = row.querySelector('[data-seat-chip]')
            return {
                chip: chip instanceof HTMLElement ? chip.innerText.trim() : undefined,
                cards: [...row.querySelectorAll('button[aria-pressed] img')].map((img) =>
                    img.getAttribute('alt')
                )
            }
        })
    )
}

async function pressed(page: Page, cardId: string) {
    return pickCards(page, cardId).evaluateAll((buttons) =>
        buttons
            .filter((b) => b.getAttribute('aria-pressed') === 'true')
            .map((b) => b.querySelector('img')?.getAttribute('alt'))
    )
}

async function overflow(page: Page) {
    return {
        page: await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        ),
        panel: await page.evaluate(() =>
            Math.max(
                0,
                ...[...document.querySelectorAll('.panel')].map(
                    (element) => element.scrollWidth - element.clientWidth
                )
            )
        )
    }
}

async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    await page.waitForTimeout(300)
    await page.screenshot({
        path: test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`)
    })
}

const DANA_VIEW = [
    { chip: 'You', cards: ['Tutor', 'Herald'] },
    { chip: 'Rhys', cards: ['Captains', "Rhys's facedown adviser 2"] },
    { chip: 'Mara', cards: ["Mara's facedown adviser 1"] }
]

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

for (const { name, viewport, phone } of SIZES) {
    /**
     * R-9.4 — Dana's Act Phase: Dana rules Dream Thief beside Tutor and Herald, facedown; Rhys holds
     * Captains (which Rhys let Dana peek at) and a Vision, facedown; Mara holds one facedown.
     */
    test.describe(`facedown advisers as a row per seat, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test("Dream Thief: one area, a row per seat, faces only where Dana's view names them", async ({
            page
        }) => {
            await openPicker(page, 'facedownDreamThief', DREAM_THIEF)
            await expect(picker(page, DREAM_THIEF)).toContainText('two facedown advisers:')
            await expect(picker(page, DREAM_THIEF)).not.toContainText('a facedown adviser:')
            await expect(picker(page, DREAM_THIEF)).not.toContainText('another facedown adviser:')
            expect(await rowsOf(page, DREAM_THIEF)).toEqual(DANA_VIEW)
            await expect(pickCards(page, DREAM_THIEF)).toHaveCount(5)
            // A magnifier on each face, none on a back.
            expect(
                await magnifiers(page, DREAM_THIEF).evaluateAll((all) =>
                    all.map((m) => m.getAttribute('aria-label'))
                )
            ).toEqual(['Enlarge Tutor', 'Enlarge Herald', 'Enlarge Captains'])
            await expect(useButton(page, DREAM_THIEF)).toHaveCount(0)
            await expect(redLines(page, DREAM_THIEF)).toHaveCount(0)
            if (phone) {
                for (const card of await pickCards(page, DREAM_THIEF).all()) {
                    const size = await layoutSize(card)
                    expect(size.width).toBeGreaterThanOrEqual(44)
                    expect(size.height).toBeGreaterThanOrEqual(44)
                }
            }
            expect(await overflow(page)).toEqual({ page: 0, panel: 0 })
            await shot(page, 'dream-thief-none', phone)
        })

        test('a tap fills the first empty pick, a picked card is let go, and one card is never both', async ({
            page
        }) => {
            await openPicker(page, 'facedownDreamThief', DREAM_THIEF)
            await pickCard(page, DREAM_THIEF, 'Tutor').click()
            expect(await pressed(page, DREAM_THIEF)).toEqual(['Tutor'])
            await expect(useButton(page, DREAM_THIEF)).toHaveCount(0)
            await shot(page, 'dream-thief-one', phone)
            // A second tap on it lets it go: it is never also the other pick.
            await pickCard(page, DREAM_THIEF, 'Tutor').click()
            expect(await pressed(page, DREAM_THIEF)).toEqual([])
            await expect(redLines(page, DREAM_THIEF)).toHaveCount(0)

            await pickCard(page, DREAM_THIEF, 'Tutor').click()
            await pickCard(page, DREAM_THIEF, "Mara's facedown adviser 1").click()
            expect(await pressed(page, DREAM_THIEF)).toEqual(['Tutor', "Mara's facedown adviser 1"])
            await expect(useButton(page, DREAM_THIEF)).toHaveText(/^Use\s*·\s*2/)
            await expect(redLines(page, DREAM_THIEF)).toHaveCount(0)
            if (phone) expect((await layoutSize(useButton(page, DREAM_THIEF))).height).toBe(44)
            expect(await overflow(page)).toEqual({ page: 0, panel: 0 })
            await shot(page, 'dream-thief-two', phone)

            // Both made: a third card changes nothing.
            await pickCard(page, DREAM_THIEF, 'Herald').click()
            expect(await pressed(page, DREAM_THIEF)).toEqual(['Tutor', "Mara's facedown adviser 1"])
            // The first let go, the second stays picked and becomes the first.
            await pickCard(page, DREAM_THIEF, 'Tutor').click()
            expect(await pressed(page, DREAM_THIEF)).toEqual(["Mara's facedown adviser 1"])
            await expect(useButton(page, DREAM_THIEF)).toHaveCount(0)
            await pickCard(page, DREAM_THIEF, 'Herald').click()
            expect(await pressed(page, DREAM_THIEF)).toEqual([
                'Herald',
                "Mara's facedown adviser 1"
            ])
            await expect(useButton(page, DREAM_THIEF)).toHaveCount(1)
        })

        test('two of one seat’s facedown advisers are a pick Use takes', async ({ page }) => {
            await openPicker(page, 'facedownDreamThief', DREAM_THIEF)
            await pickCard(page, DREAM_THIEF, 'Captains').click()
            await pickCard(page, DREAM_THIEF, "Rhys's facedown adviser 2").click()
            await expect(useButton(page, DREAM_THIEF)).toHaveText(/^Use\s*·\s*2/)
            await expect(redLines(page, DREAM_THIEF)).toHaveCount(0)
            await shot(page, 'dream-thief-same-seat', phone)
            // The engine takes it: the cost is placed and nothing moves, so nothing was shown to undo.
            await useButton(page, DREAM_THIEF).click()
            await expect(power(page, DREAM_THIEF)).toHaveCount(0)
            await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.Dana).toBe(1)
            await expect(undo(page)).toBeEnabled()
        })

        test('opened from Dream Thief’s Use badge: the same rows, its power alone', async ({
            page
        }) => {
            test.skip(phone, 'the seat with the badge is off the side of a phone screen')
            await page.goto('/')
            await call(page, 'open', 'facedownDreamThief')
            await page.locator(`[data-use-badge="${DREAM_THIEF}"]`).click()
            await expect(panel(page).locator('[data-action-power]')).toHaveCount(1)
            expect(await rowsOf(page, DREAM_THIEF)).toEqual(DANA_VIEW)
            await expect(picker(page, DREAM_THIEF)).toContainText('two facedown advisers:')
        })

        test('a swap used: the cost placed, and no Undo of the cards it showed', async ({
            page
        }) => {
            await openPicker(page, 'facedownDreamThief', DREAM_THIEF)
            await pickCard(page, DREAM_THIEF, 'Tutor').click()
            await pickCard(page, DREAM_THIEF, "Mara's facedown adviser 1").click()
            await useButton(page, DREAM_THIEF).click()
            await expect(power(page, DREAM_THIEF)).toHaveCount(0)
            await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.Dana).toBe(1)
            await expect(undo(page)).toHaveCount(0)
        })

        test('Undo takes back one tap at a time, and the picks before Use', async ({ page }) => {
            await openPicker(page, 'facedownDreamThief', DREAM_THIEF)
            await pickCard(page, DREAM_THIEF, 'Herald').click()
            await pickCard(page, DREAM_THIEF, 'Captains').click()
            await pickCard(page, DREAM_THIEF, 'Herald').click()
            expect(await pressed(page, DREAM_THIEF)).toEqual(['Captains'])
            await undo(page).click()
            expect(await pressed(page, DREAM_THIEF)).toEqual(['Herald', 'Captains'])
            await undo(page).click()
            expect(await pressed(page, DREAM_THIEF)).toEqual(['Herald'])
            await undo(page).click()
            expect(await pressed(page, DREAM_THIEF)).toEqual([])
        })

        test("Inquisitor: the same rows, never Dana's own", async ({ page }) => {
            await openPicker(page, 'facedownInquisitor', INQUISITOR)
            await expect(picker(page, INQUISITOR)).toContainText(
                'a facedown adviser of a player at your site:'
            )
            expect(await rowsOf(page, INQUISITOR)).toEqual(DANA_VIEW.slice(1))
            expect(
                await magnifiers(page, INQUISITOR).evaluateAll((all) =>
                    all.map((m) => m.getAttribute('aria-label'))
                )
            ).toEqual(['Enlarge Captains'])
            await shot(page, 'inquisitor-none', phone)
            await pickCard(page, INQUISITOR, "Mara's facedown adviser 1").click()
            expect(await pressed(page, INQUISITOR)).toEqual(["Mara's facedown adviser 1"])
            await expect(useButton(page, INQUISITOR)).toHaveText(/^Use\s*·\s*1/)
            if (phone) expect((await layoutSize(useButton(page, INQUISITOR))).height).toBe(44)
            expect(await overflow(page)).toEqual({ page: 0, panel: 0 })
            await shot(page, 'inquisitor-one', phone)
        })

        test('the Ivory Eye: the same rows, Dana’s own included; no red line before a pick', async ({
            page
        }) => {
            await openPicker(page, 'facedownIvoryEye', IVORY_EYE)
            await expect(picker(page, IVORY_EYE)).toContainText('a facedown adviser:')
            expect(await rowsOf(page, IVORY_EYE)).toEqual(DANA_VIEW)
            await expect(redLines(page, IVORY_EYE)).toHaveCount(0)
            await expect(useButton(page, IVORY_EYE)).toHaveCount(0)
            expect(await overflow(page)).toEqual({ page: 0, panel: 0 })
            await shot(page, 'ivory-eye-none', phone)
            await pickCard(page, IVORY_EYE, "Rhys's facedown adviser 2").click()
            await expect(useButton(page, IVORY_EYE)).toHaveCount(1)
            await expect(redLines(page, IVORY_EYE)).toHaveCount(0)
            await pickCard(page, IVORY_EYE, "Rhys's facedown adviser 2").click()
            await expect(useButton(page, IVORY_EYE)).toHaveCount(0)
            await expect(redLines(page, IVORY_EYE)).toHaveCount(0)
        })
    })
}
