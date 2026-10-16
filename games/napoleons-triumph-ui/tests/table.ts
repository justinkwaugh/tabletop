import { expect, test, type Locator, type Page } from '@playwright/test'
import {
    NapoleonsTriumphGameStateValidator,
    type NapoleonsTriumphGameState,
    type Position
} from '@tabletop/napoleons-triumph'

const GAME_NAME = 'Austerlitz'
const HARNESS_STORE = { database: 'tabletop-local', positions: 'states' }

export function failOnPageErrors() {
    const pageErrors = new WeakMap<Page, string[]>()

    test.beforeEach(({ page }) => {
        const errors: string[] = []
        pageErrors.set(page, errors)
        page.on('pageerror', (error) => errors.push(error.message))
    })

    test.afterEach(({ page }) => {
        expect(pageErrors.get(page)).toEqual([])
    })
}

interface GameOptions {
    seed?: string
    santon?: boolean
}

export async function createGame(
    page: Page,
    { seed = '0123456789abcdef0123456789abcdef', santon = false }: GameOptions = {}
) {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill(GAME_NAME)
    await page.getByPlaceholder('optional reproduction seed').fill(seed)
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    if (santon) {
        // Workaround: the option's checkbox is visually hidden behind its switch, and WebKit ignores a pointer click on it.
        const option = page.getByLabel('The Santon').first()
        await option.dispatchEvent('click')
        await expect(option).toBeChecked()
    }
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
}

const INFANTRY_2 = '2-strength infantry'
const INFANTRY_3 = '3-strength infantry'
const GUARD = 'guard infantry'
const CAVALRY_2 = '2-strength cavalry'
const HEAVY_CAVALRY = 'heavy cavalry'
const ARTILLERY = 'artillery'

type Army = Record<string, string[]>

export const ALLIED_ARMY: Army = {
    bagration: [INFANTRY_2, INFANTRY_2, INFANTRY_2, INFANTRY_2, ARTILLERY],
    constantine: [GUARD, INFANTRY_2, INFANTRY_2, INFANTRY_3, '1-strength cavalry'],
    dokhturov: [INFANTRY_2, INFANTRY_2, INFANTRY_2, INFANTRY_2, ARTILLERY],
    kienmayer: [INFANTRY_3, INFANTRY_3, INFANTRY_2, ARTILLERY, '1-strength cavalry'],
    kollowrath: [INFANTRY_2, '1-strength infantry', GUARD, '1-strength cavalry', CAVALRY_2],
    langeron: [INFANTRY_2, INFANTRY_2, INFANTRY_2, INFANTRY_2, CAVALRY_2],
    liechtenstein: [INFANTRY_3, INFANTRY_2, INFANTRY_2, INFANTRY_2, HEAVY_CAVALRY],
    miloradovich: [INFANTRY_3, GUARD, '1-strength infantry', CAVALRY_2, HEAVY_CAVALRY],
    prebyshevsky: [CAVALRY_2, CAVALRY_2, ARTILLERY, CAVALRY_2]
}

export const FRENCH_ARMY: Army = {
    bernadotte: [CAVALRY_2, INFANTRY_2, INFANTRY_2, GUARD, HEAVY_CAVALRY],
    bessieres: [INFANTRY_2, INFANTRY_3, INFANTRY_2, INFANTRY_2, CAVALRY_2],
    davout: [CAVALRY_2, INFANTRY_3, INFANTRY_2, INFANTRY_2, ARTILLERY],
    lannes: [INFANTRY_2, INFANTRY_2, INFANTRY_2, INFANTRY_3],
    legrand: [INFANTRY_2, INFANTRY_3, INFANTRY_2, HEAVY_CAVALRY],
    murat: [INFANTRY_3, INFANTRY_3, INFANTRY_2, INFANTRY_2],
    'st-hilaire': [INFANTRY_2, GUARD, INFANTRY_2, HEAVY_CAVALRY],
    vandamme: [INFANTRY_3, ARTILLERY, CAVALRY_2, CAVALRY_2]
}

const FIXED_BATTERY_LOCALE = 64
const FIXED_BATTERY_APPROACH = 175

export function seat(page: Page, name: string) {
    return page.locator(`[data-seat="${name}"]`)
}

export async function openSeat(page: Page, name: string) {
    await seat(page, name).locator('.nt-setup-head').click()
}

export async function takeFromPool(page: Page, face: string) {
    await page.getByRole('button', { name: `Take ${face}`, exact: true }).click()
}

// Workaround: blocks and targets are small SVG shapes under one another's hit areas, so they are clicked directly.
export async function tap(page: Page, selector: string) {
    await page.locator(selector).first().dispatchEvent('click')
}

export async function fillCorps(page: Page, army: Army) {
    for (const [commander, faces] of Object.entries(army)) {
        await openSeat(page, commander)
        for (const face of faces) await takeFromPool(page, face)
    }
}

