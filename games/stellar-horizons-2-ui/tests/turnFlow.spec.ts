import { expect, test, type Page } from '@playwright/test'
import { ActionSource } from '@tabletop/common'
import { TechId } from '@tabletop/stellar-horizons-2'
import type { StellarHorizonsGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        stellarSession: StellarHorizonsGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function createGame(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.stellarSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Footfall')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.stellarSession)).toBe(true)
    for (const faction of ['The Starfarers', 'The Givers', 'The Praetorians']) {
        await page.getByRole('button', { name: new RegExp(`^${faction}`) }).click()
    }
    await expect
        .poll(() => page.evaluate(() => window.stellarSession.gameState.machineState))
        .toBe('PlayingTurn')
    await page.evaluate(() =>
        window.stellarSession.setActingPlayer(window.stellarSession.gameState.initiativeOrder()[0])
    )
}

function shipTile(page: Page, name: string) {
    return page.locator(`.ship-tile[title^="${name}:"]`)
}

const selectedShipId = (page: Page) =>
    page.evaluate(() => window.stellarSession.selectedShip?.shipId)
const actionCount = (page: Page) => page.evaluate(() => window.stellarSession.actions.length)

async function buildProbeAndReachMovement(page: Page) {
    await page.getByRole('button', { name: 'Build Kepler at Sol for $5B' }).click()
    await expect(clump(page, /^The Starfarers at Sol: 1 ship$/)).toBeVisible()
    await page.getByRole('button', { name: 'Done building' }).click()
    await page.getByRole('button', { name: 'Done with cargo' }).click()
    await expect(page.getByRole('button', { name: 'Done moving' })).toBeVisible()
}

test('a chosen ship shows its destinations and moves from the map', async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    await shipTile(page, 'Kepler').getByRole('button').first().click()
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toBeVisible()
    await expect(page.getByText('Choose a highlighted destination on the map')).toBeVisible()

    await page.getByRole('button', { name: 'Move to Alpha Centauri' }).click()
    await expect
        .poll(() =>
            page.evaluate(() => window.stellarSession.gameState.ship('starfarers-kepler').transit)
        )
        .toBe(2)
    await expect.poll(() => selectedShipId(page)).toBeUndefined()
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Done exploring' })).toBeVisible()
})

test('Undo clears a chosen ship before undoing any action', async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    const before = await actionCount(page)
    await page.getByRole('button', { name: 'Kepler', exact: true }).first().click()
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    await page.getByRole('button', { name: 'UNDO' }).click()
    await expect.poll(() => selectedShipId(page)).toBeUndefined()
    expect(await actionCount(page)).toBe(before)
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toHaveCount(0)
})

test('history hides a chosen ship and live view restores it', async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    await page.getByRole('button', { name: 'Kepler', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toBeVisible()
    await page.getByRole('button', { name: 'step backwards' }).first().click()
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toHaveCount(0)
    await page.getByRole('button', { name: 'go to current' }).first().click()
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toBeVisible()
})

test('a tech chosen on the chart is paid for with suggested markers', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: 'Done building' }).click()
    await page.getByRole('button', { name: 'Done with cargo' }).click()
    await page.getByRole('button', { name: 'Done exploring' }).click()
    await page
        .getByRole('button', { name: 'Improved Interstellar Settlement', exact: true })
        .click()
    await expect(page.getByRole('button', { name: /^Develop for/ })).toBeVisible()
    await page.getByRole('button', { name: /^Develop for/ }).click()
    await expect
        .poll(() =>
            page.evaluate(
                (techId) =>
                    window.stellarSession.gameState
                        .getPlayerState(window.stellarSession.gameState.initiativeOrder()[0])
                        .ownsTech(techId),
                TechId.ImprovedInterstellarSettlement
            )
        )
        .toBe(true)
})

test("another player's action keeps the chosen ship", async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    await page.getByRole('button', { name: 'Kepler', exact: true }).first().click()
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    const before = await actionCount(page)
    await page.evaluate(async (source) => {
        const session = window.stellarSession
        const state = session.gameState
        const other = state.initiativeOrder()[1]
        const action = {
            id: 'other-player-step',
            gameId: state.gameId,
            source,
            playerId: other,
            type: 'EndStep',
            step: state.getPlayerState(other).step,
            simultaneousGroupId: `turn-${state.year}`
        }
        await session.applyAction(action)
    }, ActionSource.User)
    await expect.poll(() => actionCount(page)).toBe(before + 1)
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toBeVisible()
})

