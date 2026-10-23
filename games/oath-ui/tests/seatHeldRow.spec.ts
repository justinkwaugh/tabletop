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

/** The seat card holding the relics and banners, and each picture in its held row. */
async function heldRow(page: Page) {
    const seat = page.locator('.seat').filter({ has: page.locator('.row--held') })
    await expect(seat).toHaveCount(1)
    await expect(seat.locator('.row--held figure')).toHaveCount(6)
    return seat.evaluate((card) => {
        const edges = card.getBoundingClientRect()
        const border = parseFloat(getComputedStyle(card).borderRightWidth)
        const row = card.querySelector('.row--held')
        const style = row ? getComputedStyle(row) : undefined
        return {
            left: edges.left,
            right: edges.right - border,
            bottom: edges.bottom,
            rowGap: style?.rowGap,
            columnGap: style?.columnGap,
            pictures: [...card.querySelectorAll('.row--held figure')].map((figure) => {
                const box = figure.getBoundingClientRect()
                const image = figure.querySelector('img')?.getBoundingClientRect()
                return {
                    kind: figure.classList.contains('thumb--banner') ? 'banner' : 'relic',
                    left: box.left,
                    right: box.right,
                    top: box.top,
                    bottom: box.bottom,
                    width: image?.width,
                    height: image?.height
                }
            })
        }
    })
}

/**
 * A seat's relics and banners wrap onto further lines inside its card, which grows taller; the
 * pictures keep their size, and the lines stand as far apart as the pictures do. The phone's seat
 * column holds the same 320 px card.
 */
for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    test.describe(`at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        test('a seat holding four relics and both banners keeps every picture inside its card, wrapped at full size', async ({
            page
        }) => {
            await openTable(page, 'heldRow')
            const row = await heldRow(page)
            expect(row.right - row.left).toBeLessThanOrEqual(320)
            for (const picture of row.pictures) {
                expect(picture.left).toBeGreaterThanOrEqual(row.left)
                expect(picture.right).toBeLessThanOrEqual(row.right)
                expect(picture.bottom).toBeLessThanOrEqual(row.bottom)
            }
            const relics = row.pictures.filter((picture) => picture.kind === 'relic')
            const banners = row.pictures.filter((picture) => picture.kind === 'banner')
            expect(relics.map((relic) => relic.width)).toEqual([52, 52, 52, 52])
            expect(banners.map(({ width, height }) => ({ width, height }))).toEqual([
                { width: 104, height: 52 },
                { width: 104, height: 52 }
            ])
            // Relics first, then banners, over more than one line.
            expect(row.pictures.map((picture) => picture.kind)).toEqual([
                'relic',
                'relic',
                'relic',
                'relic',
                'banner',
                'banner'
            ])
            expect(new Set(row.pictures.map((picture) => picture.top)).size).toBeGreaterThan(1)
            expect(row.rowGap).toBe(row.columnGap)
        })
    })
}
