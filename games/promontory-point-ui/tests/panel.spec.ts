import { expect, test, type Locator, type Page } from '@playwright/test'
import { WIDTHS, openTable, placeOnOpenCountry, sharesHeading } from './support/table.js'

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function createGame(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Panel')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.locator('svg.board')).toBeVisible()
}

const enlarged = (page: Page) => page.locator('[data-enlarged-view]')

test('contract, "The principle": a share face in the turn panel enlarges, and the press buys nothing', async ({
    page
}) => {
    await createGame(page)
    const heading = page.locator('.pp-block-heading').filter({ hasText: 'Shares ·' })
    await expect(heading).toHaveText('Shares · 2 actions left')
    await page.getByRole('button', { name: 'Enlarge the Union Pacific share' }).first().click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged-view', 'Share')
    await expect(enlarged(page).getByRole('img')).toHaveAttribute('alt', 'Union Pacific share')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)
    await expect(heading).toHaveText('Shares · 2 actions left')
})

async function boxOf(locator: Locator) {
    const box = await locator.boundingBox()
    if (box === null) throw Error('The element has a box')
    return box
}

// Every button wholly above the share block, the row of them centred in the action area.
async function expectCentredAboveShares(page: Page, buttons: Locator[]) {
    const area = await boxOf(page.locator('.action-area'))
    const shares = await boxOf(
        page.locator('.action-area .pp-block').filter({ has: sharesHeading(page) })
    )
    const boxes = await Promise.all(buttons.map(boxOf))
    const left = Math.min(...boxes.map((box) => box.x))
    const right = Math.max(...boxes.map((box) => box.x + box.width))
    for (const box of boxes) expect(box.y + box.height).toBeLessThanOrEqual(shares.y)
    expect(Math.abs((left + right) / 2 - (area.x + area.width / 2))).toBeLessThanOrEqual(2)
}

// Contract, "After the third placement": End turn, or the variant's Keep and Return pair, is
// centred above the share block at both widths.
for (const width of WIDTHS) {
    test.describe(width.name, () => {
        test.use(width.use)

        test('contract, "After the third placement": End turn sits above the share block, centred in the panel', async ({
            page
        }) => {
            await openTable(page, 'Pieces placed')
            const endTurn = page.getByRole('button', { name: 'End turn · draw 3', exact: true })
            await expect(endTurn).toBeVisible()
            await expectCentredAboveShares(page, [endTurn])
        })

        test('contract, "After the third placement": the variant’s Keep and Return pair sits above the share block, centred', async ({
            page
        }) => {
            await openTable(page, 'Variant opening turn')
            await placeOnOpenCountry(page, 'CP')
            await placeOnOpenCountry(page, 'UP')
            await placeOnOpenCountry(page, 'KP')
            const keep = page.getByRole('button', { name: 'Keep SP · draw 3', exact: true })
            const back = page.getByRole('button', { name: 'Return it · draw 4', exact: true })
            await expect(keep).toBeVisible()
            await expectCentredAboveShares(page, [keep, back])
        })
    })
}
