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

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    return call(page, 'open', name)
}

async function boxOf(locator: Locator) {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is not drawn')
    return box
}

const panel = (page: Page) => page.locator('.panel')
const answer = (page: Page, name: string) => panel(page).getByRole('button', { name, exact: true })

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

/** The answer reads "<word> · <consequence>": the dot muted and hidden from a screen reader, the consequence rose and semibold. */
async function expectConsequence(button: Locator, word: string, consequence: string) {
    await expect(button).toHaveText(new RegExp(`^${word}\\s*·\\s*${consequence}$`))
    const dot = button.getByText('·', { exact: true })
    await expect(dot).toHaveClass(/\btext-oath-text-muted\b/)
    await expect(dot).toHaveAttribute('aria-hidden', 'true')
    const words = button.getByText(consequence, { exact: true })
    await expect(words).toHaveClass(/\btext-oath-danger\b/)
    expect(await words.evaluate((element) => getComputedStyle(element).fontWeight)).toBe('600')
}

/**
 * The two answers share one width, each fits its label, 44 px tall on a phone; side by side when they
 * fit on one line, one per line when they do not, and the page never scrolls sideways.
 */
async function expectLabelSized(page: Page, first: Locator, second: Locator, phone: boolean) {
    const [a, b, form] = [await boxOf(first), await boxOf(second), await boxOf(panel(page))]
    expect(Math.abs(a.width - b.width)).toBeLessThan(1)
    expect(a.width, 'never stretched across the panel').toBeLessThan(form.width * 0.75)
    for (const button of [first, second]) {
        const overflow = await button.evaluate(
            (element) => element.scrollWidth - element.clientWidth
        )
        expect(overflow, 'the label fits its button').toBeLessThanOrEqual(0)
    }
    if (phone) {
        expect(a.height).toBeGreaterThanOrEqual(44)
        expect(b.height).toBeGreaterThanOrEqual(44)
    }
    const row = await first.evaluate((element) => element.parentElement?.clientWidth ?? 0)
    if (a.width + b.width + 8 <= row) {
        expect(Math.abs(a.y - b.y), 'side by side').toBeLessThan(1)
    } else {
        expect(b.y, 'one per line').toBeGreaterThanOrEqual(a.y + a.height)
    }
    const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(sideways).toBeLessThanOrEqual(0)
}

for (const { name, viewport, phone } of SIZES) {
    test.describe(`a yes/no answer carries its consequence in rose (${name})`, () => {
        test.use({ viewport })

        test('Blackmail: "Refuse · Ann takes it", the taker named as their chip names them; Pay and Refuse at one width', async ({
            page
        }) => {
            await openTable(page, 'askBlackmail')
            const refuse = answer(page, 'Refuse, Ann takes it')
            await expectConsequence(refuse, 'Refuse', 'Ann takes it')
            const pay = answer(page, 'Pay')
            await expect(pay).toHaveText('Pay')
            await expectLabelSized(page, pay, refuse, phone)

            await refuse.click()
            await expect.poll(async () => await call(page, 'openQuestionKind')).toBeUndefined()
        })

        test('Toll Roads: "Refuse · you stay", and refusing leaves the pawn where it was', async ({
            page
        }) => {
            expect((await openTable(page, 'tollAsked')).seatId).toBe('Dana')
            const refuse = answer(page, 'Refuse, you stay')
            await expectConsequence(refuse, 'Refuse', 'you stay')
            const pay = answer(page, 'Pay')
            await expect(pay).toHaveText('Pay')
            await expectLabelSized(page, pay, refuse, phone)

            await refuse.click()
            await expect(refuse).toHaveCount(0)
            expect((await call(page, 'tableFacts')).siteOf.Dana).toBe('slot.provinces.2')
        })

        for (const [table, answers] of [
            ['askRelicThief', ['Pass']],
            ['askRevelation', ['None']],
            ['askSneakAttack', ['Campaign', 'Pass']],
            ['askTinkersFair', ['Refuse']],
            ['askGatheringJoin', ['Go', 'Stay']]
        ] as const) {
            test(`${table}: no consequence beyond its line, so today's answers, nothing in rose`, async ({
                page
            }) => {
                await openTable(page, table)
                for (const word of answers) await expect(answer(page, word)).toHaveText(word)
                await expect(panel(page).locator('button .text-oath-danger')).toHaveCount(0)
            })
        }
    })
}
