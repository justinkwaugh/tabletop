import { expect, test } from '@playwright/test'
for (const width of [1280, 390]) {
    test(`stages company and price choices and restores company starts at ${width}px`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/economy')
        await page.getByLabel('Example position').selectOption('starting')
        const trading = page.getByRole('region', { name: 'Stock trading', exact: true })
        const choose = () =>
            page.locator('[data-start-company="A"][data-start-buyer="player"]').click()
        await choose()
        await page.locator('[data-start-price="80"]').click()
        await expect(trading).toContainText('Alex pays 160 to Bank.')
        await trading.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(trading.getByRole('button', { name: 'Confirm start' })).toHaveCount(0)
        await expect(page.locator('[data-start-price="80"]')).toBeVisible()
        await trading.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(
            page.locator('[data-start-company="A"][data-start-buyer="player"]')
        ).toBeVisible()
        await choose()
        await page.locator('[data-start-price="74"]').click()
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(
            page.locator('[data-start-company="A"][data-start-buyer="player"]')
        ).toBeVisible()
        await page.locator('[data-start-company="A"][data-start-buyer="UB"]').click()
        await page.locator('[data-start-price="80"]').click()
        await expect(trading).toContainText('Union Bank pays 40 to Bank.')
        await expect(trading).toContainText('Alex pays 120 to Bank.')
        await trading.getByRole('button', { name: 'Confirm start' }).click()
        await expect(page.locator('[data-company-id="A"]')).toContainText('President: Union Bank')
        await expect(page.locator('[data-company-lifecycle="A"]')).toHaveText(
            'Started · Not funded · Not floated · Not operated'
        )
        await expect(page.getByRole('region', { name: 'Company tranches' })).toContainText(
            'Tranche 1: A (1/1)'
        )
        await page.reload()
        await page.getByLabel('Example position').selectOption('starting')
        await expect(page.locator('[data-company-id="A"]')).toContainText('President: Union Bank')
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(page.locator('[data-company-lifecycle="A"]')).toContainText('Not started')
        await expect(
            page.getByRole('article', { name: 'Alex portfolio', exact: true })
        ).toContainText('Cash 240')
        await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.locator('[data-start-company="SR"]').click()
        await page.locator('[data-start-price="65"]').click()
        await trading.getByRole('button', { name: 'Confirm start' }).click()
        await expect(page.locator('[data-company-id="SR"]')).toContainText('President: Alex')
        await expect(page.locator('[data-company-id="SR"]')).toContainText('Reserved home: I2')
        await expect(
            page.getByRole('article', { name: 'Alex portfolio', exact: true })
        ).toContainText('Cash 110')
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            .toBe(true)
        expect(errors).toEqual([])
    })
    test(`floats both titles and undoes the complete purchase cascade at ${width}px`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/economy')
        await page.getByLabel('Example position').selectOption('flotation')
        const trading = page.getByRole('region', { name: 'Stock trading', exact: true })
        const alex = page.getByRole('article', { name: 'Alex portfolio', exact: true })
        await page.locator('[data-purchase-certificate="A:share:4"][data-buyer="player"]').click()
        await expect(trading).toContainText('Alberton will float.')
        await expect(trading).toContainText('Bank pays 800 to Alberton as initial capital.')
        await trading.getByRole('button', { name: 'Confirm purchase' }).click()
        await expect(page.locator('[data-company-lifecycle="A"]')).toHaveText(
            'Started · Funded · Floated · Not operated'
        )
        await expect(
            page.getByRole('article', { name: 'Alberton treasury', exact: true })
        ).toContainText('Cash 800')
        await expect(page.locator('[data-station-id="A:home"]')).toContainText('D6')
        await expect(alex.locator('[data-certificate-id="PEIR:share:1"]')).toHaveCount(0)
        await expect(alex).toContainText('Cash 160')
        await expect(page.getByRole('list', { name: 'Stock history' })).toContainText(
            'Alberton floated.'
        )
        await page.reload()
        await page.getByLabel('Example position').selectOption('flotation')
        await expect(page.locator('[data-company-lifecycle="A"]')).toContainText('Funded · Floated')
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(page.locator('[data-company-lifecycle="A"]')).toContainText(
            'Not funded · Not floated'
        )
        await expect(alex).toContainText('Cash 240')
        await expect(alex.locator('[data-certificate-id="PEIR:share:1"]')).toBeVisible()
        await expect(page.locator('[data-station-id="PEIR:A"]')).toContainText('D6')
        await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.locator('[data-purchase-certificate="SR:share:3"]').click()
        await expect(trading).toContainText('Bank pays 650 to Sanuki Railway as initial capital.')
        await trading.getByRole('button', { name: 'Confirm purchase' }).click()
        await expect(
            page.getByRole('article', { name: 'Sanuki Railway treasury', exact: true })
        ).toContainText('Cash 650')
        await expect(page.locator('[data-company-id="SR"]')).toContainText('Reserved home: I2')
        await expect(page.locator('[data-station-id="SR:home"]')).toHaveCount(0)
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(page.locator('[data-company-lifecycle="SR"]')).toContainText(
            'Not funded · Not floated'
        )
        await expect(alex).toContainText('Cash 240')
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            .toBe(true)
        expect(errors).toEqual([])
    })
}