function clump(page: Page, label: RegExp) {
    return page.locator('svg[aria-label="Star map"]').getByRole('button', { name: label })
}

const strip = (page: Page) => page.locator('[aria-label="Ships here"]')

test('clicking a clump shows all its ships in a strip, and closes again', async ({ page }) => {
    await createGame(page)
    await page.getByRole('button', { name: 'Build Kepler at Sol for $5B' }).click()
    await page.getByRole('button', { name: 'Build Andromeda at Sol for $7B' }).click()
    const starfarers = clump(page, /^The Starfarers at Sol: 2 ships$/)
    await starfarers.hover()
    await expect(strip(page)).toHaveCount(0)

    await starfarers.click()
    await expect(strip(page)).toBeVisible()
    await expect(strip(page).getByRole('button')).toHaveCount(2)
    await expect(strip(page)).toContainText('Kepler')
    await expect(strip(page)).toContainText('Andromeda')

    await starfarers.click()
    await expect(strip(page)).toHaveCount(0)
    await starfarers.click()
    await page.keyboard.press('Escape')
    await expect(strip(page)).toHaveCount(0)
    await starfarers.click()
    await page.locator('svg[aria-label="Star map"]').click({ position: { x: 8, y: 8 } })
    await expect(strip(page)).toHaveCount(0)
})

test('a ship can be chosen from its clump strip during movement', async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    await clump(page, /^The Starfarers at Sol/).click()
    await strip(page).getByRole('button', { name: 'Kepler', exact: true }).click()
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    await expect(strip(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Move to Alpha Centauri' })).toBeVisible()
})

test('the pointer anywhere inside a hex reaches that hex, not its neighbour', async ({ page }) => {
    await createGame(page)
    const stolen = await page.evaluate(() =>
        [...document.querySelectorAll('svg[aria-label="Star map"] [data-system-id]')].flatMap(
            (tile) => {
                const art = tile.querySelector('image.system-art')
                if (!art) return [`${tile.getAttribute('data-system-id')}: no art`]
                const box = art.getBoundingClientRect()
                const cx = box.x + box.width / 2
                const cy = box.y + box.height / 2
                const insideHex = (x: number, y: number) => {
                    const u = Math.abs(x - cx) / (box.width / 2)
                    const v = Math.abs(y - cy) / (box.height / 2)
                    return v <= 0.96 && u + v / 2 <= 0.96
                }
                const points: [number, number][] = []
                for (let x = box.x; x <= box.x + box.width; x += box.width / 24) {
                    for (let y = box.y; y <= box.y + box.height; y += box.height / 24) {
                        if (insideHex(x, y)) points.push([x, y])
                    }
                }
                return points.flatMap(([x, y]) => {
                    const owner = document.elementFromPoint(x, y)?.closest('[data-system-id]')
                    return owner && owner !== tile
                        ? [
                              `${tile.getAttribute('data-system-id')} → ${owner.getAttribute('data-system-id')}`
                          ]
                        : []
                })
            }
        )
    )
    expect([...new Set(stolen)]).toEqual([])
})

test('clicking a system name zooms into it with a details panel, and Back returns', async ({
    page
}) => {
    await createGame(page)
    await shipTile(page, 'Kepler').getByRole('button', { name: '$5B' }).click()
    const panel = page.getByRole('complementary', { name: 'Sol details' })
    await expect(panel).toHaveCount(0)

    const fittedWidth = await page
        .locator('svg[aria-label="Star map"]')
        .evaluate((svg) => svg.getBoundingClientRect().width)

    await page.getByRole('button', { name: 'Zoom into Sol' }).click()
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('heading', { name: 'Sol' })).toBeVisible()
    await expect(panel).toContainText('The Starfarers')
    await expect(panel.getByRole('button', { name: 'Kepler' })).toBeVisible()
    const mapWidth = () =>
        page
            .locator('svg[aria-label="Star map"]')
            .evaluate((svg) => svg.getBoundingClientRect().width)
    await expect.poll(mapWidth).toBeGreaterThan(fittedWidth * 2)

    await panel.getByRole('button', { name: 'Back to map' }).click()
    await expect(panel).toHaveCount(0)
    await expect.poll(mapWidth).toBeCloseTo(fittedWidth, 0)
    await page.getByRole('button', { name: 'Zoom into Sol' }).click()
    await expect(panel).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
})

