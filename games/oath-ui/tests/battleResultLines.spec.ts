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

const panel = (page: Page) => page.locator('.panel')
const line = (page: Page) => panel(page).locator('p.battle-result')
const button = (page: Page, name: string | RegExp) =>
    panel(page).getByRole('button', { name, exact: typeof name === 'string' })

/** The line's words, its pictures named by their alt text and each chip in brackets. */
async function lineText(page: Page): Promise<string> {
    return line(page).evaluate((node) => {
        const words = (n: Node): string => {
            if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? ''
            if (n.nodeType !== Node.ELEMENT_NODE) return ''
            const element = n as Element
            if (element.tagName === 'IMG') return `[${element.getAttribute('alt')}]`
            if (element.matches('span.rounded')) return `[${element.textContent?.trim()}]`
            return [...element.childNodes].map(words).join('')
        }
        return words(node).replace(/\s+/g, ' ').trim()
    })
}

/** True when `first` is drawn above `second`. */
async function above(first: Locator, second: Locator): Promise<boolean> {
    const a = await first.boundingBox()
    const b = await second.boundingBox()
    return a !== null && b !== null && a.y + a.height <= b.y + 1
}

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 } },
    { name: 'phone', viewport: { width: 375, height: 812 } }
]

/**
 * R-5.5.5, R-5.5.6 — Dana (red) campaigns against Ann (purple, the Chancellor) at the Plains: the
 * battle step's line over its buttons, then where the defence went, first in the spoils.
 */
