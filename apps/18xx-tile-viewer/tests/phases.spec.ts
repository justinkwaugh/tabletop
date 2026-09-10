import { expect, test } from '@playwright/test'
for (const title of ['TOP', '1889']) {
    test(`${title} suspends purchases for discards and restores the exact continuation after reload and Undo`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('phases')
        const trains = page.getByRole('region', { name: 'Train purchases', exact: true })
        const phase = page.getByRole('region', { name: 'Phase changes', exact: true })
        const discard = phase.getByLabel('Compulsory train discard')
        const map = page.getByRole('region', { name: 'Game map', exact: true })
        const rank = title === 'TOP' ? '2+' : '5',
            initialPhase = title === 'TOP' ? '6H' : '4'
        await trains.getByRole('button', { name: `Select ${rank}`, exact: true }).click()
        await expect(trains.getByLabel('Train purchase preview')).toContainText(
            `Phase ${initialPhase} → ${rank}`
        )
        await trains.getByRole('button', { name: 'Confirm train purchase', exact: true }).click()
        await expect(discard).toBeVisible()
        await expect(discard).toContainText(
            title === 'TOP' ? 'Blair decides. Then Charlottetown' : 'Blair decides. Then Iyo'
        )
        await expect(
            trains.getByRole('button', { name: 'Finish operating turn', exact: true })
        ).toBeDisabled()
        await discard
            .getByRole('button', { name: /^Discard / })
            .first()
            .click()
        await discard.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(
            discard.getByRole('button', { name: 'Confirm discard', exact: true })
        ).toHaveCount(0)
        await discard
            .getByRole('button', { name: /^Discard / })
            .first()
            .click()
        await discard.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(
            discard.getByRole('button', { name: 'Confirm discard', exact: true })
        ).toHaveCount(0)
        await expect(phase.getByLabel('Phase history').locator('li')).toHaveCount(1)
        await discard
            .getByRole('button', { name: /^Discard / })
            .first()
            .click()
        await map.getByRole('button', { name: 'Beginning', exact: true }).click()
        await expect(discard).toHaveCount(0)
        await map.getByRole('button', { name: 'Live', exact: true }).click()
        await expect(
            discard.getByRole('button', { name: 'Confirm discard', exact: true })
        ).toHaveCount(0)
        await page.reload()
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('phases')
        await expect(discard).toBeVisible()
        for (let index = 0; index < (title === 'TOP' ? 1 : 2); index++) {
            if (title === '1889' && index === 1)
                await expect(discard).toContainText('Alex decides. Then Iyo')
            await discard
                .getByRole('button', { name: /^Discard / })
                .first()
                .click()
            await discard.getByRole('button', { name: 'Confirm discard', exact: true }).click()
        }
        await expect(discard).toHaveCount(0)
        await expect(
            trains.getByRole('button', { name: 'Finish operating turn', exact: true })
        ).toBeEnabled()
        await trains.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(discard).toBeVisible()
        if (title === '1889')
            await discard.getByRole('button', { name: 'Undo', exact: true }).click()
        await discard.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(discard).toHaveCount(0)
        await expect(phase.getByLabel('Phase history')).toHaveCount(0)
        await expect(
            trains.getByRole('button', { name: `Select ${rank}`, exact: true })
        ).toBeEnabled()
        expect(errors).toEqual([])
    })
}
test('1889 exchanges a train for a diesel at capacity, with staged Back and Undo', async ({
    page
}) => {
    await page.goto('/economy')
    await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
    await page.getByLabel('Example position').selectOption('diesel')
    const trains = page.getByRole('region', { name: 'Train purchases', exact: true })
    const phase = page.getByRole('region', { name: 'Phase changes', exact: true })
    await expect(trains.getByRole('button', { name: 'Select Diesel', exact: true })).toBeDisabled()
    const exchange = trains.getByRole('button', { name: /Exchange .*\/4\/.* for Diesel/ })
    await exchange.click()
    await expect(trains.getByLabel('Train purchase preview')).toContainText('$800')
    await trains.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(trains.getByLabel('Train purchase preview')).toHaveCount(0)
    await exchange.click()
    await trains.getByRole('button', { name: 'Confirm train purchase', exact: true }).click()
    await expect(trains).toContainText('Treasury: $600')
    await expect(phase.getByLabel('Phase history')).toContainText('Phase 6 → D')
    await expect(phase.getByLabel('Phase history')).toContainText('Rusted:')
    await trains.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(trains).toContainText('Treasury: $1400')
    await expect(phase.getByLabel('Phase history')).toHaveCount(0)
    await expect(exchange).toBeEnabled()
})
test('TOP distinguishes used 4+ trains from those awaiting one final operation', async ({
    page
}) => {
    await page.goto('/economy')
    await page.getByLabel('Example position').selectOption('diesel')
    const trains = page.getByRole('region', { name: 'Train purchases', exact: true })
    await trains.getByRole('button', { name: 'Select Diesel', exact: true }).click()
    await trains.getByRole('button', { name: 'Confirm train purchase', exact: true }).click()
    await expect(trains.locator('[data-train-roster="ML"]')).toContainText(
        'Rusts after this operation; cannot trade'
    )
    await expect(trains.locator('[data-train-roster="So"]')).toHaveCount(0)
    await trains.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(trains.locator('[data-train-roster="So"]')).toContainText('4+')
    await expect(trains).not.toContainText('Rusts after this operation; cannot trade')
})
