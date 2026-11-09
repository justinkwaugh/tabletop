import { expect, test, type Page } from '@playwright/test'
import type { Point } from '@tabletop/common'
import type { MedinaGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        medinaSession: MedinaGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

test.use({ reducedMotion: 'reduce' })

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function createGame(
    page: Page,
    options: { hiddenPieces?: boolean; teaTiles?: boolean } = {}
) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.medinaSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Table')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    if (options.teaTiles) {
        await page.getByRole('checkbox', { name: /^Tea tiles/ }).check({ force: true })
    }
    if (options.hiddenPieces) {
        await page.getByRole('checkbox', { name: /^Hidden pieces/ }).check({ force: true })
    }
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.medinaSession)).toBe(true)
    await expect(page.getByRole('button', { name: /^Merchant/ })).toBeVisible()
}

function targets(page: Page) {
    return page.locator('polygon.target')
}

async function piecesOnBoard(page: Page) {
    return page.evaluate(() => window.medinaSession.gameState.buildings.length)
}

test('choosing a piece shows where it can go, and choosing it again keeps it', async ({ page }) => {
    await createGame(page)
    await expect(targets(page)).toHaveCount(0)
    const orange = page.getByRole('button', { name: /^Orange/ })
    await orange.click()
    await expect(orange).toHaveAttribute('aria-pressed', 'true')
    const places = await targets(page).count()
    expect(places).toBeGreaterThan(50)
    await orange.click()
    await expect(orange).toHaveAttribute('aria-pressed', 'true')
    await expect(targets(page)).toHaveCount(places)
})

test('Undo takes back the chosen piece before any placement', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Orange/ }).click()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(targets(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0)
})

test('placing a piece commits it and hands the opening turn on', async ({ page }) => {
    await createGame(page)
    const before = await page.evaluate(() => window.medinaSession.gameState.activePlayerIds[0])
    await page.getByRole('button', { name: /^Orange/ }).click()
    await targets(page).first().click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    const after = await page.evaluate(() => window.medinaSession.gameState.activePlayerIds[0])
    expect(after).not.toBe(before)
})

test('the player keeps a piece for the second placement of a turn, and Undo skips it', async ({
    page
}) => {
    await createGame(page)
    for (let opening = 0; opening < 2; opening++) {
        await page.getByRole('button', { name: /^Merchant/ }).click()
        await targets(page).first().click()
        await expect
            .poll(() => page.evaluate(() => window.medinaSession.gameState.actionCount))
            .toBe(opening + 1)
    }
    await expect(page.getByRole('heading', { name: 'Place 2 pieces' })).toBeVisible()
    await page.getByRole('button', { name: /^Merchant/ }).click()
    await targets(page).first().click()
    await expect(page.getByRole('heading', { name: 'Place 1 piece' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Merchant/ })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Place 2 pieces' })).toBeVisible()
})

test('a palace can be built and claimed, and hovering it shows its score', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Grey/ }).click()
    await targets(page).first().click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    await page.getByRole('button', { name: /^Rooftop/ }).click()
    await expect(targets(page)).toHaveCount(1)
    await targets(page).first().click()
    await expect
        .poll(() =>
            page.evaluate(() => window.medinaSession.gameState.palaces[0].rooftop?.playerId)
        )
        .toBeTruthy()
    await page.locator('polygon.hit').first().hover({ force: true })
    await expect(page.locator('.tag')).toContainText('Player')
})

test('the Top down button switches view and pieces can still be placed', async ({ page }) => {
    await createGame(page)
    const topDown = page.getByRole('button', { name: 'Top down', exact: true })
    await expect(topDown).toHaveAttribute('aria-pressed', 'false')
    await topDown.click()
    await expect(topDown).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.evaluate(() => window.medinaSession.boardView)).toBe('plan')
    await page.getByRole('button', { name: /^Orange/ }).click()
    await targets(page).first().click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    await topDown.click()
    await expect.poll(() => page.evaluate(() => window.medinaSession.boardView)).toBe('cavalier')
})

test('the preview does not outlive its placement', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Orange/ }).click()
    const target = targets(page).first()
    await target.hover()
    await expect(page.locator('.ghost')).toHaveCount(1)
    await target.click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    await expect(page.locator('.ghost')).toHaveCount(0)
    await page.getByRole('button', { name: /^Grey/ }).click()
    await expect(targets(page).first()).toBeVisible()
    await expect(page.locator('.ghost')).toHaveCount(0)
})