for (const size of SIZES) {
    test.describe(`the battle's result lines, ${size.name}`, () => {
        test.use({ viewport: size.viewport })

        test('the gap in swords, over the sacrifice buttons', async ({ page }) => {
            expect((await openTable(page, 'resultGap')).seatId).toBe('Dana')
            expect(await lineText(page)).toBe(
                '1 [skulls] rolled: 1 [warbands] died. 4 [swords] against 6 [defense]: you are 3 short.'
            )
            await expect(line(page).locator('span.text-oath-danger')).toHaveText([
                'died',
                '3 short'
            ])
            expect(await above(line(page), button(page, 'Sacrifice 3 and win'))).toBe(true)
            await expect(button(page, 'Sacrifice nothing')).toBeVisible()
        })

        test('with Zealots, the same line over "Sacrifice 1 and win"', async ({ page }) => {
            await openTable(page, 'resultZealots')
            expect(await lineText(page)).toBe(
                '1 [skulls] rolled: 1 [warbands] died. 4 [swords] against 6 [defense]: you are 3 short.'
            )
            expect(await above(line(page), button(page, 'Sacrifice 1 and win'))).toBe(true)
        })

        test('a battle too far short: the line over the refusal and the plain choice', async ({
            page
        }) => {
            await openTable(page, 'resultShort')
            expect(await lineText(page)).toBe('2 [swords] against 6 [defense]: you are 5 short.')
            const refusal = panel(page).getByText(
                "Can't win: only 3 warbands in your force to sacrifice"
            )
            expect(await above(line(page), refusal)).toBe(true)
            await expect(panel(page).getByRole('button')).toHaveText(['Sacrifice nothing'])
        })

        test('who won and why, with counts, over a plain "Continue"', async ({ page }) => {
            await openTable(page, 'resultOutright')
            expect(await lineText(page)).toBe(
                '2 [skulls] rolled: 2 [warbands] died. 6 [swords] against 5 [defense]: you win.'
            )
            await expect(panel(page)).not.toContainText('You win.')
            await expect(panel(page).getByRole('button')).toHaveText(['Continue'])
            expect(await above(line(page), button(page, 'Continue'))).toBe(true)

            await openTable(page, 'resultBandits')
            expect(await lineText(page)).toBe('3 [swords] against 2 [defense]: you win.')
            await expect(panel(page).getByRole('button')).toHaveText(['Continue'])
        })

        test('a battle a plan decided names its card and the victor', async ({ page }) => {
            await openTable(page, 'resultHearts')
            expect(await lineText(page)).toBe(
                '[Hearts and Minds]Hearts and Minds decided the battle: [Ann] is victorious.'
            )
            await expect(panel(page)).not.toContainText('You lose.')
            await expect(panel(page).getByRole('button')).toHaveText(['Continue'])
        })

        test('where the defence went, first in the spoils, above "Place warbands"', async ({
            page
        }) => {
            await openTable(page, 'resultOutrightSpoils')
            expect(await lineText(page)).toBe(
                "You won: 2 of [Ann]'s defence died, and the other 2 went home to their board."
            )
            const place = panel(page).getByText('Place warbands: 1 of 4.')
            expect(await above(line(page), place)).toBe(true)
        })

        test("Hospital's are set aside at Hospital, in bold and not rose", async ({ page }) => {
            await openTable(page, 'resultHospitalSpoils')
            expect(await lineText(page)).toBe(
                "You won: 2 of [Ann]'s defence are set aside at Hospital, and the other 2 went home to their board."
            )
            await expect(line(page).locator('strong')).toHaveText('Hospital')
            await expect(line(page).locator('span.text-oath-danger')).toHaveCount(0)
        })

        test('the bandits went into hiding', async ({ page }) => {
            await openTable(page, 'resultBanditsSpoils')
            expect(await lineText(page)).toBe('You won: the bandit went into hiding.')
        })

        test("an ally's survivors went home to their boards", async ({ page }) => {
            await openTable(page, 'resultAllyHospitalSpoils')
            expect(await lineText(page)).toBe(
                "You won: 1 of [Ann]'s defence died, 2 are set aside at Hospital, and the other 3 went home to their boards."
            )
        })

        test('the Obsidian Cage took the other 3', async ({ page }) => {
            await openTable(page, 'resultCageSpoils')
            expect(await lineText(page)).toBe(
                "You won: 3 of [Ann]'s defence died, and [Obsidian Cage]Obsidian Cage took the other 3."
            )
        })

        test('another seat reads who won by their chip, above "Waiting on"', async ({ page }) => {
            await openTable(page, 'resultOutrightSpoils')
            expect(await call(page, 'viewOffTheClock')).toBe('Ann')
            expect(await lineText(page)).toBe(
                "[Dana] won: 2 of [Ann]'s defence died, and the other 2 went home to their board."
            )
            const waiting = panel(page).getByText(/Waiting on/)
            expect(await above(line(page), waiting)).toBe(true)
        })

        test('nothing overflows, and every button is 44 px tall on a phone', async ({ page }) => {
            for (const table of [
                'resultGap',
                'resultZealots',
                'resultHearts',
                'resultHospitalSpoils',
                'resultAllyHospitalSpoils',
                'resultCageSpoils'
            ] as const) {
                await openTable(page, table)
                await expect(line(page)).toBeVisible()
                const overflow = await page.evaluate(() => {
                    const box = document.querySelector('.panel')?.getBoundingClientRect()
                    let past = 0
                    for (const node of document.querySelectorAll('.panel *')) {
                        const rect = node.getBoundingClientRect()
                        if (box && rect.width > 0) past = Math.max(past, rect.right - box.right)
                    }
                    return {
                        page: document.documentElement.scrollWidth - innerWidth,
                        panel: Math.round(past)
                    }
                })
                expect(overflow, table).toEqual({ page: 0, panel: 0 })
                if (size.name !== 'phone') continue
                // The buttons that name a choice in words (a site's magnifier is not one).
                for (const each of await panel(page).getByRole('button').all()) {
                    const label = (await each.innerText()).trim()
                    if (label === '') continue
                    const box = await each.boundingBox()
                    expect(
                        Math.round(box?.height ?? 0),
                        `${table}: ${label}`
                    ).toBeGreaterThanOrEqual(44)
                }
            }
        })
    })
}
