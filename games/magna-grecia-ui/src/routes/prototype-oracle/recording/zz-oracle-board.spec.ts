import { expect, test } from '@playwright/test'
test.use({ baseURL: 'http://localhost:5191', viewport: { width: 2560, height: 1600 }, deviceScaleFactor: 2 })
test.setTimeout(120000)
test('board', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({ response, body: body.replace('return getContext();', 'return window.magnaGreciaSession = getContext();') })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Oracle')
    await page.getByPlaceholder('optional reproduction seed').fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!(window as any).magnaGreciaSession)).toBe(true)
    await page.evaluate(async () => {
        const s = (window as any).magnaGreciaSession
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
        const settle = async () => { await wait(40); for (let k = 0; k < 100 && (s.busy || s.boardAnimating); k++) await wait(30) }
        s.chooseTool('City'); await wait(50)
        s.placeCity(s.cityTargets.filter((t: any) => !t.startsClaim && !t.startsFounding)[1].coords); await settle()
        s.chooseTool('Road'); await wait(50); s.placeRoad({ q: 7, r: 1 }, ['SW', 'NE']); await settle()
        s.chooseTool('Road'); await wait(50); s.placeRoad({ q: 6, r: 2 }, ['SW', 'NE']); await settle()
        s.toggleResupply(); await wait(50)
    })
    await page.waitForTimeout(400)
    const idx = await page.evaluate(() => (window as any).magnaGreciaSession.gameState.board.oracles.findIndex((o: any) => o.attentionCityId))
    const oracle = (await page.locator('g.oracles > g').nth(idx).boundingBox())!
    const city = (await page.locator('g.cities').boundingBox())!
    const x0 = Math.min(oracle.x, city.x) - 110, y0 = Math.min(oracle.y, city.y) - 40
    const x1 = Math.max(oracle.x + oracle.width, city.x + city.width) + 110, y1 = Math.max(oracle.y + oracle.height, city.y + city.height) + 50
    for (const v of ['G', 'I']) {
        await page.evaluate((v) => (window as any).setOracleVariant(v), v)
        await page.waitForTimeout(150)
        await page.screenshot({ path: `/tmp/mgproto/oracle-board-${v}.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } })
        const all = (await page.locator('g.oracles').boundingBox())!
        await page.screenshot({ path: `/tmp/mgproto/oracle-wide-${v}.png`, clip: { x: all.x - 30, y: all.y - 30, width: all.width + 60, height: all.height + 60 } })
    }
    console.log('errors', JSON.stringify(errors), JSON.stringify({ x0, y0, x1, y1, idx }))
})
