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

const SMALL_FRIENDS = 'denizen.beast.small-friends'
const BIRDSONG = 'denizen.beast.birdsong'
const RETURN = 'denizen.hearth.awaited-return'
const MASTER = 'denizen.arcane.master-of-disguise'
const SIGNAL = 'denizen.arcane.secret-signal'
const MAP_LIBRARY = 'denizen.arcane.map-library'
const OAK = 'denizen.beast.the-old-oak'

const panel = (page: Page) => page.locator('.panel')
const tile = (page: Page, label: string) =>
    panel(page).locator('.majors button').filter({ hasText: label })
const cardRow = (page: Page, cardId: string) => panel(page).locator(`[data-card-row="${cardId}"]`)
const cardToggle = (page: Page, cardId: string) =>
    cardRow(page, cardId).locator('button[aria-pressed]')
const picks = (page: Page, cardId: string) =>
    panel(page).locator(`[data-modifier-picks="${cardId}"]`)
const siteButtons = (page: Page) =>
    picks(page, SMALL_FRIENDS)
        .getByRole('group', { name: 'the site you act as if you are at:' })
        .getByRole('button')
const siteButton = (page: Page, name: string) =>
    picks(page, SMALL_FRIENDS).getByRole('button', { name, exact: true })
const trades = (page: Page) =>
    panel(page).getByRole('list', { name: 'Trades at your site' }).getByRole('listitem')
const tradeButton = (page: Page, name: RegExp) => panel(page).getByRole('button', { name })

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

/** Label-sized, sharing the widest's width, and 44 px tall on a phone. */
async function expectLabelSized(page: Page, buttons: Locator, phone: boolean) {
    const width = (await boxOf(panel(page))).width
    const boxes = await Promise.all((await buttons.all()).map(boxOf))
    expect(boxes.length).toBeGreaterThan(1)
    for (const box of boxes) {
        if (phone) expect(box.height).toBeGreaterThanOrEqual(44)
        expect(box.width).toBeLessThan(width / 2)
        expect(Math.abs(box.width - (boxes[0]?.width ?? 0))).toBeLessThanOrEqual(1)
    }
}

