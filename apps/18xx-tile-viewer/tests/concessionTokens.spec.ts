import { expect, test } from '@playwright/test'
import { TheOldPrinceCompanies } from '@tabletop/the-old-prince'

test('TOP concession icons and cards use the awarded company token and name', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('opening')
    const offers = page.getByRole('region', { name: 'Auction offers' })
    const seen = new Set<string>()
    for (let turn = 0; turn < 15 && seen.size < 2; turn++) {
        await expect(offers).toBeVisible()
        const concession = ['Mainline Concession', 'Shortline Concession'].find((name) => !seen.has(name))
        const preferred = offers.getByRole('button', { name: `Offer ${concession}`, exact: true })
        const offer = await preferred.count() ? preferred : offers.getByRole('button', { name: /^Offer / }).first()
        const name = (await offer.getAttribute('aria-label'))?.replace('Offer ', '')
        const isConcession = name === 'Mainline Concession' || name === 'Shortline Concession'
        const row = offers.getByRole('row').filter({ has: page.getByRole('button', { name: `Offer ${name}`, exact: true }) })
        let token: string | null = null
        let description = ''
        if (isConcession) {
            token = await row.locator('.lot-icon image').getAttribute('href')
            const tokenSvg = token?.startsWith('data:image/svg+xml;base64,')
                ? Buffer.from(token.split(',')[1], 'base64').toString('utf8')
                : ''
            const company = TheOldPrinceCompanies.find((entry) =>
                token?.includes(`/tokens/${entry.companyId}.svg`) || tokenSvg.includes(`aria-label="${entry.companyId}"`))
            if (!company) throw new Error('Concession requires a known company token')
            description = `Comes with the president’s certificate for ${company.name}.`
            await row.locator('button.name').click()
            const tooltip = page.getByRole('tooltip')
            await expect(tooltip.locator('.heading image')).toHaveAttribute('href', token ?? '')
            await expect(tooltip.locator('p')).toContainText(description)
            await page.keyboard.press('Escape')
        }
        await offer.click()
        const auction = page.getByRole('article', { name: 'Current auction' })
        await expect(auction).toBeVisible()
        if (isConcession && name) {
            await expect(auction.locator('.heading image')).toHaveAttribute('href', token ?? '')
            await expect(auction.locator('.private-card p')).toContainText(description)
            seen.add(name)
        }
        for (let bidder = 0; bidder < 2; bidder++) await auction.getByRole('button', { name: 'Pass', exact: true }).click()
    }
    expect([...seen].sort()).toEqual(['Mainline Concession', 'Shortline Concession'])
})
