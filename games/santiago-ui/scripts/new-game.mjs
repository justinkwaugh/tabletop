/**
 * Playwright script — creates and launches a Santiago game in the local harness.
 *
 * Prerequisites:
 *   • The harness dev server is running:
 *       pnpm turbo watch dev --filter=@tabletop/santiago-ui
 *   • Playwright browsers are installed:
 *       cd games/santiago-ui && npx playwright install chromium
 *
 * Run:
 *   node games/santiago-ui/scripts/new-game.mjs
 *
 * Edit the SETTINGS block below to change the game configuration.
 */

import { chromium } from '@playwright/test'

// ── Configuration ─────────────────────────────────────────────────────────────

const SETTINGS = {
    /** URL of the Santiago harness dev server */
    url: 'http://localhost:5174',

    /** Display name for the new game */
    name: 'Santiago',

    /** Total number of players (2–5) */
    playerCount: 3,

    /**
     * Names for the additional player slots (player 1 is the host account and
     * is filled in automatically).  Provide one name per extra slot.
     */
    extraPlayerNames: ['Alice', 'Bob'],

    // ── Game config options ──────────────────────────────────────────────────
    palmTrees:   true,   // Place three palm trees randomly on the board
    publicMoney: true,   // Everyone can see all escudo totals
    publicScore: true,   // Everyone can see field scores during the game
    springCol:   2,      // Spring column position (0–4)
    springRow:   1,      // Spring row position (0–3)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setToggle(page, id, desired) {
    const checkbox = page.locator(`#${id}`)
    const isChecked = await checkbox.isChecked()
    if (isChecked !== desired) {
        await page.locator(`label:has(#${id})`).click()
    }
}

async function setNumber(page, id, value) {
    const input = page.locator(`#${id}`)
    await input.fill(String(value))
    await input.dispatchEvent('change')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const browser = await chromium.launch({ headless: false, slowMo: 60 })
    const page = await browser.newPage()
    await page.setViewportSize({ width: 1400, height: 900 })

    console.log(`Navigating to ${SETTINGS.url}…`)
    await page.goto(SETTINGS.url)
    await page.waitForLoadState('networkidle')

    // Open the New Game modal
    await page.getByRole('button', { name: 'New Game' }).click()
    await page.waitForSelector('input[placeholder="choose a name for your game"]')
    console.log('Modal open — filling form…')

    // Game name
    await page.fill('input[placeholder="choose a name for your game"]', SETTINGS.name)

    // Player count — RadioButton renders as <label><input type="radio" class="sr-only" value="N">N</label>
    await page.locator(`label:has(input[type="radio"][value="${SETTINGS.playerCount}"])`).click()

    // Extra player names — host slot (first player) is disabled; fill the rest
    const nameInputs = page.locator('input[placeholder="player name"]:not([disabled])')
    const slotCount = await nameInputs.count()
    for (let i = 0; i < Math.min(SETTINGS.extraPlayerNames.length, slotCount); i++) {
        await nameInputs.nth(i).fill(SETTINGS.extraPlayerNames[i])
        await nameInputs.nth(i).dispatchEvent('input')
    }

    // Boolean toggles
    await setToggle(page, 'palmTrees',   SETTINGS.palmTrees)
    await setToggle(page, 'publicMoney', SETTINGS.publicMoney)
    await setToggle(page, 'publicScore', SETTINGS.publicScore)

    // Number inputs
    await setNumber(page, 'springCol', SETTINGS.springCol)
    await setNumber(page, 'springRow', SETTINGS.springRow)

    // Submit
    console.log('Submitting…')
    await page.getByRole('button', { name: 'Create Game' }).click()

    // Wait for the modal to close and the game board to appear
    await page.waitForSelector('input[placeholder="choose a name for your game"]', { state: 'hidden' })
    await page.waitForTimeout(1500)

    console.log('Game created and loaded — browser will stay open.')
    // Browser intentionally left open for the user to play
}

main().catch(err => {
    console.error('Script failed:', err.message)
    process.exit(1)
})