async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    await panel(page).screenshot({
        path: test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`)
    })
}

for (const { name, viewport, phone } of SIZES) {
    /**
     * Small Friends acts at one picked Beast site: Dana, at the Great Slums with Map Library, holds
     * Birdsong and Small Friends; Wolves are at the Plains and The Old Oak at the Mountain.
     */
    test.describe(`Small Friends' site in the Trade menu, on a ${name}`, () => {
        test.use({ viewport })

        test('turned on: its picker asks for the site, Map Library goes and the rows wait', async ({
            page
        }) => {
            await openTable(page, 'smallFriendsSites')
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('dana')
            await tile(page, 'Trade').click()
            // Without Small Friends in use, only the Great Slums' cards are rows.
            await expect(trades(page)).toHaveCount(3)
            await expect(tradeButton(page, /^Trade with Wolves:/)).toHaveCount(0)
            await expect(cardRow(page, MAP_LIBRARY)).toBeVisible()
            await cardToggle(page, SMALL_FRIENDS).click()
            await expect(cardToggle(page, SMALL_FRIENDS)).toHaveAttribute('aria-pressed', 'true')
            await expect(picks(page, SMALL_FRIENDS)).toContainText('Small Friends:')
            await expect(siteButtons(page)).toHaveText(['Plains', 'Mountain'])
            await expect(cardRow(page, MAP_LIBRARY)).toHaveCount(0)
            await expect(trades(page)).toHaveCount(0)
            await expectLabelSized(page, siteButtons(page), phone)
            await shot(page, 'small-friends-pick', phone)
        })

        test('the Plains picked: only the Wolves, 3 favor for a secret', async ({ page }) => {
            await openTable(page, 'smallFriendsSites')
            await tile(page, 'Trade').click()
            await cardToggle(page, SMALL_FRIENDS).click()
            await siteButton(page, 'Plains').click()
            await expect(siteButton(page, 'Plains')).toHaveAttribute('aria-pressed', 'true')
            await expect(trades(page)).toHaveCount(1)
            await expect(
                tradeButton(page, /^Trade with Wolves: pay 1 secret, get 3 favor/)
            ).toBeVisible()
            await expect(cardRow(page, OAK)).toHaveCount(0)
            await expect(cardToggle(page, BIRDSONG)).toHaveAttribute('aria-pressed', 'true')
            await shot(page, 'small-friends-plains', phone)
        })

        test("the Mountain picked: The Old Oak's row, and its modifier joins the Cards; one Undo puts Small Friends down with its pick", async ({
            page
        }) => {
            await openTable(page, 'smallFriendsSites')
            await tile(page, 'Trade').click()
            await cardToggle(page, SMALL_FRIENDS).click()
            await siteButton(page, 'Mountain').click()
            await expect(trades(page)).toHaveCount(1)
            await expect(tradeButton(page, /^Trade with The Old Oak:/)).toHaveCount(2)
            await expect(cardRow(page, OAK)).toBeVisible()
            await expect(cardToggle(page, OAK)).toHaveAttribute('aria-pressed', 'false')
            await shot(page, 'small-friends-mountain', phone)
            await page.getByRole('button', { name: 'Undo', exact: true }).click()
            await expect(cardToggle(page, SMALL_FRIENDS)).toHaveAttribute('aria-pressed', 'false')
            await expect(picks(page, SMALL_FRIENDS)).toHaveCount(0)
            await expect(trades(page)).toHaveCount(3)
            await expect(cardRow(page, OAK)).toHaveCount(0)
            await expect(cardRow(page, MAP_LIBRARY)).toBeVisible()
        })

        test('sends the Trade with the picked site', async ({ page }) => {
            await openTable(page, 'smallFriendsSites')
            await tile(page, 'Trade').click()
            await cardToggle(page, SMALL_FRIENDS).click()
            await siteButton(page, 'Plains').click()
            const favor = (await call(page, 'tableFacts')).favorBank.beast
            await tradeButton(page, /^Trade with Wolves: pay 1 secret, get 3 favor/).click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).favorBank.beast)
                .toBe(favor - 3)
        })
    })

    /**
     * Master of Disguise lists the borrowed advisers: Dana holds Birdsong, Awaited Return and
     * Master of Disguise; Ann, the Chancellor, holds Secret Signal and Marriage.
     */
    test.describe(`Master of Disguise's borrowed advisers in the Trade menu, on a ${name}`, () => {
        test.use({ viewport })

        test("Ann's Secret Signal is listed with their chip, Dana's other advisers go", async ({
            page
        }) => {
            await openTable(page, 'disguiseBorrowed')
            await tile(page, 'Trade').click()
            await expect(cardRow(page, SIGNAL)).toHaveCount(0)
            await cardToggle(page, MASTER).click()
            await expect(cardRow(page, SIGNAL)).toBeVisible()
            await expect(cardRow(page, SIGNAL).locator('[data-lender="ann"]')).toHaveText(/Ann/i)
            await expect(cardRow(page, MASTER).locator('[data-lender]')).toHaveCount(0)
            await expect(cardRow(page, BIRDSONG)).toHaveCount(0)
            await expect(cardRow(page, RETURN)).toHaveCount(0)
            await expect(
                tradeButton(page, /^Trade with Toll Roads: pay 1 secret, get 1 favor/)
            ).toBeVisible()
            await expect(
                tradeButton(page, /^Trade with Rowdy Pub: pay 1 secret, get 3 favor/)
            ).toBeVisible()
            await shot(page, 'disguise-borrowed', phone)
        })

        test('Secret Signal turned on: the one-favor trades gain two', async ({ page }) => {
            await openTable(page, 'disguiseBorrowed')
            await tile(page, 'Trade').click()
            await cardToggle(page, MASTER).click()
            await cardToggle(page, SIGNAL).click()
            await expect(cardToggle(page, SIGNAL)).toHaveAttribute('aria-pressed', 'true')
            await expect(
                tradeButton(page, /^Trade with Toll Roads: pay 1 secret, get 2 favor/)
            ).toBeVisible()
            await expect(
                tradeButton(page, /^Trade with Rowdy Pub: pay 1 secret, get 3 favor/)
            ).toBeVisible()
            await expect(
                tradeButton(page, /^Trade with Oracle: pay 1 secret, get 2 favor/)
            ).toBeVisible()
            await shot(page, 'disguise-signal', phone)
        })
    })
}