test('the tiled table and the arcade edge reach the page', async ({ page }) => {
    await createGame(page)
    const images = await page.evaluate(() => ({
        table: getComputedStyle(document.querySelector('.medina-table')!).backgroundImage,
        frieze: getComputedStyle(document.querySelector('.plank')!, '::after').backgroundImage
    }))
    expect(images.table).toContain('url(')
    expect(images.frieze).toContain('url(')
})

test('every building of a palace opens its score, naming nobody until claimed', async ({
    page
}) => {
    await createGame(page)
    const orange = page.getByRole('button', { name: /^Orange/ })
    for (let placed = 0; placed < 4; placed++) {
        if ((await orange.getAttribute('aria-pressed')) !== 'true') {
            await orange.click()
        }
        await targets(page).first().click()
        await expect.poll(() => piecesOnBoard(page)).toBe(placed + 1)
    }
    if ((await orange.getAttribute('aria-pressed')) === 'true') {
        await orange.click()
    }
    const hits = page.locator('polygon.hit')
    await expect(hits).toHaveCount(4)
    for (let building = 0; building < 4; building++) {
        await page.mouse.move(0, 0)
        await expect(page.locator('.tag')).toHaveCount(0)
        await hits.nth(building).hover({ force: true })
        await expect(page.locator('.tag')).toContainText('Unclaimed')
        await expect(page.locator('.tag')).toContainText('Size 4')
    }
})

test('the dots empty from the left as pieces are placed', async ({ page }) => {
    await createGame(page)
    const dots = page.locator('.tokens i')
    for (let opening = 0; opening < 2; opening++) {
        await expect(dots).toHaveCount(1)
        await page.getByRole('button', { name: /^Merchant/ }).click()
        await targets(page).first().click()
        await expect
            .poll(() => page.evaluate(() => window.medinaSession.gameState.actionCount))
            .toBe(opening + 1)
    }
    await expect(dots).toHaveCount(2)
    await expect(page.locator('.tokens i.spent')).toHaveCount(0)
    await page.getByRole('button', { name: /^Merchant/ }).click()
    await targets(page).first().click()
    await expect(dots).toHaveCount(2)
    await expect(dots.first()).toHaveClass(/spent/)
    await expect(dots.last()).not.toHaveClass(/spent/)
})

test('squares and the ghost stand at their true depth, and placed pieces carry a dot', async ({
    page
}) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Orange/ }).click()
    const target = targets(page).first()
    await target.hover()
    const order = await page.evaluate(() => {
        const layers = [...document.querySelectorAll('svg.board > g')].map(
            (layer) => layer.getAttribute('class')?.split(' ')[0]
        )
        return { layers, ghostInPieces: !!document.querySelector('.pieces .ghost') }
    })
    expect(order.ghostInPieces).toBe(true)
    expect(order.layers.indexOf('target-marks')).toBeLessThan(order.layers.indexOf('pieces'))
    expect(order.layers.indexOf('pieces')).toBeLessThan(order.layers.indexOf('recent'))
    expect(order.layers.indexOf('recent')).toBeLessThan(order.layers.indexOf('targets'))
    await target.click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    await expect(page.locator('.recent-dot')).toHaveCount(1)
})

test('a claimed tile stays on the board under the owner rooftop, and merchants get a square', async ({
    page
}) => {
    await createGame(page)
    await expect(page.locator('.tile-roof')).toHaveCount(0)
    await page.getByRole('button', { name: /^Grey/ }).click()
    await targets(page).first().click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    await page.getByRole('button', { name: /^Rooftop/ }).click()
    await targets(page).first().click()
    await expect(page.locator('.tile-roof')).toHaveCount(1)
    await expect(page.locator('.tile-size')).toHaveText('1')
    await expect.poll(() => page.evaluate(() => window.medinaSession.canAct)).toBe(true)
    await expect(page.getByRole('heading', { name: 'Place 2 pieces' })).toBeVisible()
    await page.getByRole('button', { name: /^Merchant/ }).click()
    await targets(page).first().click()
    await expect(page.locator('.recent-square')).toHaveCount(1)
})

