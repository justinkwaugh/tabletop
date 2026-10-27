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

const history = (page: Page) => page.locator('.history')
const card = (page: Page) => history(page).locator('article.major-event')
const ledger = (page: Page) => card(page).locator('[data-campaign-ledger]')
const rows = (page: Page) => history(page).locator('ol > div')

async function rightOf(locator: Locator): Promise<number> {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is not drawn')
    return box.x + box.width
}

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

for (const { name, viewport, phone } of SIZES) {
    /**
     * R-5.5 — Dana campaigns against Rhys at the Plains: 9 dice (Bear Traps −1) against 5, a
     * sacrifice wins 10 to 9, and Dana takes the spoils. The card that closes it carries the ledger;
     * every step stays a row below it.
     */
    test.describe(`a Campaign's ledger in History, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('the "Campaign won" card: the result, each side, the dice as rolled and the defense made up', async ({
            page
        }) => {
            await openTable(page, 'campaignLedger')
            await page.getByRole('tab', { name: 'History' }).click()
            await expect(card(page)).toHaveCount(1)
            await expect(card(page)).toHaveAttribute('data-major-event', 'campaignWon')
            await expect(ledger(page)).toContainText(
                /you\s*against\s*Rhys\s*at Plains: 10 attack to 9 defense\./i
            )
            await expect(ledger(page)).toContainText('10 (Plains +1); 9 rolled (Bear Traps −1):')
            await expect(ledger(page)).toContainText('5 (Plains 1, Cup of Plenty 2, pawn 2):')
            await expect(ledger(page)).toContainText(/3\s* doubled to 6, \+ 3\s*: 9 defense/)
            await expect(ledger(page)).toContainText(/Bear Traps: killed 1\s*on\s*your\s*board/)
            await expect(ledger(page)).toContainText(
                /4\s*: 2 to skulls, 1 to Bear Traps, 1 sacrificed/
            )
            await expect(ledger(page)).toContainText(/Plains \(2\s*placed\), Cup of Plenty, 3/)
            // R-5.5.6 — nobody was asked to pick the loss; the force as rolled says where it fell.
            await expect(ledger(page)).toContainText(
                /1\s*killed at Plains, Plains, Cup of Plenty, 2\s*; banished to River/
            )
            await expect(ledger(page).locator('.campaign-ledger__die')).toHaveCount(14)
            await expect(card(page).getByRole('button')).toHaveCount(0)
            await expect(card(page)).not.toContainText('From')
        })

        test('every step stays a row below the card, the spoils too, unfolded', async ({
            page
        }) => {
            await openTable(page, 'campaignLedger')
            await page.getByRole('tab', { name: 'History' }).click()
            await expect(card(page)).toBeVisible()
            await expect(card(page)).not.toContainText('took the spoils')
            const texts = await rows(page).allInnerTexts()
            const at = (pattern: RegExp) => texts.findIndex((text) => pattern.test(text))
            const order = [
                at(/Campaign won/i),
                at(/took the spoils/),
                at(/sacrificed 1/),
                at(/used Bear Traps; 9 swords against 9 defense;\s*you\s*lost 2\s*to skulls/i),
                at(/campaigned against/)
            ]
            expect(
                order.every((index) => index >= 0),
                texts.join(' | ')
            ).toBe(true)
            expect([...order].sort((a, b) => a - b)).toEqual(order)
            await expect(history(page).getByRole('button', { name: /steps/i })).toHaveCount(0)
        })

        test('History stays 320 px wide and nothing in it runs past its edge or the screen', async ({
            page
        }) => {
            await openTable(page, 'campaignLedger')
            await page.getByRole('tab', { name: 'History' }).click()
            await expect(ledger(page)).toBeVisible()
            const panel = await history(page).boundingBox()
            if (!panel) throw Error('History is not drawn')
            expect(Math.round(panel.width)).toBe(320)
            const edge = panel.x + panel.width
            for (const part of await ledger(page).locator('*').all()) {
                if (await part.isVisible())
                    expect(await rightOf(part)).toBeLessThanOrEqual(edge + 0.5)
            }
            const overflowing = await history(page).evaluate(
                (element) =>
                    [...element.querySelectorAll('*')].filter(
                        (child) =>
                            child.scrollWidth > child.clientWidth + 1 &&
                            getComputedStyle(child).overflowX !== 'visible'
                    ).length
            )
            expect(overflowing).toBe(0)
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth)
            ).toBeLessThanOrEqual(viewport.width)
            await history(page).screenshot({
                path: test.info().outputPath(`campaign-ledger-${name}.png`)
            })
        })

        test('R-5.5.6.a — losses Rhys picked read where they were killed, on the card and the row', async ({
            page
        }) => {
            await openTable(page, 'campaignLedgerPicked')
            await page.getByRole('tab', { name: 'History' }).click()
            await expect(ledger(page)).toContainText(
                /1\s*killed at Plains, Plains, Cup of Plenty, 2\s*; banished to River/
            )
            await expect(ledger(page).locator('.campaign-ledger__die')).toHaveCount(0)
            await expect(history(page)).toContainText(
                /picked the defense's losses: 1\s*killed at Plains/
            )
        })

        test('a lost Campaign: the "Campaign lost" card with the attacker’s losses, its sacrifice a row below', async ({
            page
        }) => {
            await openTable(page, 'campaignLedgerLost')
            await page.getByRole('tab', { name: 'History' }).click()
            await expect(card(page)).toHaveAttribute('data-major-event', 'campaignLost')
            await expect(ledger(page)).toContainText(/9 attack to 9 defense\./)
            await expect(ledger(page)).not.toContainText('Gained')
            await expect(card(page)).not.toContainText('lost the battle')
            await expect(history(page)).toContainText('lost the battle')
        })
    })
}
