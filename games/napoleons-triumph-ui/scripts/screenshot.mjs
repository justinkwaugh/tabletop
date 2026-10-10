// Usage: [OPTIONS="Morale auction,1 December"] node scripts/screenshot.mjs <out.png> [width height] [steps]
// Opens the dev harness, starts a hotseat game, deploys both armies and captures the table.
import { chromium } from '@playwright/test'

const [out, width = '1440', height = '900', steps = 'deploy'] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({
    viewport: { width: Number(width), height: Number(height) },
    deviceScaleFactor: Number(process.env.SCALE ?? 1)
})
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
})
await page.goto(process.env.URL ?? 'http://localhost:5197/')
await page.getByRole('button', { name: 'New game', exact: true }).click()
await page.getByPlaceholder('choose a name for your game').fill('Austerlitz')
await page.getByPlaceholder('optional reproduction seed').fill('0123456789abcdef0123456789abcdef')
const names = page.getByPlaceholder('player name')
for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
for (const label of (process.env.OPTIONS ?? '').split(',').filter(Boolean)) {
    await page.locator('select').filter({ hasText: label }).selectOption({ label })
}
await page.getByRole('button', { name: 'Create Game', exact: true }).click()
await page.waitForTimeout(1500)
if (steps.includes('deploy')) {
    for (let i = 0; i < 2; i++) {
        await page.getByRole('button', { name: 'Deploy the army' }).click()
        await page.waitForTimeout(900)
    }
}
try {
    for (const step of steps.split(',')) {
        const [verb, argument] = step.split(':')
        if (verb === 'select') {
            await page
                .locator('[aria-label="Select these pieces"]')
                .nth(Number(argument ?? 0))
                .click({ force: true })
            await page.waitForTimeout(500)
        } else if (verb === 'click') {
            await page.getByRole('button', { name: argument }).first().click({ force: true })
            await page.waitForTimeout(700)
        } else if (verb === 'label') {
            await page
                .locator(`[aria-label="${argument}"]`)
                .filter({ visible: true })
                .first()
                .click({ force: true })
            await page.waitForTimeout(700)
        } else if (verb === 'corps') {
            await page.locator(`[data-commander="${argument}"]`).first().click({ force: true })
            await page.waitForTimeout(500)
        } else if (verb === 'wait') {
            await page.waitForTimeout(Number(argument ?? 500))
        } else if (verb === 'shot') {
            await page.screenshot({ path: out.replace('.png', `-${argument}.png`) })
        } else if (verb === 'zoom') {
            for (let i = 0; i < Number(argument ?? 1); i++)
                await page.getByRole('button', { name: 'Zoom in' }).click()
            await page.waitForTimeout(400)
        }
    }
    if (process.env.EVAL) {
        await page.evaluate(process.env.EVAL)
        await page.waitForTimeout(800)
    }
} catch (error) {
    console.log('step failed:', String(error).split('\n')[0])
}
await page.screenshot({ path: out })
if (errors.length) console.log('page errors:', errors.slice(0, 8))
await browser.close()
console.log('wrote', out)