test('stepping through history marks only the piece that step placed, in its own way', async ({
    page
}) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Merchant/ }).click()
    await targets(page).first().click()
    await expect(page.locator('.recent-square')).toHaveCount(1)
    await page.getByRole('button', { name: /^Grey/ }).click()
    await targets(page).first().click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    const placed = await page.evaluate(() =>
        window.medinaSession.actions
            .filter((action) => action.playerId)
            .map((action) => action.index)
    )
    const goTo = (index: number | undefined) =>
        page.evaluate((target) => window.medinaSession.history.goToActionIndex(target ?? 0), index)

    await goTo(placed[0])
    await expect(page.locator('.recent-square')).toHaveCount(1)
    await expect(page.locator('.recent-dot')).toHaveCount(0)
    await expect(page.locator('.action')).toContainText('Added a merchant')

    await goTo(placed[1])
    await expect(page.locator('.recent-dot')).toHaveCount(1)
    await expect(page.locator('.recent-square')).toHaveCount(0)
    await expect(page.locator('.action')).toContainText('grey palace')
})

test('the history list names a player by their rooftop, and its entries are not buttons', async ({
    page
}) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Grey/ }).click()
    await targets(page).first().click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    await page.getByText('History', { exact: true }).first().click()
    const head = page.locator('.history .head').first()
    await expect(head.locator('.roof')).toHaveCount(1)
    await expect(page.locator('.history button')).toHaveCount(0)
    await head.click()
    await expect.poll(() => page.evaluate(() => window.medinaSession.isViewingHistory)).toBe(false)
})

test('every piece count shows unless the Hidden pieces option is chosen', async ({ page }) => {
    await createGame(page)
    await expect(page.locator('.card')).toHaveCount(4)
    await expect(page.locator('.card .count')).toHaveCount(16)
    await expect(page.locator('.card .stock .item')).toHaveCount(16)
})

test('Hidden pieces leaves only rooftops and tiles on other players cards', async ({ page }) => {
    await createGame(page, { hiddenPieces: true })
    await expect(page.locator('.card')).toHaveCount(4)
    await expect(page.locator('.card .count')).toHaveCount(4)
    await expect(page.locator('.card .stock .item')).toHaveCount(4 + 3)
    await expect(page.locator('.card .stock title', { hasText: 'Rooftops' })).toHaveCount(4)
    await expect(page.locator('.card .stock title', { hasText: 'Stables' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: /^Merchant/ })).toContainText(/\d/)
})

test('in Protected mode Hidden pieces never delivers an opponent supply', async ({ page }) => {
    await createGame(page, { hiddenPieces: true })
    await page.getByRole('button', { name: /Options/ }).click()
    await page.getByText('Protected mode').click()
    const views = page.getByLabel('Protected view')
    await expect(views).toBeVisible()
    const activeId = await page.evaluate(() => window.medinaSession.gameState.activePlayerIds[0])
    await views.selectOption(activeId)
    await page.keyboard.press('Escape')

    const opponentsSupplies = () =>
        page.evaluate((id) => {
            const players = window.medinaSession.gameState.players
            return players
                .filter((player) => player.playerId !== id)
                .flatMap((player) => [
                    player.buildings,
                    player.stables,
                    player.merchants,
                    player.walls
                ])
                .filter((stock) => stock !== undefined).length
        }, activeId)
    await expect(page.getByRole('button', { name: /^Merchant/ })).toBeVisible()
    await expect.poll(opponentsSupplies).toBe(0)
    await expect(page.locator('.card .count')).toHaveCount(4)
    await expect(page.locator('.card .under')).toHaveCount(4)

    await page.getByRole('button', { name: /^Merchant/ }).click()
    await targets(page).first().click()
    await expect(page.getByRole('heading', { name: /is placing/ })).toBeVisible()
    await expect.poll(opponentsSupplies).toBe(0)
    await expect(page.locator('.card .count')).toHaveCount(4)

    await views.selectOption('spectator')
    await expect(page.locator('.card .count')).toHaveCount(0)
})

test('top down drops the shadows', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Grey/ }).click()
    await targets(page).first().click()
    expect(await page.locator('[data-shadow-key]').count()).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Top down' }).click()
    await expect(page.locator('.shadows')).toHaveCount(0)
})