test('a ship can be chosen from the zoomed system panel', async ({ page }) => {
    await createGame(page)
    await buildProbeAndReachMovement(page)
    await page.getByRole('button', { name: 'Zoom into Sol' }).click()
    const panel = page.getByRole('complementary', { name: 'Sol details' })
    await panel.getByRole('button', { name: /Kepler/ }).click()
    await expect.poll(() => selectedShipId(page)).toBe('starfarers-kepler')
    await expect(panel).toBeVisible()
})

async function buildAndReachCargo(page: Page, ...ships: string[]) {
    for (const ship of ships) {
        const build = page.getByRole('button', { name: new RegExp(`^Build ${ship} at Sol`) })
        await build.click()
        await expect(build).toHaveCount(0)
    }
    await page.getByRole('button', { name: 'Done building' }).click()
    await expect(page.getByRole('button', { name: 'Done with cargo' })).toBeVisible()
}

const settlementsAboard = (page: Page, shipId: string) =>
    page.evaluate((id) => window.stellarSession.gameState.ship(id).settlements, shipId)
const loadOne = (page: Page) => page.getByRole('button', { name: 'One settlement onto the ship' })

test('cargo is drafted with the arrows and committed as one transfer', async ({ page }) => {
    await createGame(page)
    await buildAndReachCargo(page, 'Andromeda')
    const before = await actionCount(page)
    await page.getByRole('button', { name: 'Transfer cargo on Andromeda at Sol' }).click()
    await loadOne(page).click()
    await loadOne(page).click()
    await expect(page.getByTestId('cargo-on-ship')).toHaveText('2')
    await expect(page.getByText('Pay $10B')).toBeVisible()
    await expect(loadOne(page)).toBeDisabled()
    expect(await actionCount(page)).toBe(before)
    expect(await settlementsAboard(page, 'starfarers-andromeda')).toBe(0)

    await page.getByRole('button', { name: 'Commit', exact: true }).click()
    await expect.poll(() => settlementsAboard(page, 'starfarers-andromeda')).toBe(2)
    expect(await actionCount(page)).toBe(before + 1)
    await expect(page.getByText('No changes')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Commit', exact: true })).toBeDisabled()
})

test('Undo discards a cargo draft before undoing any action', async ({ page }) => {
    await createGame(page)
    await buildAndReachCargo(page, 'Andromeda')
    const before = await actionCount(page)
    await page.getByRole('button', { name: 'Transfer cargo on Andromeda at Sol' }).click()
    await loadOne(page).click()
    await page.getByRole('button', { name: 'UNDO' }).click()
    await expect.poll(() => selectedShipId(page)).toBeUndefined()
    await expect(loadOne(page)).toHaveCount(0)
    expect(await actionCount(page)).toBe(before)

    await page.getByRole('button', { name: 'Transfer cargo on Andromeda at Sol' }).click()
    await expect(page.getByTestId('cargo-on-ship')).toHaveText('0')
})

test('choosing another destination discards the cargo draft', async ({ page }) => {
    await createGame(page)
    await buildAndReachCargo(page, 'Andromeda', 'Discovery')
    await page.getByRole('button', { name: 'Transfer cargo on Andromeda at Sol' }).click()
    await loadOne(page).click()
    await expect(page.getByText('Pay $5B')).toBeVisible()
    await page
        .getByRole('group', { name: 'Destination' })
        .getByRole('button', { name: 'Discovery' })
        .click()
    await expect(page.getByText('No changes')).toBeVisible()
    await expect(page.getByTestId('cargo-on-ship')).toHaveText('0')
    await expect(page.getByTestId('cargo-at-partner')).toHaveText('0')
})

test('entering the movement step zooms back out to the whole map', async ({ page }) => {
    await createGame(page)
    await buildAndReachCargo(page, 'Andromeda')
    await page.getByRole('button', { name: 'Transfer cargo on Andromeda at Sol' }).click()
    await expect(page.getByRole('button', { name: 'Back to map' })).toBeVisible()
    await page.getByRole('button', { name: 'Done with cargo' }).click()
    await expect(page.getByText('Choose a ship to move')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to map' })).toHaveCount(0)
    await expect
        .poll(() => page.evaluate(() => window.stellarSession.focusedSystemId))
        .toBeUndefined()
})
