import { expect, test, type Page } from '@playwright/test'
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

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    return call(page, 'open', name)
}

async function boxOf(locator: ReturnType<Page['locator']>) {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is not drawn')
    return box
}

const panel = (page: Page) => page.locator('.panel')
const line = (page: Page) => panel(page).locator('.question-line')
const choices = (page: Page) => panel(page).getByRole('group', { name: 'Wake choices' })
const choice = (page: Page, name: string) => choices(page).getByRole('button', { name, exact: true })
const answer = (page: Page, name: string) => panel(page).getByRole('button', { name, exact: true })
const pieces = (page: Page) => panel(page).getByRole('button', { name: /^pay \d favor$/ })
const piece = (page: Page, count: number) =>
    panel(page).getByRole('button', { name: `pay ${count} favor`, exact: true })
const history = (page: Page) => page.locator('.history')

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

/** Label-sized at every width, and 44 px tall on a phone. */
async function expectLabelSized(page: Page, buttons: ReturnType<Page['locator']>, phone: boolean) {
    const width = (await boxOf(panel(page))).width
    for (const button of await buttons.all()) {
        const box = await boxOf(button)
        if (phone) expect(box.height).toBeGreaterThanOrEqual(44)
        expect(box.width).toBeLessThan(width / 2)
    }
}

for (const { name, viewport, phone } of SIZES) {
    /**
     * Vow of Kinship's Q&A at the Wake: Dana holds the People's Favor at 1, nothing on their board and
     * Nomad favor, so the place is offered with "Place none" beside it; one tap either way sends the Wake.
     */
    test.describe(`the Wake with Vow of Kinship's Nomad favor, on a ${name}`, () => {
        test.use({ viewport })

        test('"Place [favor]" and "Place none" share a width; Place sends the place from the Nomad bank', async ({ page }) => {
            await openTable(page, 'kinshipWake')
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('dana')
            await expect(panel(page)).toContainText('People’s Favor')
            await expect(choices(page).getByRole('button')).toHaveCount(2)
            await expect(choice(page, 'Place a favor')).toBeVisible()
            await expect(choice(page, 'Place a favor').locator('img[alt="favor"]')).toHaveCount(1)
            await expect(choice(page, 'Place no favor')).toHaveText('Place none')
            await expect(panel(page).getByRole('button', { name: 'End Wake Phase' })).toHaveCount(0)
            const [place, none] = [await boxOf(choice(page, 'Place a favor')), await boxOf(choice(page, 'Place no favor'))]
            expect(Math.round(place.width)).toBe(Math.round(none.width))
            await expectLabelSized(page, choices(page).getByRole('button'), phone)

            const nomad = (await call(page, 'tableFacts')).favorBank.nomad
            await choice(page, 'Place a favor').click()
            await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('ActPhase')
            expect((await call(page, 'tableFacts')).favorBank.nomad).toBe(nomad - 1)
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toContainText('began the turn; placed 1 on the People’s Favor')
            }
        })

        test('"Place none" sends the Wake with no step: the bank keeps its favor', async ({ page }) => {
            await openTable(page, 'kinshipWake')
            const nomad = (await call(page, 'tableFacts')).favorBank.nomad
            await choice(page, 'Place no favor').click()
            await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('ActPhase')
            expect((await call(page, 'tableFacts')).favorBank.nomad).toBe(nomad)
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toContainText('began the turn')
                await expect(history(page)).not.toContainText('People’s Favor')
            }
        })
    })

    /**
     * Bea used Plague Engines: Ann's and Bea's boards paid; Dana's board held nothing, so Dana is asked
     * "Pay how many [favor] from [nomad]?" about the 2 they owe.
     */
    test.describe(`Plague Engines asks the Vow of Kinship holder, on a ${name}`, () => {
        test.use({ viewport })

        test('the payable pieces, none picked: "None" alone until a piece is tapped, then "Pay"; picked pieces ringed gold', async ({ page }) => {
            await openTable(page, 'kinshipPlague')
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('dana')
            await expect(panel(page).getByRole('heading', { name: 'Plague Engines' })).toBeVisible()
            await expect(line(page)).toHaveText(/^Pay how many\s+from\s*\?$/)
            await expect(line(page).locator('img[alt="favor"]')).toHaveCount(1)
            await expect(line(page).locator('img[alt="the Nomad bank"]')).toHaveCount(1)
            await expect(pieces(page)).toHaveCount(2)
            await expect(panel(page).locator('[aria-pressed="true"]')).toHaveCount(0)
            await expect(answer(page, 'Pay')).toHaveCount(0)
            await expect(answer(page, 'None')).toBeVisible()

            await piece(page, 2).click()
            await expect(panel(page).locator('[aria-pressed="true"]')).toHaveCount(2)
            await expect(piece(page, 2)).toHaveClass(/ring-oath-accent/)
            await expect(answer(page, 'Pay')).toBeVisible()
            await expectLabelSized(page, panel(page).getByRole('button', { name: /^(Pay|None)$/ }), phone)
            await piece(page, 2).click()
            await expect(answer(page, 'Pay')).toHaveCount(0)
            await piece(page, 2).click()

            const before = (await call(page, 'tableFacts')).favorBank
            await answer(page, 'Pay').click()
            await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('ActPhase')
            const after = (await call(page, 'tableFacts')).favorBank
            expect(after.nomad).toBe(before.nomad - 2)
            expect(after.arcane).toBe(before.arcane + 2)
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toContainText('used Plague Engines, placing 1 on it and burning 1: 3 placed into')
                await expect(history(page)).toContainText('Plague Engines: paid 2 from into')
            }
        })

        test('"None" pays nothing from the Nomad bank', async ({ page }) => {
            await openTable(page, 'kinshipPlague')
            const before = (await call(page, 'tableFacts')).favorBank.nomad
            await answer(page, 'None').click()
            await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('ActPhase')
            expect((await call(page, 'tableFacts')).favorBank.nomad).toBe(before)
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toContainText('Plague Engines: paid no')
            }
        })

        test('the other seats read the card and "Waiting on <chip>."', async ({ page }) => {
            await openTable(page, 'kinshipPlague')
            expect(await call(page, 'viewOffTheClock')).toBe('bea')
            await expect(panel(page).getByRole('heading', { name: 'Plague Engines' })).toBeVisible()
            await expect(panel(page)).toContainText(/Waiting on\s+dana\./i)
            await expect(pieces(page)).toHaveCount(0)
            await expect(answer(page, 'None')).toHaveCount(0)
        })
    })

    /** Dissent asks the same of the 2 Dana's board could not put on the card. */
    test.describe(`Dissent asks the Vow of Kinship holder, on a ${name}`, () => {
        test.use({ viewport })

        test('the same question under Dissent; "Pay" puts the picked favor on the card', async ({ page }) => {
            await openTable(page, 'kinshipDissent')
            await expect(panel(page).getByRole('heading', { name: 'Dissent' })).toBeVisible()
            await expect(line(page)).toHaveText(/^Pay how many\s+from\s*\?$/)
            await expect(pieces(page)).toHaveCount(2)
            await piece(page, 1).click()
            await expect(panel(page).locator('[aria-pressed="true"]')).toHaveCount(1)
            await answer(page, 'Pay').click()
            await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('ActPhase')
            expect((await call(page, 'tableFacts')).favorBank.nomad).toBe(2)
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toContainText('Dissent: paid 1 from onto it')
            }
        })
    })
}
