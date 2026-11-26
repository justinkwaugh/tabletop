import { expect, test, type Page } from '@playwright/test'
import { PieceKind } from '@tabletop/punct'
import { expectNoErrors, openScenario, settle, undoButton, watchErrors } from './harness.js'

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

const lines = (page: Page) => page.locator('.win-line path')
const dots = (page: Page) => page.locator('.centre-win')

// Once landed, a mark stands whole: the line has no dash left over from its draw.
async function expectLineDrawn(page: Page) {
    await expect(lines(page)).toHaveCount(2)
    for (const path of await lines(page).all()) {
        await expect(path).not.toHaveAttribute('stroke-dasharray')
        await expect(path).not.toHaveAttribute('visibility')
    }
}

async function confirm(page: Page) {
    await page.evaluate(() => window.punctSession.confirm())
    await settle(page)
}

// The mark leaves on Undo and on a history step back, and returns on a step forward.
async function expectMarkFollowsSteps(page: Page, expectMarked: () => Promise<void>) {
    await undoButton(page).click()
    await settle(page)
    await expect(lines(page)).toHaveCount(0)
    await expect(dots(page)).toHaveCount(0)

    await confirm(page)
    await expectMarked()

    await page.getByRole('button', { name: 'step backwards' }).click()
    await settle(page)
    await expect(lines(page)).toHaveCount(0)
    await expect(dots(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'step forward' }).click()
    await settle(page)
    await expectMarked()
}

test('a connection draws its line, which follows Undo and history', async ({ page }) => {
    await openScenario(page, 'One from a connection')
    await page.evaluate((kind) => {
        window.punctSession.chooseKind(kind)
        window.punctSession.chooseSpace({ q: -5, r: 1 })
    }, PieceKind.StraightEnd)
    await expect
        .poll(async () => {
            const rotation = await page.evaluate(() => window.punctSession.staged?.rotation)
            if (rotation !== 2) await page.evaluate(() => window.punctSession.turnStaged())
            return rotation
        })
        .toBe(2)
    await expect(lines(page)).toHaveCount(0)
    await confirm(page)
    await expectLineDrawn(page)
    await expect(dots(page)).toHaveCount(0)
    await expectMarkFollowsSteps(page, () => expectLineDrawn(page))
})

test('a centre count marks the winner’s central spaces, which follow Undo and history', async ({
    page
}) => {
    await openScenario(page, 'Last piece')
    await page.evaluate(() => {
        const session = window.punctSession
        const [kind] = session.gameState.kindsInReserve('player-1')
        const [entry] = session.gameState.entriesOf('player-1', kind)
        session.chooseKind(kind)
        session.chooseSpace(entry.punct)
    })
    await expect(dots(page)).toHaveCount(0)
    await confirm(page)
    const centre = await page.evaluate(() =>
        window.punctSession.gameState.board.centreCount('player-1')
    )
    const expectDots = async () => {
        await expect(dots(page)).toHaveCount(centre)
        await expect(lines(page)).toHaveCount(0)
    }
    await expectDots()
    await expectMarkFollowsSteps(page, expectDots)
})
