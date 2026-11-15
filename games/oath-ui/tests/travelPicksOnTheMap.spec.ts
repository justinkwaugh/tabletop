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

async function boxOf(page: Page, locator: ReturnType<Page['locator']>) {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is not drawn')
    return box
}

const panel = (page: Page) => page.locator('.panel')
const siteAt = (page: Page, slotId: string) => page.locator(`.site[data-slot="${slotId}"]`)
const siteCard = (page: Page, slotId: string) => siteAt(page, slotId).locator('.board-card')
const chipOf = (page: Page, slotId: string) => siteAt(page, slotId).locator('.travel-cost')
const litSlots = (page: Page) =>
    page
        .locator('.site')
        .filter({ has: page.locator('.board-card.offered') })
        .evaluateAll((sites) => sites.map((site) => site.getAttribute('data-slot') ?? '').sort())
const regionChips = (page: Page) => page.getByRole('group', { name: 'Frame the map on a region' })
const regionChip = (page: Page, region: string) =>
    regionChips(page).getByRole('button', { name: new RegExp(`^${region}:`) })

async function framed(page: Page, slotId: string): Promise<boolean> {
    const [card, view] = [
        await boxOf(page, siteCard(page, slotId)),
        await boxOf(page, page.locator('.scaling-surface'))
    ]
    return (
        card.x >= view.x - 0.5 &&
        card.y >= view.y - 0.5 &&
        card.x + card.width <= view.x + view.width + 0.5 &&
        card.y + card.height <= view.y + view.height + 0.5
    )
}

const SLOTS = {
    drownedCity: 'slot.cradle.0',
    plains: 'slot.cradle.1',
    wood: 'slot.provinces.0',
    greatSlum: 'slot.provinces.1',
    river: 'slot.provinces.2',
    mountain: 'slot.hinterland.0',
    hiddenPlace: 'slot.hinterland.1',
    wastes: 'slot.hinterland.2'
}

/** Every site but the Wood Dana stands at. */
const ANY_SITE = Object.values(SLOTS)
    .filter((slotId) => slotId !== SLOTS.wood)
    .sort()

