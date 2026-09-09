import { expect, test, type Page } from '@playwright/test'
import { BarrierDirection, MachineState, PieceType } from '@tabletop/estates'
import type { Object3D } from 'three'
import { createGame, inspectScene, waitForFrames } from './helpers'
import { ColumnOffsets, RowOffsets } from '../src/lib/utils/boardOffsets'

declare global {
    interface Window {
        estatesPlacementSite: Object3D
        estatesPlacementPiece: () => Object3D | undefined
        estatesSamplePlacement?: () => void
        estatesPlacementFrames: (string | undefined)[]
    }
}

async function passAuction(page: Page) {
    for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: 'Pass', exact: true }).click()
    }
}

for (const piece of ['roof', 'cube', 'barrier'] as const) {
    test(`a hovered ${piece} stays rendered through placement, undo and history`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await inspectScene(page)
        await page.route('**/Renderer.svelte*', async (route) => {
            const response = await route.fetch()
            const body = await response.text()
            expect(body).toContain('composer.render(delta);')
            await route.fulfill({
                response,
                body: body.replace(
                    'composer.render(delta);',
                    'window.estatesSamplePlacement?.(); composer.render(delta);'
                )
            })
        })
        await createGame(page, `${piece} placement`)
        await page.evaluate(async () => {
            const session = window.estatesSession
            const coords = session.gameState.placeableCubes()[0]
            const cube = session.gameState.cubes[coords.row][coords.col]
            if (!cube) throw new Error('Missing seeded cube')
            await session.startAuction(cube)
        })
        await passAuction(page)
        await expect(page.getByText('Place your cube on the board', { exact: true })).toBeVisible()
        await expect.poll(() => page.evaluate(() => window.estatesSession.busy)).toBe(false)
        await page.evaluate(async () => {
            const session = window.estatesSession
            const cube = session.gameState.chosenPiece
            if (!cube || !('company' in cube)) throw new Error('Expected the auctioned cube')
            await session.placeCube(cube, { row: 0, col: 0 })
        })
        await expect
            .poll(() => page.evaluate(() => window.estatesSession.gameState.machineState))
            .toBe(MachineState.StartOfTurn)
        await expect.poll(() => page.evaluate(() => window.estatesSession.busy)).toBe(false)
        await page.evaluate(
            async ({ piece, barrier }) => {
                const session = window.estatesSession
                if (piece === 'roof') {
                    await session.drawRoof(0)
                } else if (piece === 'barrier') {
                    await session.startAuction(barrier)
                } else {
                    const cube = session.gameState
                        .placeableCubes()
                        .map((coords) => session.gameState.cubes[coords.row][coords.col])
                        .find(
                            (cube) =>
                                cube &&
                                session.gameState.board.canPlaceCubeAtCoords(cube, {
                                    row: 0,
                                    col: 0
                                })
                        )
                    if (!cube) throw new Error('Expected a cube that can extend the building')
                    await session.startAuction(cube)
                }
            },
            {
                piece,
                barrier: {
                    pieceType: PieceType.Barrier as const,
                    value: 1,
                    direction: BarrierDirection.Unplaced
                }
            }
        )
        await passAuction(page)
        await expect(
            page.getByText(`Place your ${piece} on the board`, { exact: true })
        ).toBeVisible()
        await expect.poll(() => page.evaluate(() => window.estatesSession.busy)).toBe(false)
        const coords = await page.evaluate(
            (piece) => ({
                row: 0,
                col:
                    piece === 'barrier'
                        ? window.estatesSession.gameState.board.rows[0].length + 1
                        : 0
            }),
            piece
        )
        await page.waitForFunction(
            ({ piece, x, z }) => {
                const site = window.estatesScene
                    .getObjectsByProperty('type', 'Group')
                    .find((object) => object.position.x === x && object.position.z === z)
                if (!site || (piece !== 'barrier' && !site.getObjectByName('cube'))) return false
                window.estatesPlacementSite = site
                window.estatesPlacementPiece = () =>
                    site.children.find(
                        (object) =>
                            object.name === piece && (piece !== 'cube' || object.position.y === 1)
                    )
                return true
            },
            { piece, x: ColumnOffsets[coords.col], z: RowOffsets[coords.row] }
        )
        await expect(async () => {
            const before = await page.evaluate(() => window.estatesCamera().position.toArray())
            await waitForFrames(page)
            expect(await page.evaluate(() => window.estatesCamera().position.toArray())).toEqual(
                before
            )
        }).toPass({ timeout: 15000 })
        const sitePoint = () =>
            page.evaluate((piece) => {
                const point = window.estatesPlacementSite.position.clone()
                point.y = piece === 'barrier' ? -0.5 : 0.5
                point.project(window.estatesCamera())
                const bounds = document.querySelector('canvas')!.getBoundingClientRect()
                return {
                    x: bounds.x + ((point.x + 1) * bounds.width) / 2,
                    y: bounds.y + ((1 - point.y) * bounds.height) / 2
                }
            }, piece)
        const pieceMesh = () =>
            page.evaluate(() => {
                const model = window.estatesPlacementPiece()
                return model && model.scale.x > 0.99
                    ? model.getObjectByName('outlineMesh')?.uuid
                    : undefined
            })
        let point = await sitePoint()
        await page.mouse.move(point.x, point.y, { steps: 5 })
        await expect.poll(pieceMesh).toBeDefined()
        await page.mouse.move(10, 80)
        await expect.poll(pieceMesh).toBeUndefined()

        for (let placement = 0; placement < 2; placement++) {
            await expect.poll(() => page.evaluate(() => window.estatesSession.busy)).toBe(false)
            point = await sitePoint()
            await page.mouse.move(point.x, point.y, { steps: 5 })
            await expect
                .poll(pieceMesh, { message: `${piece} preview for placement ${placement}` })
                .toBeDefined()
            const previewMesh = await pieceMesh()
            await page.evaluate(() => {
                window.estatesPlacementFrames = []
                window.estatesSamplePlacement = () => {
                    const model = window.estatesPlacementPiece()
                    window.estatesPlacementFrames.push(
                        model && model.scale.x > 0.99
                            ? model.getObjectByName('outlineMesh')?.uuid
                            : undefined
                    )
                }
            })
            await page.mouse.click(point.x, point.y)
            await expect
                .poll(() =>
                    page.evaluate(
                        ({ piece, coords }) => {
                            const site =
                                window.estatesSession.gameState.board.rows[coords.row].sites[
                                    coords.col
                                ]
                            return piece === 'roof'
                                ? site.roof !== undefined
                                : piece === 'cube'
                                  ? site.cubes.length === 2
                                  : site.barriers.length === 1
                        },
                        { piece, coords }
                    )
                )
                .toBe(true)
            await waitForFrames(page)
            const frames = await page.evaluate(() => {
                window.estatesSamplePlacement = undefined
                return window.estatesPlacementFrames
            })
            expect(frames.length).toBeGreaterThan(0)
            expect(
                frames.every((mesh) => mesh === previewMesh),
                `The preview ${piece} must stay rendered on every frame through placement`
            ).toBe(true)
            await page.mouse.move(10, 80)
            expect(await pieceMesh()).toBe(previewMesh)
            if (placement === 0) {
                await page.getByRole('button', { name: 'Undo', exact: true }).click()
                await expect(
                    page.getByText(`Place your ${piece} on the board`, { exact: true })
                ).toBeVisible()
                await expect.poll(pieceMesh).toBeUndefined()
            }
        }
        for (const modifiers of [[], ['Shift' as const]]) {
            await page.getByRole('button', { name: 'step backwards', exact: true }).click()
            await expect.poll(pieceMesh).toBeUndefined()
            await page
                .getByRole('button', { name: 'step forwards', exact: true })
                .click({ modifiers })
            await expect.poll(pieceMesh).toBeDefined()
            await page.getByRole('button', { name: 'go to current', exact: true }).click()
            await expect.poll(pieceMesh).toBeDefined()
        }
        expect(errors).toEqual([])
    })
}
