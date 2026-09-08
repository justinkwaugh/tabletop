import { expect, test, type Page } from '@playwright/test'
import { MachineState } from '@tabletop/estates'
import { createGame, inspectScene } from './helpers'

async function selectActivePlayer(page: Page) {
    const playerId = await page.evaluate(() => window.estatesSession.gameState.activePlayerIds[0])
    await page.getByLabel('Protected view', { exact: true }).selectOption(playerId)
    await expect.poll(() => page.evaluate(() => window.estatesSession.myPlayer?.id)).toBe(playerId)
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.roofs.items.length))
        .toBe(0)
    await expect.poll(() => page.evaluate(() => window.estatesSession.busy)).toBe(false)
}

async function enableProtectedMode(page: Page) {
    await page.getByRole('button', { name: 'Options', exact: true }).click()
    await page.getByText('Protected mode', { exact: true }).click()
    await page.getByRole('button', { name: 'Options', exact: true }).click()
}

async function passAuction(page: Page) {
    while (
        await page.evaluate(
            (state) => window.estatesSession.gameState.machineState === state,
            MachineState.Auctioning
        )
    ) {
        await selectActivePlayer(page)
        const before = await page.evaluate(() => window.estatesSession.gameState.actionCount)
        await page.getByRole('button', { name: 'Pass', exact: true }).click()
        await expect
            .poll(() => page.evaluate(() => window.estatesSession.gameState.actionCount))
            .toBeGreaterThan(before)
    }
}

test('protected money and roofs survive perspective changes, auctions and draws', async ({
    page
}) => {
    test.setTimeout(120_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await inspectScene(page)
    await createGame(page, 'Protected Estates', true)
    await expect(page.getByRole('button', { name: 'start exploring', exact: true })).toBeDisabled()
    await enableProtectedMode(page)
    await selectActivePlayer(page)
    const visible = () =>
        page.evaluate(() => {
            const s = window.estatesSession
            return {
                roofs: s.gameState.roofs.items.length,
                money: s.gameState.players
                    .filter((p) => p.money !== undefined)
                    .map((p) => p.playerId),
                mine: s.myPlayer?.id
            }
        })
    await expect
        .poll(async () => {
            const state = await visible()
            return state.roofs === 0 && state.money.length === 1 && state.money[0] === state.mine
        })
        .toBe(true)
    await expect(page.getByText('$12', { exact: true })).toHaveCount(1)
    await page.getByRole('button', { name: 'Steal $1 First', exact: true }).click()
    await expect(page.getByText('$11', { exact: true })).toBeVisible()
    for (const width of [600, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(page.getByText('$11', { exact: true })).toBeVisible()
        await expect(page.getByText('$12', { exact: true })).toHaveCount(0)
        await expect(page.getByText('$undefined', { exact: true })).toHaveCount(0)
    }
    await page.getByLabel('Protected view', { exact: true }).selectOption('host')
    await expect.poll(async () => (await visible()).roofs).toBe(12)
    await expect.poll(async () => (await visible()).money.length).toBe(4)
    await expect(page.getByRole('button', { name: 'start exploring', exact: true })).toBeDisabled()
    await page.getByLabel('Protected view', { exact: true }).selectOption('spectator')
    await expect.poll(async () => (await visible()).roofs).toBe(0)
    await expect.poll(async () => (await visible()).money.length).toBe(0)
    await expect(page.getByRole('button', { name: 'start exploring', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Steal $1 First', exact: true })).toHaveCount(0)
    await selectActivePlayer(page)
    await page.evaluate(async () => {
        const s = window.estatesSession
        const coords = s.gameState.placeableCubes()[0]
        const cube = s.gameState.cubes[coords.row][coords.col]
        if (!cube) throw new Error('Expected an offered cube')
        await s.startAuction(cube)
    })
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.machineState))
        .toBe(MachineState.Auctioning)
    await passAuction(page)
    await selectActivePlayer(page)
    await page.evaluate(async () => {
        const s = window.estatesSession
        const cube = s.gameState.chosenPiece
        if (!cube || !('company' in cube)) throw new Error('Expected the auctioned cube')
        await s.placeCube(cube, s.gameState.board.validCubeLocations(cube)[0])
    })
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.machineState))
        .toBe(MachineState.StartOfTurn)
    await selectActivePlayer(page)
    await page.evaluate(async () => {
        await window.estatesSession.drawRoof(0)
    })
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.roofs.remaining))
        .toBe(11)
    await expect.poll(async () => (await visible()).roofs).toBe(0)
    await expect
        .poll(() =>
            page.evaluate(() => {
                const text = window.estatesPreview.getObjectByName('roofText')
                return text && 'text' in text ? Number(text.text) : undefined
            })
        )
        .toBe(
            await page.evaluate(() => {
                const roof = window.estatesSession.gameState.chosenPiece
                return roof && 'value' in roof ? roof.value : undefined
            })
        )
    await passAuction(page)
    await selectActivePlayer(page)
    await page.evaluate(async () => {
        const s = window.estatesSession
        const roof = s.gameState.chosenPiece
        if (!roof || roof.pieceType !== 'roof') throw new Error('Expected the drawn roof')
        await s.placeRoof(roof, s.gameState.board.validRoofLocations()[0])
    })
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.machineState))
        .toBe(MachineState.StartOfTurn)
    const primaryCount = await page.evaluate(() => window.estatesSession.gameState.actionCount)
    await expect(page.getByRole('button', { name: 'start exploring', exact: true })).toBeDisabled()
    await page.evaluate(async () => {
        await window.estatesSession.startExploring()
    })
    expect(await page.evaluate(() => window.estatesSession.isExploring)).toBe(false)
    expect((await visible()).roofs).toBe(0)
    expect((await visible()).money.length).toBe(1)
    expect(await page.evaluate(() => window.estatesSession.gameState.actionCount)).toBe(
        primaryCount
    )
    expect(errors).toEqual([])
})