test('the end of the game prints each palace score on its rooftop', async ({ page }) => {
    await createGame(page)
    await expect(page.locator('.final-scores text')).toHaveCount(0)
    await page.evaluate(async () => {
        const session = window.medinaSession
        for (let step = 0; step < 600 && !session.gameState.result; step++) {
            while (session.updatingVisibleState || session.busy) {
                await new Promise((resolve) => setTimeout(resolve, 10))
            }
            if (session.gameState.result) break
            const bays = session.bays.filter((bay) => bay.enabled)
            session.choose(bays[step % bays.length].tool)
            if (session.targets.length > 0) {
                await session.placeAt(session.targets[step % session.targets.length], false)
            }
        }
    })
    await expect(page.locator('.end h2')).toContainText(/wins?$/)
    await expect(page.locator('.end h2 .roof').first()).toBeVisible()
    const roofs = await page.evaluate(
        () => window.medinaSession.gameState.palaces.filter((palace) => palace.rooftop).length
    )
    await expect(page.locator('.final-scores text')).toHaveCount(roofs)
})

test('stepping back to before a focused palace existed drops the focus', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Grey/ }).click()
    await targets(page).first().click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    await page.evaluate(() => {
        const session = window.medinaSession
        session.focusPalace(session.gameState.palaces[0].id)
    })
    await expect(page.locator('.tag')).toBeVisible()
    await page.evaluate(() => {
        const session = window.medinaSession
        return session.history.goToActionIndex((session.actions.at(-1)?.index ?? 1) - 1)
    })
    await expect.poll(() => piecesOnBoard(page)).toBe(0)
    await expect(page.locator('.tag')).toHaveCount(0)
})

test('a piece chosen while the board updates is the first thing Undo takes back', async ({
    page
}) => {
    await createGame(page)
    await page.evaluate(async () => {
        const session = window.medinaSession
        while (session.placementsLeft !== 2 || !session.canAct || session.updatingVisibleState) {
            if (session.canAct && !session.updatingVisibleState) {
                session.choose(session.bays.filter((bay) => bay.enabled)[0].tool)
                await session.placeAt(session.targets[0], false)
            }
            await new Promise((resolve) => setTimeout(resolve, 10))
        }
    })
    const placedBefore = await page.evaluate(() => window.medinaSession.actions.length)
    const chose = await page.evaluate(async () => {
        const session = window.medinaSession
        const wall = session.bays.find((bay) => bay.tool.kind === 'wall')
        const merchant = session.bays.find((bay) => bay.tool.kind === 'merchant')
        if (!wall || !merchant) return false
        session.choose(wall.tool)
        const placing = session.placeAt(session.targets[0], false)
        while (!session.updatingVisibleState && session.busy) {
            await new Promise((resolve) => setTimeout(resolve, 1))
        }
        const updating = session.updatingVisibleState
        session.choose(merchant.tool)
        await placing
        return updating
    })
    expect(chose).toBe(true)
    const merchant = page.getByRole('button', { name: /^Merchant/ })
    await expect(merchant).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(merchant).toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate(() => window.medinaSession.actions.length)).toBe(placedBefore + 1)
})

async function claimPurplePalace(page: Page) {
    await page.getByRole('button', { name: /^Purple/ }).click()
    await targets(page).first().click()
    await expect.poll(() => piecesOnBoard(page)).toBe(1)
    await expect.poll(() => page.evaluate(() => window.medinaSession.canAct)).toBe(true)
    const claimer = await page.evaluate(() => window.medinaSession.gameState.activePlayerIds[0])
    await page.getByRole('button', { name: /^Rooftop/ }).click()
    await targets(page).first().click()
    await expect
        .poll(() => page.evaluate(() => window.medinaSession.gameState.activePlayerIds[0]))
        .not.toBe(claimer)
    return claimer
}

test('the tea stack shows on the board only with the tea tiles option', async ({ page }) => {
    await createGame(page, { teaTiles: true })
    await expect(page.locator('[data-tile="tea"]')).toHaveCount(1)
})

test('a game without the tea tiles option has no tea tiles to claim', async ({ page }) => {
    await createGame(page)
    await expect(page.locator('[data-tile="tea"]')).toHaveCount(0)
    const claimer = await claimPurplePalace(page)
    await expect(page.locator('[data-tile="tea"]')).toHaveCount(0)
    expect(
        await page.evaluate(
            (id) => window.medinaSession.gameState.getPlayerState(id).teaTiles,
            claimer
        )
    ).toBe(0)
})

