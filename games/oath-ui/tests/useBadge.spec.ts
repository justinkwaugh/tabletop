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

const ORACLE = 'denizen.nomad.oracle'
const ALCHEMIST = 'denizen.arcane.alchemist'
const IVORY_EYE = 'relic.ivory-eye'
const DREAM_THIEF = 'denizen.arcane.dream-thief'
const NOT_BADGED = [
    'denizen.beast.birdsong',
    'denizen.hearth.awaited-return',
    'denizen.order.toll-roads',
    'denizen.order.forced-labor'
]

const panel = (page: Page) => page.locator('.panel')
const badge = (page: Page, cardId: string) => page.locator(`[data-use-badge="${cardId}"]`)
const badges = (page: Page) => page.locator('[data-use-badge]')
const powerRows = (page: Page) => panel(page).locator('[data-action-power]')
const usePower = (page: Page) =>
    panel(page).getByRole('button', { name: 'Use a power', exact: true })
const undoButton = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
const boardCard = (page: Page, cardId: string) =>
    page.locator('.board-card').filter({ has: badge(page, cardId) })
const seat = (page: Page) => page.locator('.seat').filter({ has: page.locator('.row--held') })

/**
 * On a phone the map opens on the Provinces: the Cradle, where the seat stands, is framed as a
 * pan would (the desktop's focus view, hidden on a phone).
 */