test('a protected bidder with no money must pass manually', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await inspectScene(page)
    await createGame(page, 'Penniless bidder', true)
    await page.evaluate(async () => {
        const s = window.estatesSession
        const state = s.gameState.dehydrate()
        for (const player of state.players) {
            if (player.playerId !== state.activePlayerIds[0]) player.money = 0
        }
        await s.setGameState(state)
    })
    await enableProtectedMode(page)
    await selectActivePlayer(page)
    await page.evaluate(async () => {
        const s = window.estatesSession
        const coords = s.gameState.placeableCubes()[0]
        const cube = s.gameState.cubes[coords.row][coords.col]
        if (!cube) throw Error('Expected an offered cube')
        await s.startAuction(cube)
    })
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.machineState))
        .toBe(MachineState.Auctioning)
    await selectActivePlayer(page)
    const before = await page.evaluate(() => ({
        count: window.estatesSession.gameState.actionCount,
        bidder: window.estatesSession.myPlayer?.id
    }))
    await expect(page.getByText('You can only pass', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bid', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Pass', exact: true })).toBeEnabled()
    await page.setViewportSize({ width: 600, height: 900 })
    await expect(page.getByText('You can only pass', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bid', exact: true })).toBeDisabled()
    expect(await page.evaluate(() => window.estatesSession.gameState.actionCount)).toBe(
        before.count
    )
    await page.getByRole('button', { name: 'Pass', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.activePlayerIds[0]))
        .not.toBe(before.bidder)
    expect(await page.evaluate(() => window.estatesSession.gameState.actionCount)).toBe(
        before.count + 1
    )
    expect(errors).toEqual([])
})

test('public-money games can explore their projected roof bag', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await inspectScene(page)
    await createGame(page, 'Public money exploration')
    await enableProtectedMode(page)
    await selectActivePlayer(page)
    const explore = page.getByRole('button', { name: 'start exploring', exact: true })
    await expect(explore).toBeEnabled()
    await explore.click()
    await expect.poll(() => page.evaluate(() => window.estatesSession.isExploring)).toBe(true)
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.roofs.items.length))
        .toBe(12)
    await explore.click()
    await expect.poll(() => page.evaluate(() => window.estatesSession.isExploring)).toBe(false)
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.roofs.items.length))
        .toBe(0)
    expect(errors).toEqual([])
})

test('legacy Hidden Money state without the visibility flag cannot explore', async ({ page }) => {
    await inspectScene(page)
    await createGame(page, 'Legacy hidden money', true)
    await page.evaluate(async () => {
        const s = window.estatesSession
        const state = s.gameState.dehydrate()
        delete state.hiddenMoney
        delete state.protectedPrng
        delete state.masterSeed
        state.systemVersion = 2
        await s.setGameState(state)
    })
    await expect
        .poll(() => page.evaluate(() => window.estatesSession.gameState.systemVersion))
        .toBe(2)
    expect(await page.evaluate(() => window.estatesSession.gameState.hiddenMoney)).toBeUndefined()
    await expect(page.getByRole('button', { name: 'start exploring', exact: true })).toBeDisabled()
    await page.evaluate(async () => {
        await window.estatesSession.startExploring()
    })
    expect(await page.evaluate(() => window.estatesSession.isExploring)).toBe(false)
    await expect(page.getByText('Choose a piece to auction', { exact: true })).toBeVisible()
})