test('tea break is offered from the start of a turn and leaves one piece to place', async ({
    page
}) => {
    await createGame(page, { teaTiles: true })
    const drinker = await claimPurplePalace(page)
    const tea = page.getByRole('button', { name: /^Tea break/ })
    await expect(tea).toHaveCount(0)
    for (let placed = 0; placed < 40; placed++) {
        const active = await page.evaluate(() => window.medinaSession.gameState.activePlayerIds[0])
        if (active === drinker) {
            break
        }
        const before = await page.evaluate(() => window.medinaSession.gameState.actionCount)
        const wall = page.getByRole('button', { name: /^Wall/ })
        if ((await wall.getAttribute('aria-pressed')) !== 'true') {
            await wall.click()
        }
        await targets(page).first().click()
        await expect
            .poll(() => page.evaluate(() => window.medinaSession.gameState.actionCount))
            .toBe(before + 1)
        await expect.poll(() => page.evaluate(() => window.medinaSession.canAct)).toBe(true)
    }
    await expect(tea).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Place 2 pieces' })).toBeVisible()
    await tea.click()
    await expect(page.getByRole('heading', { name: 'Place 1 piece' })).toBeVisible()
    await expect(tea).toHaveCount(0)
    await expect(page.locator('.placing')).toHaveText('tea')
    const wall = page.getByRole('button', { name: /^Wall/ })
    if ((await wall.getAttribute('aria-pressed')) !== 'true') {
        await wall.click()
    }
    await targets(page).first().click()
    await expect
        .poll(() => page.evaluate(() => window.medinaSession.gameState.activePlayerIds[0]))
        .not.toBe(drinker)
    await expect(page.locator('.placing').filter({ hasText: 'tea' })).toHaveCount(1)
    await expect(page.locator('.placing').filter({ hasText: 'placing' })).toHaveCount(1)
})

test('a wall placed since your last turn is tinted rather than dotted', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: /^Wall/ }).click()
    await targets(page).first().click()
    await expect(page.locator('g[filter^="url(#medina-tint-"]')).toHaveCount(1)
    await expect(page.locator('.recent-dot')).toHaveCount(0)
    const filterExists = await page.evaluate(() => {
        const id = document
            .querySelector('g[filter^="url(#medina-tint-"]')
            ?.getAttribute('filter')
            ?.slice(5, -1)
        return !!id && !!document.getElementById(id)
    })
    expect(filterExists).toBe(true)
})

test('the well bonus spaces are marked on the ground under the pieces', async ({ page }) => {
    await createGame(page)
    const expected = await page.evaluate(
        () => window.medinaSession.gameState.wellBonusSpaces().length
    )
    expect(expected).toBeGreaterThan(0)
    await expect(page.locator('.well-bonus')).toHaveCount(expected)
    await expect(page.locator('.well-bonus').first()).toHaveText('+4')
    const layers = await page.evaluate(() =>
        [...document.querySelectorAll('svg.board > g')].map(
            (layer) => layer.getAttribute('class')?.split(' ')[0]
        )
    )
    expect(layers.indexOf('well-bonuses')).toBeLessThan(layers.indexOf('pieces'))
})

test('corner tiles show a tray only while they hold merchants', async ({ page }) => {
    await createGame(page)
    await expect(page.locator('[data-tile="tower-1"] .merchant-tray')).toHaveCount(1)
    await expect(page.locator('[data-tile="tower-4"] .merchant-tray')).toHaveCount(0)
    await expect(page.locator('[data-tile="tower-3"] .tower-digit')).toHaveText('3')
})