/** With the Santon in use the fixed battery holds the Santon from the start; otherwise it blocks an approach of Lannes's locale. */
export async function placeFixedBattery(page: Page) {
    await openSeat(page, 'fixed-battery')
    const onTheSanton = await seat(page, 'fixed-battery').locator('.nt-unit-tile').count()
    if (onTheSanton === 0) {
        await takeFromPool(page, ARTILLERY)
        await tap(page, `svg [data-locale="${FIXED_BATTERY_LOCALE}"]`)
        await tap(page, `svg [data-approach="${FIXED_BATTERY_APPROACH}"]`)
    }
}

export async function deployAllies(page: Page) {
    await fillCorps(page, ALLIED_ARMY)
    await page.getByRole('button', { name: 'Deploy the army' }).click()
    await expect(page.locator('[data-seat="lannes"]')).toBeVisible()
}

export async function deployBothArmies(page: Page) {
    await deployAllies(page)
    await fillCorps(page, FRENCH_ARMY)
    await placeFixedBattery(page)
    await page.getByRole('button', { name: 'Deploy the army' }).click()
    await expect(page.locator('.nt-setup')).toHaveCount(0)
    await expect(page.locator('[data-commander="st-hilaire"]')).toBeVisible()
}

/** Rule 11, step 4 at the table: once the attack is pressed, the defender names this many leading units. */
export async function leadDefence(page: Page, leaders = 0) {
    const tiles = page.locator('.nt-turn button[aria-label="Choose this unit"]:not([disabled])')
    for (let named = 0; named < leaders; named++) {
        await tiles.nth(named).click()
    }
    await leadButton(page).click()
}

/** A retreat as the table offers it: the losses as they fall, then every unit where it is sent. */
export async function retreat(page: Page) {
    const takeLosses = page.getByRole('button', { name: 'Take these losses' })
    const commit = page.getByRole('button', { name: 'Retreat', exact: true })
    await expect(takeLosses.or(commit)).toBeVisible()
    if (await takeLosses.isVisible()) {
        await takeLosses.click()
    }
    await commit.click()
}

export function leadButton(page: Page): Locator {
    return page.getByRole('button', { name: /^(Lead with|Defend with no leading unit)/ })
}

export async function openMapMenu(page: Page) {
    const menu = page.getByRole('button', { name: 'Map', exact: true })
    if ((await menu.getAttribute('aria-expanded')) === 'false') {
        await menu.click()
    }
}

// Pieces are labelled for picking up only while the session takes choices, so Playwright waits out an action or Undo still settling.
/** Taps the threat arrow and, as a Guard unit standing there could announce a Guard Attack, declares the threat without one. */
export async function threatenWithoutTheGuard(page: Page) {
    await tap(page, 'svg [aria-label="Threaten an attack across this approach"]')
    await page.getByRole('button', { name: 'Threaten an attack without the Guard' }).click()
}

export async function pickUp(page: Page, commander: string) {
    await tap(page, `[data-commander="${commander}"][aria-label="Select these pieces"]`)
}

export function moveCorps(
    state: NapoleonsTriumphGameState,
    commanderId: string,
    position: Position
) {
    for (const unit of state.units.filter((entry) => entry.commanderId === commanderId)) {
        unit.position = { ...position }
    }
    for (const commander of state.commanders.filter((entry) => entry.id === commanderId)) {
        commander.position = { ...position }
    }
}

// Workaround: a position that takes many turns to reach is written into the dev harness's own copy of the game, which is then opened again.
export async function rearrange(page: Page, edit: (state: NapoleonsTriumphGameState) => void) {
    const stored: unknown = await page.evaluate(async ({ database, positions }) => {
        const opening = indexedDB.open(database)
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            opening.onsuccess = () => resolve(opening.result)
            opening.onerror = () => reject(opening.error)
        })
        const reading = db.transaction(positions).objectStore(positions).getAll()
        const rows = await new Promise<unknown[]>((resolve, reject) => {
            reading.onsuccess = () => resolve(reading.result)
            reading.onerror = () => reject(reading.error)
        })
        db.close()
        return rows.at(0)
    }, HARNESS_STORE)
    if (!NapoleonsTriumphGameStateValidator.Check(stored)) {
        throw new Error('Expected the harness to hold the whole position of one game')
    }
    edit(stored)
    await page.evaluate(
        async ({ store: { database, positions }, position }) => {
            const opening = indexedDB.open(database)
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                opening.onsuccess = () => resolve(opening.result)
                opening.onerror = () => reject(opening.error)
            })
            const writing = db.transaction(positions, 'readwrite').objectStore(positions)
            await new Promise<void>((resolve, reject) => {
                const put = writing.put(position)
                put.onsuccess = () => resolve()
                put.onerror = () => reject(put.error)
            })
            db.close()
        },
        { store: HARNESS_STORE, position: stored }
    )
    await page.reload()
    await page.getByRole('button', { name: 'Games' }).click()
    await page.getByRole('button', { name: GAME_NAME }).click()
}