const SIZES = [
    { name: 'desktop at 1280', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone at 375', viewport: { width: 375, height: 812 }, phone: true }
]

/** A tap on a phone, a click on a desktop. */
async function press(page: Page, slotId: string, phone: boolean) {
    if (phone) await siteCard(page, slotId).tap()
    else await siteCard(page, slotId).click()
}

const FREE_LINE = /^Pick where\s*Dana\s*goes\. Free\.$/

/**
 * R-11.7-H1 — the Shrouded Wood ruler's pick after a card or a banish moves the pawn is the Travel
 * pick: "Pick where Dana goes. Free.", the sites lit on the map with no price, and one tap sends.
 * On a phone the map opens on the moved pawn's region, one region at a time with region chips.
 */
for (const { name, viewport, phone } of SIZES) {
    test.describe(`every Travel pick on the map, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        const scenes = [
            { table: 'woodPickWhistle', lit: ANY_SITE, provinces: 2, sendTo: SLOTS.greatSlum },
            {
                table: 'woodPickHorse',
                lit: [SLOTS.river, SLOTS.mountain].sort(),
                provinces: 1,
                sendTo: SLOTS.river
            },
            { table: 'woodPickPalanquin', lit: ANY_SITE, provinces: 2, sendTo: SLOTS.greatSlum },
            { table: 'woodPickBanish', lit: ANY_SITE, provinces: 2, sendTo: SLOTS.greatSlum }
        ] as const
        for (const { table, lit, provinces, sendTo } of scenes) {
            test(`${table}: "Free." once, only its sites lit with no chip, opening on Dana’s region; one tap sends`, async ({
                page
            }) => {
                expect((await openTable(page, table)).seatId).toBe('Bea')
                await expect(panel(page).getByText(FREE_LINE)).toBeVisible()
                await expect(
                    panel(page).getByRole('button', {
                        name: /Drowned City|Plains|Great Slum|River|Mountain|Wastes/
                    })
                ).toHaveCount(0)
                expect(await litSlots(page)).toEqual(lit)
                for (const slotId of lit) await expect(chipOf(page, slotId)).toHaveCount(0)
                await expect(page.locator('.site.dimmed')).toHaveCount(
                    (await page.locator('.site').count()) - lit.length
                )
                if (phone) {
                    await expect(regionChip(page, 'Provinces')).toHaveAttribute(
                        'aria-pressed',
                        'true'
                    )
                    await expect(regionChip(page, 'Provinces')).toHaveAccessibleName(
                        `Provinces: ${provinces} lit ${provinces === 1 ? 'site' : 'sites'}`
                    )
                    await expect.poll(() => framed(page, sendTo)).toBe(true)
                    const box = await boxOf(page, siteCard(page, sendTo))
                    expect(box.width).toBeGreaterThanOrEqual(44)
                    expect(box.height).toBeGreaterThanOrEqual(44)
                } else {
                    await expect(regionChips(page)).toHaveCount(0)
                }

                await press(page, sendTo, phone)
                await expect
                    .poll(async () => (await call(page, 'tableFacts')).siteOf.Dana)
                    .toBe(sendTo)
                await expect(page.locator('.board-card.offered')).toHaveCount(0)
            })
        }

        test('after the Whistle used from another region, the map still opens on Dana’s region', async ({
            page
        }) => {
            await openTable(page, 'woodPickWhistleAway')
            await expect(panel(page).getByText(FREE_LINE)).toBeVisible()
            if (!phone) return
            await expect(regionChip(page, 'Provinces')).toHaveAttribute('aria-pressed', 'true')
            await expect.poll(() => framed(page, SLOTS.greatSlum)).toBe(true)
            expect(await framed(page, SLOTS.mountain)).toBe(false)
        })

        test('Toll Roads on a free pick: the toll site’s chip is "toll 1 [favor]", the others carry none', async ({
            page
        }) => {
            await openTable(page, 'woodPickWhistleToll')
            await expect(chipOf(page, SLOTS.greatSlum)).toHaveText(/^\s*toll 1\s*$/)
            await expect(
                chipOf(page, SLOTS.greatSlum).getByRole('img', { name: 'favor' })
            ).toHaveCount(1)
            await expect(
                siteAt(page, SLOTS.greatSlum).getByRole('button', {
                    name: 'Great Slum, toll 1 favor',
                    exact: true
                })
            ).toHaveCount(1)
            await expect(chipOf(page, SLOTS.river)).toHaveCount(0)
        })

        test('a banish while the Campaign is under way: Bea’s tap banishes Dana and the victory goes on to its end', async ({
            page
        }) => {
            await openTable(page, 'woodPickBanish')
            expect((await call(page, 'tableFacts')).campaignUnderway).toBe(true)
            if (phone) await expect.poll(() => framed(page, SLOTS.river)).toBe(true)
            await press(page, SLOTS.river, phone)
            await expect
                .poll(async () => (await call(page, 'tableFacts')).siteOf.Dana)
                .toBe(SLOTS.river)
            await expect
                .poll(async () => (await call(page, 'tableFacts')).campaignUnderway)
                .toBe(false)
        })

        test('the Brass Horse’s own pick: the card and "Travel where? Free.", the Plains with no chip, The Hidden Place "+[secret]"; a tap flips and travels', async ({
            page
        }) => {
            expect((await openTable(page, 'horseOwnPick')).seatId).toBe('Dana')
            await expect(panel(page).locator('.question-line')).toHaveText('Travel where? Free.')
            await expect(panel(page).getByRole('heading', { name: 'Brass Horse' })).toBeVisible()
            await expect(panel(page).getByRole('button', { name: /^Travel to / })).toHaveCount(0)
            expect(await litSlots(page)).toEqual([SLOTS.plains, SLOTS.hiddenPlace].sort())
            await expect(chipOf(page, SLOTS.plains)).toHaveCount(0)
            await expect(chipOf(page, SLOTS.hiddenPlace)).toHaveText(/^\s*\+\s*$/)
            await expect(
                chipOf(page, SLOTS.hiddenPlace).getByRole('img', { name: 'secret' })
            ).toHaveCount(1)
            await expect(
                siteAt(page, SLOTS.hiddenPlace).getByRole('button', {
                    name: 'The Hidden Place, flip 1 secret',
                    exact: true
                })
            ).toHaveCount(1)
            if (phone) {
                // Dana's region, the Provinces, has nothing to pick: the map opens on the Cradle.
                await expect(regionChip(page, 'Provinces')).toHaveCount(0)
                await expect(regionChip(page, 'Cradle')).toHaveAttribute('aria-pressed', 'true')
                await expect(regionChip(page, 'Cradle')).toHaveAccessibleName(
                    'Cradle: 1 to travel to'
                )
                await regionChip(page, 'Hinterland').tap()
                await expect.poll(() => framed(page, SLOTS.hiddenPlace)).toBe(true)
            }
            // The engine takes Dana there only with the flip (R-11.13-H1), so arriving shows it was sent.
            await press(page, SLOTS.hiddenPlace, phone)
            await expect
                .poll(async () => (await call(page, 'tableFacts')).siteOf.Dana)
                .toBe(SLOTS.hiddenPlace)
        })

        test('"Dana stays" under the line, label-sized, with the sites only the cards pay for lit', async ({
            page
        }) => {
            await openTable(page, 'woodStays')
            const line = panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)
            const stays = panel(page).getByRole('button', { name: /^Dana\s*stays$/ })
            await expect(stays).toBeVisible()
            expect(await litSlots(page)).toEqual([SLOTS.plains, SLOTS.hiddenPlace].sort())
            const [lineBox, button] = [await boxOf(page, line), await boxOf(page, stays)]
            expect(button.y).toBeGreaterThan(lineBox.y + lineBox.height - 1)
            if (phone) {
                expect(button.height).toBeGreaterThanOrEqual(44)
                expect(button.width).toBeLessThan(viewport.width * 0.5)
            }
        })

        test('Way Station’s question comes after the tap, in place, to the traveller', async ({
            page
        }) => {
            await openTable(page, 'woodWayStationPick')
            await expect(panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)).toBeVisible()
            if (phone) await expect.poll(() => framed(page, SLOTS.greatSlum)).toBe(true)
            await press(page, SLOTS.greatSlum, phone)
            await expect(panel(page).getByRole('heading', { name: 'Way Station' })).toBeVisible()
            await expect(panel(page).locator('.question-line')).toHaveText(
                /^Spend no Supply by giving\s*Ann\s*1\s*\?$/
            )
            const facts = await call(page, 'tableFacts')
            expect(facts.seatId).toBe('Dana')
            expect(facts.siteOf.Dana).toBe(SLOTS.wood)
            await expect(page.locator('.board-card.offered')).toHaveCount(0)
        })

        test('the seat that is not asked sees "Waiting on" and no lit site, and a tap sends nothing', async ({
            page
        }) => {
            await openTable(page, 'woodPickWhistle')
            const seat = await call(page, 'viewOffTheClock')
            expect(seat).toBeDefined()
            expect(seat).not.toBe('Bea')
            await expect(panel(page)).toContainText(/Waiting on\s*Bea\s*\./)
            expect(await litSlots(page)).toEqual([])
            await expect(regionChips(page)).toHaveCount(0)
            await siteCard(page, SLOTS.greatSlum).click({ force: true })
            expect((await call(page, 'tableFacts')).siteOf.Dana).toBe(SLOTS.wood)
            expect(await call(page, 'openQuestionKind')).toBe('shroudedWoodDestination')
        })
    })
}
