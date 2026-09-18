import { expect, test } from '@playwright/test'

test('keeps history descriptions aligned when jumping from the beginning to the end', async ({
    page
}) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history', exact: true })
    await expect(history).toContainText('Ran', { timeout: 30000 })
    await page.getByRole('button', { name: 'goto my last turn', exact: true }).click()
    await expect(history).not.toContainText('Ran')
    await page.getByRole('button', { name: 'go to current', exact: true }).click()
    await expect(history).toContainText('Ran')
    expect(errors).toEqual([])
})
