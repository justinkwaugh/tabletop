import { expect, test, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

type Fixture = typeof TableFixture

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture: Fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        await fixture.open(name)
    }, name)
}

/** Names as long as the platform allows (64), one unbroken word and with spaces, and a 28-letter one. */
const NAME_64 = 'Ottolinewinterbournecastellanmacgillivrayfennimoreashcombebrooke'
const NAME_64_SPACED = 'Ottoline Winterbourne Castellan Macgillivray Fennimore Ashworthy'
const NAME_28 = 'Rosalindwhitcombebarrowfield'
/** One-word names short enough to stand whole on a phone's seat heading. */
const NAME_14 = 'Bartholomewson'
const NAME_19 = 'Maximilianfairbanks'

/** The title word never draws narrower than this: an Exile word is 75 px at full size. */
const WORD_FLOOR = 72

type Strip = {
    seat: string
    word: { width: number; height: number }
    nameCut: boolean
    you: { whole: boolean } | null
    deal: { whole: boolean } | null
    pastStrip: string[]
}

/** Every seat card's header strip: its title word, name pill, "· you" and deal mark, measured. */
async function strips(page: Page): Promise<Strip[]> {
    return page.locator('header.strip').evaluateAll((all) =>
        all.map((strip) => {
            const edge = strip.getBoundingClientRect()
            const inside = (element: Element, box: DOMRect) => {
                const own = element.getBoundingClientRect()
                return own.left >= box.left - 0.5 && own.right <= box.right + 0.5
            }
            const unclipped = (element: Element) => element.scrollWidth <= element.clientWidth
            const word = strip.querySelector('.word') as HTMLElement
            const pill = strip.querySelector('.pill') as HTMLElement
            const name = pill.querySelector('.name') ?? pill
            const you = pill.querySelector('.you')
            const deal = strip.querySelector('[data-deal-mark]')
            return {
                seat: (pill.getAttribute('aria-label') ?? '').replace(/^Open (.*)'s seat.*$/, '$1'),
                word: { width: word.offsetWidth, height: word.offsetHeight },
                nameCut: name.scrollWidth > name.clientWidth,
                you: you
                    ? {
                          whole:
                              you.getBoundingClientRect().width > 0 &&
                              unclipped(you) &&
                              inside(you, pill.getBoundingClientRect())
                      }
                    : pill.getAttribute('aria-label')?.endsWith('(you)')
                      ? { whole: false }
                      : null,
                deal: deal ? { whole: unclipped(deal) && inside(deal, edge) } : null,
                pastStrip: [...strip.querySelectorAll('*')]
                    .filter((inner) => inner.getBoundingClientRect().width > 0)
                    .filter((inner) => !inside(inner, edge))
                    .map((inner) => `${inner.tagName.toLowerCase()}.${inner.className}`)
            }
        })
    )
}

async function pageOverflow(page: Page) {
    return page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
}

function strip(all: Strip[], seat: string): Strip {
    const found = all.find((one) => one.seat === seat)
    expect(found, `${seat}'s strip`).toBeDefined()
    return found!
}

/**
 * R-7.6.3-H1 — a name as long as the platform allows (64) beside the seat's title word and the
 * Tribunal's deal mark: the title word keeps at least 72 px at its full height, the name gives way and
 * is cut with "…", "· you" and the deal mark stay whole, and nothing runs past the strip.
 */
for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    test.describe(`a long seat name at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        for (const [table, longSeats] of [
            ['longSeatLetters', [NAME_64, NAME_28]],
            ['longSeatSpaces', [NAME_64_SPACED, NAME_28]],
            ['longSeatTypical', ['Marguerite']],
            ['longSeatCitizen', [NAME_64]]
        ] as const) {
            test(`${table}: every title word keeps 72 px, "· you" and the deal mark stay whole, nothing runs past the strip`, async ({
                page
            }) => {
                await openTable(page, table)
                const all = await strips(page)
                expect(all).toHaveLength(3)
                for (const one of all) {
                    expect(one.word.width, `${one.seat}'s title word`).toBeGreaterThanOrEqual(
                        WORD_FLOOR
                    )
                    expect(one.word.height, `${one.seat}'s title word`).toBe(32)
                    if (one.you) expect(one.you, `${one.seat}'s "· you"`).toEqual({ whole: true })
                    if (one.deal)
                        expect(one.deal, `${one.seat}'s deal mark`).toEqual({ whole: true })
                    expect(one.pastStrip, `${one.seat}'s strip`).toEqual([])
                }
                expect(all.filter((one) => one.you)).toHaveLength(1)
                expect(all.filter((one) => one.deal)).toHaveLength(2)
                for (const seat of longSeats) expect(strip(all, seat).nameCut, seat).toBe(true)
                expect(await pageOverflow(page)).toBe(0)
            })
        }

        test('a cut name ends in "…" and keeps its whole name as the pill’s accessible name', async ({
            page
        }) => {
            await openTable(page, 'longSeatLetters')
            const own = page.locator('.seat .pill', { hasText: 'you' })
            await expect(own.locator('.name')).toHaveText(NAME_64)
            await expect(own.locator('.name')).toHaveCSS('text-overflow', 'ellipsis')
            await expect(own.locator('.you')).toHaveText(' · you')
            await expect(own).toHaveText(`${NAME_64} · you`)
            await expect(own).toHaveAccessibleName(`Open ${NAME_64}'s seat (you)`)
        })

        test('a short name is whole and its title word is drawn at full size', async ({ page }) => {
            await openTable(page, 'longSeatTypical')
            const all = await strips(page)
            for (const seat of ['Rhys', 'Dana']) {
                expect(strip(all, seat).nameCut, seat).toBe(false)
                // An Exile word is 75 px wide at its full 32 px height.
                expect(strip(all, seat).word.width, seat).toBeGreaterThanOrEqual(75)
            }
            await expect(page.locator('.seat .pill').filter({ hasText: /^Dana$/ })).toHaveCount(1)
        })

        for (const [table, own, other] of [
            ['longSeatOneWord', NAME_14, NAME_19],
            ['longSeatOneWordExile', NAME_19, NAME_14]
        ] as const) {
            test(`${table}: a one-word name that fits stays whole on one line of its seat heading, inside its row`, async ({
                page
            }) => {
                await openTable(page, table)
                for (const [name, you] of [
                    [own, true],
                    [other, false]
                ] as const) {
                    await page
                        .locator('.seat .pill')
                        .filter({ has: page.locator('.name', { hasText: name }) })
                        .click()
                    const seat = page.getByRole('dialog', { name: `${name}'s seat` })
                    await expect(seat).toBeVisible()
                    const heading = seat.getByRole('heading', { level: 2 })
                    await expect(heading).toHaveText(you ? `${name} · you` : name)
                    const fit = await heading.evaluate((element, name) => {
                        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
                        let text: Text | null = null
                        while (walker.nextNode()) {
                            const node = walker.currentNode as Text
                            if (node.data.includes(name)) text = node
                        }
                        const range = document.createRange()
                        const start = text!.data.indexOf(name)
                        range.setStart(text!, start)
                        range.setEnd(text!, start + name.length)
                        const tops = new Set(
                            [...range.getClientRects()].map((line) => Math.round(line.top))
                        )
                        const row = element.parentElement!.getBoundingClientRect()
                        const box = element.getBoundingClientRect()
                        return {
                            nameLines: tops.size,
                            inRow: box.left >= row.left - 0.5 && box.right <= row.right + 0.5,
                            clipped: element.scrollWidth > element.clientWidth
                        }
                    }, name)
                    expect(fit, `${name}'s seat heading`).toEqual({
                        nameLines: 1,
                        inRow: true,
                        clipped: false
                    })
                    expect(
                        await seat.evaluate((element) => element.scrollWidth - element.clientWidth)
                    ).toBe(0)
                    expect(await pageOverflow(page)).toBe(0)
                    await seat.getByRole('button', { name: 'Close' }).click()
                    await expect(seat).toBeHidden()
                }
            })
        }

        test('a tap on a cut name opens the seat, whose heading wraps the whole name inside its row', async ({
            page
        }) => {
            await openTable(page, 'longSeatLetters')
            await page.locator('.seat .pill', { hasText: 'you' }).click()
            const seat = page.getByRole('dialog', { name: `${NAME_64}'s seat` })
            await expect(seat).toBeVisible()
            const heading = seat.getByRole('heading', { level: 2 })
            await expect(heading).toHaveText(`${NAME_64} · you`)
            const fit = await heading.evaluate((element) => {
                const row = element.parentElement!.getBoundingClientRect()
                const box = element.getBoundingClientRect()
                return {
                    inRow: box.left >= row.left - 0.5 && box.right <= row.right + 0.5,
                    clipped: element.scrollWidth > element.clientWidth
                }
            })
            expect(fit).toEqual({ inRow: true, clipped: false })
            expect(
                await seat.evaluate((element) => element.scrollWidth - element.clientWidth)
            ).toBe(0)
            expect(await pageOverflow(page)).toBe(0)
        })
    })
}
