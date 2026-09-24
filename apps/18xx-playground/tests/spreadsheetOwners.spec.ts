import { expect, test } from '@playwright/test'

test('TOP groups Union Bank under its controller without merging their holdings', async ({
    page
}) => {
    await page.goto('/table')
    await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
    const sheet = page.getByRole('table', { name: 'Company share ownership' })
    const bank = sheet.getByRole('row').filter({ has: page.locator('th[title="Union Bank"]') })
    await expect(bank.locator('xpath=preceding-sibling::tr[1]').getByRole('rowheader')).toHaveText(
        'Alex'
    )
    await expect(bank.getByRole('cell')).toHaveText(['1', '3P', '$40', '4', '—', '$390*'])
    await expect(
        sheet
            .getByRole('row')
            .filter({ has: page.getByRole('rowheader', { name: 'Alex', exact: true }) })
            .getByRole('cell')
    ).toHaveText(['3P', '1', '$240', '5', '5/20', '$1,072'])
    await expect(bank.getByRole('rowheader')).toHaveClass(/controlled-owner/)
    await expect(bank.locator('.included-net-worth')).toHaveCSS('color', 'rgb(127, 142, 158)')
    await expect(
        page.getByText(
            "* Union Bank's net worth is included in its controlling player's net worth.",
            { exact: true }
        )
    ).toBeVisible()
    for (const width of [1100, 390]) {
        await page.setViewportSize({ width, height: 900 })
        const player = sheet.getByRole('rowheader', { name: 'Alex', exact: true })
        await expect(player.locator('.color-dot')).toHaveCount(0)
        await expect(player).toHaveCSS('box-shadow', /inset/)
        const label = await player.locator('.player-label').boundingBox()
        const branch = await bank.getByRole('rowheader').evaluate((element) => ({
            left:
                element.getBoundingClientRect().left +
                parseFloat(getComputedStyle(element, '::before').left),
            padding: getComputedStyle(element).paddingLeft
        }))
        if (!label) throw new Error('Missing controlling player label')
        expect(branch.left).toBeGreaterThan(label.x)
        expect(branch.left).toBeLessThan(label.x + 12)
        expect(branch.padding).toBe('36px')
        await page.getByRole('button', { name: 'Swap rows and columns' }).click()
        const headers = sheet.getByRole('columnheader')
        await expect(headers.nth(1)).toHaveText('Alex')
        await expect(headers.nth(2)).toHaveAttribute('title', 'Union Bank')
        await expect(headers.nth(2).locator('.column-ownership-connector')).toBeVisible()
        const outgoing = await headers.nth(1).locator('.outgoing').boundingBox()
        const incoming = await headers.nth(2).locator('.incoming').boundingBox()
        const playerLabel = await headers.nth(1).locator('.column-owner-label').boundingBox()
        const bankLabel = await headers.nth(2).locator('.column-owner-label').boundingBox()
        if (!outgoing || !incoming || !playerLabel || !bankLabel)
            throw new Error('Missing ownership header connection')
        expect(outgoing.x + outgoing.width).toBeCloseTo(incoming.x, 0)
        expect(outgoing.y).toBeCloseTo(incoming.y, 0)
        expect(playerLabel.y).toBe(bankLabel.y)
        expect(playerLabel.height).toBe(bankLabel.height)
        await expect(sheet.locator('.included-net-worth')).toHaveText('$390*')
        await page.getByRole('button', { name: 'Swap rows and columns' }).click()
        await expect(bank.getByRole('cell')).toHaveText(['1', '3P', '$40', '4', '—', '$390*'])
    }
})

test('1889 retains player order without corporate ownership connectors', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
    const sheet = page.getByRole('table', { name: 'Company share ownership' })
    await expect(sheet.getByRole('rowheader').nth(0)).toHaveText('Alex')
    await expect(sheet.getByRole('rowheader').nth(1)).toHaveText('Blair')
    await expect(sheet.getByRole('rowheader').nth(2)).toHaveText('Casey')
    await expect(sheet.locator('.controlled-owner, .ownership-continues')).toHaveCount(0)
})
