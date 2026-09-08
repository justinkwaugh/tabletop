import { expect, test } from '@playwright/test'
import { MachineState, PieceType } from '@tabletop/estates'
import { createGame, waitForFrames, inspectScene } from './helpers'

test('bidding and the preview recover when camera dragging interrupts entrance', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await inspectScene(page)
    await createGame(page)
    await waitForFrames(page)
    await page.mouse.move(800, 550)
    await page.evaluate(() => {
        const session = window.estatesSession
        const coords = session.gameState.placeableCubes()[0]
        const cube = session.gameState.cubes[coords.row][coords.col]
        if (!cube) throw new Error('The seeded offer must contain a selectable cube')
        void session.startAuction(cube)
    })
    await page.waitForFunction(() => window.estatesPreviewAnimating?.())
    await page.mouse.down()
    await page.mouse.move(880, 580, { steps: 3 })
    await expect.poll(() => page.evaluate(() => window.estatesSession.touching)).toBe(true)
    await page.mouse.up()
    await page.mouse.move(10, 80)
    const pass = page.getByRole('button', { name: 'Pass', exact: true })
    await expect(pass).toBeVisible()
    await expect(pass.locator('..')).toHaveCSS('opacity', '1')
    await expect.poll(() => page.evaluate(() => window.estatesPreview.position.y)).toBe(0)
    const bidder = await page.evaluate(() => window.estatesSession.gameState.activePlayerIds[0])
    await pass.click()
    await expect
        .poll(() =>
            page.evaluate(
                (bidder) =>
                    window.estatesSession.gameState.auction?.participants.find(
                        (participant) => participant.playerId === bidder
                    )?.passed,
                bidder
            )
        )
        .toBe(true)
    expect(errors).toEqual([])
})

test('loaded panels clear tall buildings and roof labels follow state-only jumps', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await inspectScene(page)
    await createGame(page, 'Layout check')
    await page.evaluate(
        async (roof) => {
            const session = window.estatesSession
            const data = session.gameState.dehydrate()
            const cubes = data.cubes.flat().filter((cube) => cube != null)
            const site = data.board.rows[0].sites[0]
            site.cubes = [6, 5, 4, 3, 2].map((value) => {
                const cube = cubes.find((cube) => cube.value === value)
                if (!cube) throw new Error(`Missing seeded cube ${value}`)
                return cube
            })
            for (const placed of site.cubes) {
                for (const row of data.cubes) {
                    const index = row.findIndex(
                        (cube) => cube?.company === placed.company && cube?.value === placed.value
                    )
                    if (index >= 0) row[index] = null
                }
            }
            site.roof = roof
            await session.setGameState(data)
        },
        { pieceType: PieceType.Roof as const, value: 1 }
    )
    await page.reload()
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByText('Layout check', { exact: true }).click()
    const panelHeight = () =>
        page.evaluate(() => window.estatesScene?.getObjectByName('player-panels')?.position.y)
    await expect.poll(panelHeight).toBe(5.7)
    await page.setViewportSize({ width: 600, height: 900 })
    await expect.poll(() => page.evaluate(() => window.estatesSession.mobileView)).toBe(true)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect.poll(panelHeight).toBe(5.7)

    for (const value of [1, 6, 1]) {
        await page.evaluate(
            async ({ value, pieceType, machineState }) => {
                const session = window.estatesSession
                const data = session.gameState.dehydrate()
                data.chosenPiece = { pieceType, value }
                data.machineState = machineState
                await session.notifyStateChangeListeners(
                    session.runtime.hydrator.hydrateState(data),
                    session.gameState
                )
            },
            { value, pieceType: PieceType.Roof as const, machineState: MachineState.Auctioning }
        )
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const text = window.estatesPreview?.getObjectByName('roofText')
                    return text && 'text' in text ? text.text : undefined
                })
            )
            .toBe(String(value))
    }
    const heightAfterTransition = await page.evaluate(async (machineState) => {
        const session = window.estatesSession
        const original = session.gameState
        const data = original.dehydrate()
        data.chosenPiece = undefined
        data.machineState = machineState
        data.board.rows[0].sites[0].cubes = data.board.rows[0].sites[0].cubes.slice(0, 1)
        data.board.rows[0].sites[0].roof = undefined
        await session.notifyStateChangeListeners(
            session.runtime.hydrator.hydrateState(data),
            original
        )
        const height = window.estatesScene.getObjectByName('player-panels')?.position.y
        session.gameState = original
        return height
    }, MachineState.StartOfTurn)
    expect(heightAfterTransition).toBe(2.5)
    await expect.poll(panelHeight).toBe(5.7)
    expect(errors).toEqual([])
})
