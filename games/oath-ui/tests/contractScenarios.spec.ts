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

async function pressAndHold(page: Page, x: number, y: number) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await page.waitForTimeout(600)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function holdCard(page: Page, card: ReturnType<Page['locator']>) {
    const box = await card.boundingBox()
    if (!box) throw Error('The card is on screen')
    await pressAndHold(page, box.x + box.width / 2, box.y + box.height / 2)
}

const preview = (page: Page) => page.locator('.card-preview')
const panelCards = (page: Page) =>
    page.locator('.panel').getByRole('button').filter({ hasNotText: /Back|Undo/ })

/** docs/ui-interaction-visual-contract.md, scenario 7 (touch half). */
test.describe('on touch', () => {
    test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } })

    test('scenario 7: a hold on a pickable card keeps its preview open and picks nothing; the next tap closes it', async ({
        page
    }) => {
        await openTable(page, 'setup')
        await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
        await holdCard(page, panelCards(page).first())
        await expect(preview(page)).toBeVisible()
        await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()

        await page.touchscreen.tap(20, 20)
        await expect(preview(page)).toHaveCount(0)
        await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
    })

    test('scenario 24: a preview held open closes when its card leaves the table, and the new offers show with no ring left over', async ({
        page
    }) => {
        await openTable(page, 'setup')
        await holdCard(page, panelCards(page).first())
        await expect(preview(page)).toBeVisible()

        await call(page, 'seatMakesSetupChoice')
        await expect(preview(page)).toHaveCount(0)
        await expect(page.getByText('Tap the site where your pawn starts', { exact: false })).toBeVisible()
        await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0)
    })

    test('scenario 24: a preview held open over a card still on the table stays, while the picks under it end', async ({
        page
    }) => {
        await openTable(page, 'searching')
        await panelCards(page).first().tap()
        await expect(page.getByText('How do you play it?', { exact: false })).toBeVisible()
        await page.locator('.board-card:not(.pickable)').first().tap()
        await expect(preview(page)).toBeVisible()

        await call(page, 'anotherSeatLetsPeek')
        await expect(preview(page)).toBeVisible()
        expect(await call(page, 'searchPicks')).toEqual({})
    })
})

/** Scenario 25: another seat's Action processed mid-pick, as a Search is under way. */
test('scenario 25: another seat acting mid-pick starts the Search panel again with nothing picked', async ({
    page
}) => {
    await openTable(page, 'searching')
    await panelCards(page).first().click()
    await page.getByRole('button', { name: 'Discard it', exact: true }).click()
    await expect(page.getByText('Tap the card that is discarded first', { exact: false })).toBeVisible()
    expect((await call(page, 'searchPicks')).placement).toBe('discard')

    await call(page, 'anotherSeatLetsPeek')
    expect(await call(page, 'searchPicks')).toEqual({})
    await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
})

/** Scenario 16: a second question after the first starts with nothing picked. */
test('scenario 16: after one False Prophet question is answered, the next offers the same advisers with none picked', async ({
    page
}) => {
    await openTable(page, 'prophets')
    const row = page.getByText('tap the adviser to discard', { exact: false }).locator('..')
    await row.getByRole('button').first().click()
    const picked = await call(page, 'questionPicks')
    expect(picked.visionDiscard).toBeDefined()
    expect(picked.queued).toBe(2)

    await page.getByRole('button', { name: 'Discard it', exact: true }).click()
    await expect.poll(async () => (await call(page, 'questionPicks')).queued).toBe(1)
    const next = await call(page, 'questionPicks')
    expect(next.visionDiscard).toBeUndefined()
    expect(next.offered).toEqual(picked.offered)
    await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0)
})

/** Coexistence: off the clock the seat card's Let another peek opens the picker alone. */
test('let another peek off the clock: the seat card opens the picker and stages nothing', async ({
    page
}) => {
    await openTable(page, 'offTurn')
    expect(await call(page, 'viewOffTheClock')).toBe('me')
    await page.getByRole('button', { name: 'Let another peek', exact: true }).click()
    expect(await call(page, 'letPeekState')).toEqual({ open: true, staged: false })
})

test('the fixture opens the Chancellor setup with the hand offered', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openTable(page, 'setup')
    await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
    expect(errors).toEqual([])
})