test('the player cards are styled', async ({ page }) => {
    await createGame(page)
    const parapet = page.locator('.parapet').first()
    await expect(parapet).toHaveCSS('display', 'flex')
    const card = await page.locator('section.card').first().boundingBox()
    expect(card?.height).toBeLessThan(300)
})

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test.describe('with touch', () => {
        test.use({ hasTouch: true })

        test('a tap opens a palace score; a drag never opens it and panning closes it', async ({
            page
        }) => {
            await createGame(page)
            const orange = page.getByRole('button', { name: /^Orange/ })
            await orange.click()
            await targets(page).first().click()
            await expect.poll(() => piecesOnBoard(page)).toBe(1)
            if ((await orange.getAttribute('aria-pressed')) === 'true') {
                await orange.click()
            }
            const tag = page.locator('.tag')
            const palace = page.locator('polygon.hit').first()
            const centre = async (): Promise<Point> => {
                const box = await palace.boundingBox()
                if (!box) throw new Error('The palace has no box on screen')
                return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
            }
            // A pan coasts after the finger lifts, so wait for the palace to stop moving.
            const settledCentre = async (): Promise<Point> => {
                let last = await centre()
                await expect
                    .poll(async () => {
                        const next = await centre()
                        const still = next.x === last.x && next.y === last.y
                        last = next
                        return still
                    })
                    .toBe(true)
                return last
            }

            const cdp = await page.context().newCDPSession(page)
            const drag = async (from: Point, by: Point) => {
                const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Point[]) =>
                    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points })
                await touch('touchStart', [from])
                for (let step = 1; step <= 6; step++) {
                    await touch('touchMove', [
                        { x: from.x + (by.x * step) / 6, y: from.y + (by.y * step) / 6 }
                    ])
                }
                await touch('touchEnd', [])
            }

            await drag(await centre(), { x: -90, y: 0 })
            await expect(tag).toHaveCount(0)

            const spot = await settledCentre()
            await page.touchscreen.tap(spot.x, spot.y)
            await expect(tag).toContainText('Unclaimed')

            await drag(await centre(), { x: 0, y: -90 })
            await expect(tag).toHaveCount(0)
        })
    })

    test('the tiles stay upright around the rotated board, palace tiles along the top', async ({
        page
    }) => {
        await createGame(page)
        const board = await page.locator('svg.board').boundingBox()
        expect(board).not.toBeNull()
        const box = async (tile: string) =>
            page.locator(`[data-tile="${tile}"] > rect`).first().boundingBox()
        const grey = await box('palace-grey')
        const orange = await box('palace-orange')
        const topTower = await box('tower-3')
        const bottomTower = await box('tower-1')
        expect(grey && orange && topTower && bottomTower).toBeTruthy()
        expect(Math.abs((grey?.y ?? 0) - (orange?.y ?? 1))).toBeLessThan(1)
        expect(grey?.x).toBeLessThan(orange?.x ?? 0)
        expect(topTower?.x).toBeLessThan(grey?.x ?? 0)
        expect(bottomTower?.y).toBeGreaterThan((grey?.y ?? 0) + 200)
        for (const tile of [grey, orange, topTower, bottomTower]) {
            expect(tile?.x).toBeGreaterThanOrEqual((board?.x ?? 0) - 1)
            expect((tile?.x ?? 0) + (tile?.width ?? 0)).toBeLessThanOrEqual(
                (board?.x ?? 0) + (board?.width ?? 0) + 1
            )
        }
    })

    test('the board rests fitted to the width with its top row showing, and zooms out', async ({
        page
    }) => {
        await createGame(page)
        const frame = page.locator('.board-area')
        const board = page.locator('svg.board')
        const viewWidth = (await frame.boundingBox())?.width ?? 0
        await expect
            .poll(async () => {
                const tile = await page
                    .locator('[data-tile="palace-grey"] > rect')
                    .first()
                    .boundingBox()
                return (tile?.y ?? 0) - ((await frame.boundingBox())?.y ?? 0)
            })
            .toBeGreaterThanOrEqual(0)
        const rest = await board.boundingBox()
        expect(Math.abs((rest?.width ?? 0) - viewWidth)).toBeLessThan(2)
        const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
        await zoomOut.click()
        await expect
            .poll(async () => (await board.boundingBox())?.width)
            .toBeLessThan(viewWidth - 2)
        await page.waitForTimeout(300)
        const out = await board.boundingBox()
        const area = await frame.boundingBox()
        expect((out?.y ?? 0) + (out?.height ?? 0)).toBeLessThanOrEqual(
            (area?.y ?? 0) + (area?.height ?? 0) + 1
        )
        const lastTile = await page.locator('[data-tile="tower-1"] > rect').first().boundingBox()
        const zoom = await page.getByRole('button', { name: 'Zoom in', exact: true }).boundingBox()
        expect(zoom?.y).toBeGreaterThanOrEqual((lastTile?.y ?? 0) + (lastTile?.height ?? 0) - 1)
        const rightTile = await page.locator('[data-tile="tower-4"] > rect').first().boundingBox()
        const toggle = await page
            .getByRole('button', { name: 'Top down', exact: true })
            .boundingBox()
        expect(toggle?.y).toBeGreaterThanOrEqual((rightTile?.y ?? 0) + (rightTile?.height ?? 0) - 1)
        expect((toggle?.x ?? 0) + (toggle?.width ?? 0)).toBeGreaterThan(
            (area?.x ?? 0) + (area?.width ?? 0) - 20
        )
    })
})
