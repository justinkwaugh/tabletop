import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { createGame, deployBothArmies, failOnPageErrors } from './table.js'

failOnPageErrors()

const ART = { width: 3400, height: 4400 }
const START_OF_FRAME = [0xc0, 0xc1, 0xc2]

function jpegSize(bytes: Buffer): { width: number; height: number } {
    let at = 2
    while (at < bytes.length) {
        const marker = bytes[at + 1]
        if (START_OF_FRAME.includes(marker)) {
            return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) }
        }
        at += 2 + bytes.readUInt16BE(at + 2)
    }
    throw new Error('Expected a JPEG with a frame header')
}

async function savedPicture(page: Page) {
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Save image' }).click()
    ])
    const path = await download.path()
    return { name: download.suggestedFilename(), size: jpegSize(await readFile(path)) }
}

test('the map menu saves a picture of the whole board as it is turned', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)

    const fromTheAlliedLines = await savedPicture(page)
    expect(fromTheAlliedLines.name).toBe('napoleons-triumph-2-december-7-00am.jpg')
    expect(fromTheAlliedLines.size).toEqual({ width: ART.height, height: ART.width })

    await page.getByRole('button', { name: 'North' }).click()
    const northUp = await savedPicture(page)
    expect(northUp.size).toEqual(ART)
    await expect(page.getByRole('button', { name: 'Save image' })).toBeEnabled()
})

test('a picture saved without unit types says so in its name and leaves the board on screen as it was', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    const faces = page.locator('svg[data-board] [data-unit-face]')
    const shown = await faces.count()
    expect(shown).toBeGreaterThan(0)

    const withUnitTypes = page.getByRole('button', { name: 'with unit types' })
    await expect(withUnitTypes).toHaveAttribute('aria-pressed', 'true')
    await withUnitTypes.click()
    await expect(withUnitTypes).toHaveAttribute('aria-pressed', 'false')

    const picture = await savedPicture(page)
    expect(picture.name).toBe('napoleons-triumph-2-december-7-00am-unit-types-hidden.jpg')
    expect(picture.size).toEqual({ width: ART.height, height: ART.width })
    await expect(faces).toHaveCount(shown)
})