async function openBadgeTable(page: Page, name: TableFixture.TableName, phone: boolean) {
    await openTable(page, name)
    if (phone) {
        await page
            .locator('.chooser__view', { hasText: 'Cradle' })
            .evaluate((view) => view instanceof HTMLElement && view.click())
        // The map glides to its frame: wait until its first card stands still.
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
}

async function box(locator: Locator) {
    const found = await locator.boundingBox()
    expect(found).not.toBeNull()
    return found ?? { x: 0, y: 0, width: 0, height: 0 }
}

/** The badge's face and its tap area, on screen. */
async function badgeSize(page: Page, cardId: string) {
    return badge(page, cardId).evaluate((button) => {
        const face = button.querySelector('.use-badge__face')?.getBoundingClientRect()
        const area = button.getBoundingClientRect()
        return {
            area: { top: area.top, width: area.width, height: area.height },
            face: { top: face?.top ?? 0, width: face?.width ?? 0, height: face?.height ?? 0 }
        }
    })
}

for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    const phone = viewport.width < 640
    test.describe(`the Use badge, at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        test('Oracle at the site, Alchemist among the advisers and the Ivory Eye carry "Use"; no other card does', async ({
            page
        }) => {
            await openBadgeTable(page, 'useBadge', phone)
            await expect(badge(page, ORACLE)).toBeVisible()
            for (const cardId of [ALCHEMIST, IVORY_EYE]) {
                await expect(badge(page, cardId)).toHaveCount(1)
                await expect(badge(page, cardId)).toHaveText('Use')
            }
            for (const cardId of NOT_BADGED) await expect(badge(page, cardId)).toHaveCount(0)
            await expect(badges(page)).toHaveCount(3)
            await expect(badge(page, ORACLE)).toHaveAccessibleName('Use Oracle')
            // The chip stays.
            await expect(usePower(page)).toBeVisible()

            const size = await badgeSize(page, ORACLE)
            // It fits its label: as wide as its face, and 44 px tall at every width.
            expect(size.area.width).toBeCloseTo(size.face.width, 0)
            expect(size.area.height).toBeCloseTo(44, 0)
            // The tap area runs down from the face, so the card above keeps its own tap.
            expect(size.area.top).toBeCloseTo(size.face.top, 0)

            // At the card's foot, its centre on the card's.
            const card = await box(boardCard(page, ORACLE))
            const face = await box(badge(page, ORACLE).locator('.use-badge__face'))
            expect(face.x + face.width / 2).toBeCloseTo(card.x + card.width / 2, 0)
            expect(face.y).toBeLessThan(card.y + card.height)
            expect(face.y + face.height).toBeGreaterThan(card.y + card.height)
        })

        test('every badge, on the board and in the seat, is 44 px tall from its face down; a disabled one too', async ({
            page
        }) => {
            await openBadgeTable(page, 'useBadge', phone)
            await expect(badges(page)).toHaveCount(3)
            for (const cardId of [ORACLE, ALCHEMIST, IVORY_EYE]) {
                await badge(page, cardId).scrollIntoViewIfNeeded()
                const size = await badgeSize(page, cardId)
                expect(size.area.height).toBeCloseTo(44, 0)
                expect(size.area.top).toBeCloseTo(size.face.top, 0)
            }
            // Disabled while a move is sent: the same tap area, no pointer.
            const disabled = await badge(page, ALCHEMIST).evaluate((button) => {
                if (!(button instanceof HTMLButtonElement)) return { height: 0, cursor: '' }
                button.disabled = true
                const result = {
                    height: button.getBoundingClientRect().height,
                    cursor: getComputedStyle(button).cursor
                }
                button.disabled = false
                return result
            })
            expect(disabled.height).toBeCloseTo(44, 0)
            expect(disabled.cursor).toBe('default')
        })

        for (const { name, slot } of [
            { name: 'facedownDreamThief', slot: 0 },
            { name: 'facedownDreamThiefSecond', slot: 1 }
        ] as const) {
            test(`with the badged adviser ${slot === 0 ? 'first' : 'second'} in the seat, no badge's tap area covers Let another peek`, async ({
                page
            }) => {
                await openTable(page, name)
                const peek = page.getByRole('button', { name: 'Let another peek', exact: true })
                await expect(peek).toHaveCount(1)
                // The badged card stands in the slot this scene names.
                const slotOf = await badge(page, DREAM_THIEF).evaluate((button) => {
                    const thumb = button.closest('figure')
                    return thumb ? [...(thumb.parentElement?.children ?? [])].indexOf(thumb) : -1
                })
                expect(slotOf).toBe(slot)

                // The supply track's art has no height until it loads, and the rows below it move
                // down when it does: wait for the seat's images, then measure the button and every
                // badge in one frame.
                await expect
                    .poll(() =>
                        page
                            .locator('.seat')
                            .filter({ has: peek })
                            .locator('img')
                            .evaluateAll((all) =>
                                all.every((img) => img instanceof HTMLImageElement && img.complete)
                            )
                    )
                    .toBe(true)
                const covered = await peek.evaluate((element) => {
                    const button = element.getBoundingClientRect()
                    return [...document.querySelectorAll('[data-use-badge]')].map((badge) => {
                        const r = badge.getBoundingClientRect()
                        const width =
                            Math.min(r.right, button.right) - Math.max(r.left, button.left)
                        const height =
                            Math.min(r.bottom, button.bottom) - Math.max(r.top, button.top)
                        return width > 0 && height > 0 ? width * height : 0
                    })
                })
                expect(covered.length).toBeGreaterThan(0)
                for (const area of covered) expect(area).toBeLessThan(0.5)
            })
        }

        for (const { name, cardId, where } of [
            {
                name: 'useBadgeWrappedHeld',
                cardId: IVORY_EYE,
                where: 'on the first of two relics, the held row wrapped under it with both banners'
            },
            {
                name: 'useBadgeOverHeld',
                cardId: ALCHEMIST,
                where: 'on the first adviser, over the third held item, with no hand and no Let another peek'
            }
        ] as const) {
            test(`a badge ${where}: a tap on that item's top strip enlarges the item; the badge's face still opens Use a power`, async ({
                page
            }) => {
                await openTable(page, name)
                const held = seat(page)
                await expect(badge(page, cardId)).toHaveCount(1)
                if (name === 'useBadgeOverHeld') {
                    await expect(held.locator('.hand')).toHaveCount(0)
                    await expect(
                        page.getByRole('button', { name: 'Let another peek', exact: true })
                    ).toHaveCount(0)
                }
                await held.locator('.row--held').scrollIntoViewIfNeeded()
                // The supply track's art has no height until it loads, and the rows below it move
                // down when it does: wait for the seat's images, then measure in one frame.
                await expect
                    .poll(() =>
                        held
                            .locator('img')
                            .evaluateAll((all) =>
                                all.every((img) => img instanceof HTMLImageElement && img.complete)
                            )
                    )
                    .toBe(true)
                const found = await badge(page, cardId).evaluate((button) => {
                    const area = button.getBoundingClientRect()
                    const face = button.querySelector('.use-badge__face')?.getBoundingClientRect()
                    const own = button.closest('figure')
                    const items = [...document.querySelectorAll('.row--held > figure')]
                    // The held items, other than the badge's own card, its tap area reaches.
                    const under = items.flatMap((item, index) => {
                        if (item === own) return []
                        const r = item.getBoundingClientRect()
                        const left = Math.max(r.left, area.left)
                        const right = Math.min(r.right, area.right)
                        const top = Math.max(r.top, area.top)
                        const bottom = Math.min(r.bottom, area.bottom)
                        if (right <= left || bottom <= top) return []
                        return [
                            {
                                index,
                                below: r.top >= (own?.getBoundingClientRect().bottom ?? 0),
                                strip: { x: (left + right) / 2, y: (top + bottom) / 2 },
                                alt: item.querySelector('img')?.getAttribute('alt') ?? ''
                            }
                        ]
                    })
                    return {
                        under,
                        face: face
                            ? { x: face.left + face.width / 2, y: face.top + face.height / 2 }
                            : { x: 0, y: 0 }
                    }
                })
                // The scene: the badge's tap area reaches the top of exactly one held item, below
                // its own card.
                expect(found.under).toHaveLength(1)
                const item = found.under[0] ?? {
                    index: -1,
                    below: false,
                    strip: { x: 0, y: 0 },
                    alt: ''
                }
                expect(item.below).toBe(true)
                if (name === 'useBadgeOverHeld') expect(item.index).toBe(2)

                // That strip is the item's: a tap there enlarges it, and Use a power stays shut.
                await page.mouse.click(item.strip.x, item.strip.y)
                await expect(
                    page.locator('.card-preview').getByRole('img', { name: item.alt, exact: true })
                ).toBeVisible()
                await expect(powerRows(page)).toHaveCount(0)
                await page.keyboard.press('Escape')
                await expect(page.locator('.card-preview')).toHaveCount(0)

                // The badge's face, drawn on top, still takes its own tap.
                await page.mouse.click(found.face.x, found.face.y)
                await expect(powerRows(page)).toHaveCount(1)
                await expect(panel(page).locator(`[data-action-power="${cardId}"]`)).toBeVisible()
            })
        }

        test('the badge opens Use a power with just that card; the card itself still enlarges', async ({
            page
        }) => {
            await openBadgeTable(page, 'useBadge', phone)
            const card = await box(boardCard(page, ORACLE))
            await page.mouse.click(card.x + card.width / 2, card.y + card.height / 4)
            await expect(page.locator('.card-preview')).toBeVisible()
            await expect(powerRows(page)).toHaveCount(0)
            await page.keyboard.press('Escape')

            await badge(page, ORACLE).click()
            await expect(powerRows(page)).toHaveCount(1)
            await expect(panel(page).locator(`[data-action-power="${ORACLE}"]`)).toBeVisible()
            await expect(
                panel(page).getByRole('button', { name: 'Use, paying 2 secret' })
            ).toBeVisible()
            await expect(badge(page, ORACLE)).toBeVisible()

            // One Undo, back to the grid with the badges as before.
            await undoButton(page).click()
            await expect(powerRows(page)).toHaveCount(0)
            await expect(usePower(page)).toBeVisible()
            await expect(badges(page)).toHaveCount(3)
            // The chip lists every power again.
            await usePower(page).click()
            await expect(powerRows(page)).toHaveCount(3)
        })

        test('the Ivory Eye with nothing facedown has nothing to pick, and no badge', async ({
            page
        }) => {
            await openBadgeTable(page, 'useBadgeNothingToPick', phone)
            await expect(badge(page, ORACLE)).toBeVisible()
            await expect(badge(page, ALCHEMIST)).toHaveCount(1)
            await expect(badge(page, IVORY_EYE)).toHaveCount(0)
        })

        test('with another action staged there is none', async ({ page }) => {
            await openBadgeTable(page, 'useBadge', phone)
            await expect(badges(page)).toHaveCount(3)
            await panel(page)
                .getByRole('button', { name: /^Travel/ })
                .click()
            await expect(badges(page)).toHaveCount(0)
        })

        test('a site card’s badge (The Tribunal) and its 3 bandits do not overlap; with Travel staged the badge goes', async ({
            page
        }) => {
            await openBadgeTable(page, 'useBadgeTribunal', phone)
            const tribunal = badge(page, 'site.the-tribunal')
            await expect(tribunal).toBeVisible()
            const site = await box(page.locator('.site').filter({ has: tribunal }))
            // The bandits standing on The Tribunal's card.
            const standing = await page.locator('.piece-row .bandits').evaluateAll(
                (figures, s) =>
                    figures
                        .map((figure) => figure.getBoundingClientRect())
                        .filter((r) => {
                            const x = r.x + r.width / 2
                            const y = r.y + r.height / 2
                            return x > s.x && x < s.x + s.width && y > s.y && y < s.y + s.height
                        })
                        .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
                site
            )
            expect(standing).toHaveLength(1)
            const a = await box(tribunal)
            const b = standing[0] ?? { x: 0, y: 0, width: 0, height: 0 }
            const apart =
                a.x + a.width <= b.x ||
                b.x + b.width <= a.x ||
                a.y + a.height <= b.y ||
                b.y + b.height <= a.y
            expect(apart).toBe(true)
            await panel(page)
                .getByRole('button', { name: /^Travel/ })
                .click()
            await expect(badges(page)).toHaveCount(0)
        })

        test('the held relic’s badge stays inside the seat card, the row as before', async ({
            page
        }) => {
            await openBadgeTable(page, 'useBadge', phone)
            await expect(badge(page, IVORY_EYE)).toHaveCount(1)
            const held = seat(page)
            const edges = await held.evaluate((card) => {
                const box = card.getBoundingClientRect()
                return { left: box.left, right: box.right }
            })
            const relic = await held.locator('.thumb--relic').evaluate((figure) => {
                const image = figure.querySelector('img')?.getBoundingClientRect()
                const face = figure.querySelector('.use-badge__face')?.getBoundingClientRect()
                return {
                    image: {
                        left: image?.left ?? 0,
                        right: image?.right ?? 0,
                        width: image?.width
                    },
                    face: {
                        left: face?.left ?? 0,
                        right: face?.right ?? 0,
                        width: face?.width ?? 0
                    }
                }
            })
            expect(relic.image.width).toBe(52)
            expect(relic.face.width).toBeGreaterThan(0)
            for (const part of [relic.image, relic.face]) {
                expect(part.left).toBeGreaterThanOrEqual(edges.left)
                expect(part.right).toBeLessThanOrEqual(edges.right)
            }
            await expect(held.locator('.row--held figure')).toHaveCount(1)
        })
    })

    if (!phone) {
        test.describe('the Use badge at the board’s zoom, at 1280 × 900', () => {
            /** The badge's height and the board's zoom at it, once the board stands still. */
            async function zoomedBadge(page: Page) {
                const read: { last: string } = { last: '' }
                await expect
                    .poll(async () => {
                        const now = JSON.stringify(await badge(page, ORACLE).boundingBox())
                        const still = now === read.last
                        read.last = now
                        return still
                    })
                    .toBe(true)
                return badge(page, ORACLE).evaluate((button) => ({
                    height: button.getBoundingClientRect().height,
                    zoom: parseFloat(getComputedStyle(button).getPropertyValue('--board-zoom'))
                }))
            }

            test('zoomed in and out, a board card’s badge is 44 screen px tall', async ({
                page
            }) => {
                await openTable(page, 'useBadge')
                const rest = await zoomedBadge(page)
                expect(rest.height).toBeCloseTo(44, 0)

                await page
                    .getByRole('group', { name: 'Focus the board' })
                    .getByRole('button', { name: 'Cradle' })
                    .click()
                await expect
                    .poll(async () => (await zoomedBadge(page)).zoom)
                    .toBeGreaterThan(rest.zoom * 1.5)
                const zoomedIn = await zoomedBadge(page)
                expect(zoomedIn.height).toBeCloseTo(44, 0)

                // Zoomed out by hand, between the two.
                const board = await box(page.locator('.scaling-surface').first())
                await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2)
                await page.mouse.wheel(0, 200)
                await expect
                    .poll(async () => (await zoomedBadge(page)).zoom)
                    .toBeLessThan(zoomedIn.zoom)
                expect((await zoomedBadge(page)).height).toBeCloseTo(44, 0)
            })
        })

        test.describe('the Use badge on a held relic, at 1280 × 900', () => {
            const WHISTLE = 'relic.whistle'

            test('the panel holds that card alone, not the cards that change an action; the chip lists them', async ({
                page
            }) => {
                await openTable(page, 'usePower')
                await badge(page, WHISTLE).click()
                await expect(powerRows(page)).toHaveCount(1)
                await expect(panel(page).locator(`[data-action-power="${WHISTLE}"]`)).toBeVisible()
                await expect(panel(page).locator('[data-action-card]')).toHaveCount(0)
                await expect(panel(page).getByText('Makes an action possible')).toHaveCount(0)
                await undoButton(page).click()
                await usePower(page).click()
                await expect(panel(page).locator('[data-action-card]')).toHaveCount(2)
                await expect(powerRows(page)).toHaveCount(1)
            })

            test('a power used from the badge, then Undo: the Act Phase again with the badges as before', async ({
                page
            }) => {
                await openTable(page, 'usePower')
                await expect(badges(page)).toHaveCount(1)
                await badge(page, WHISTLE).click()
                await panel(page).getByRole('button', { name: 'Use, paying 1 secret' }).click()
                await expect(powerRows(page)).toHaveCount(0)
                await expect(usePower(page)).toBeVisible()
                await undoButton(page).click()
                await expect(badges(page)).toHaveCount(1)
                await expect(badge(page, WHISTLE)).toBeVisible()
                await expect(usePower(page)).toBeVisible()
            })
        })
    }
}
