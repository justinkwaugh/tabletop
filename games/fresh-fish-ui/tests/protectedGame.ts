import { expect, type Locator, type Page } from '@playwright/test'

// Opens the protected harness game at its first disc placement, by click or by tap, and
// returns the id of the player to act.
export async function openProtectedGame(page: Page, press: 'click' | 'tap' = 'click') {
    await page.goto('/')
    const playerId: string = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/stores/tests/exploration.fixture.ts', location.href).href
        )
        return fixture.saveProtectedHarnessGame()
    })
    await page.reload()
    await page.getByRole('button', { name: 'Games', exact: true })[press]()
    await page.getByText('Protected Fresh Fish', { exact: true })[press]()
    await expect(page.getByText('Please place a disc', { exact: true })).toBeVisible()
    return playerId
}

export async function firstLegalCell(page: Page): Promise<Locator> {
    const cells = page.locator('.land .cell')
    const target = await cells.evaluateAll((elements) =>
        elements.findIndex((element) => element.classList.contains('cursor-pointer'))
    )
    return cells.nth(target)
}
