import { test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
test.use({ baseURL: 'http://localhost:5191', viewport: { width: Number(process.env.W ?? 960), height: Number(process.env.H ?? 600) }, video: { mode: 'on', size: { width: Number(process.env.W ?? 960), height: Number(process.env.H ?? 600) } } })
test('video', async ({ page }, info) => {
    const t0 = Date.now()
    const v = process.env.VARIANT!
    await page.goto(`/prototype-city-flow?${process.env.QUERY ?? 'variant=' + v}`)
    await page.waitForFunction(() => 'protoPlayAll' in window)
    await page.addStyleTag({ content: '.controls,.switcher{display:none!important}.stage{height:100vh!important}.caption{font-size:${process.env.CAP ?? 28}px!important;top:14px!important}' })
    await page.waitForTimeout(400)
    const marks: number[] = []
    for (const speed of (process.env.SPEEDS ?? '1').split(',')) {
        await page.evaluate((s) => {
            const sel = document.querySelector('select') as HTMLSelectElement
            sel.value = s; sel.dispatchEvent(new Event('change'))
        }, speed)
        await page.waitForTimeout(100)
        marks.push(Date.now() - t0)
        await page.evaluate(() => (window as any).protoPlayAll())
        await page.waitForFunction(() => (window as any).protoDone === true, null, { timeout: 60000, polling: 50 })
        await page.waitForTimeout(700)
    }
    marks.push(Date.now() - t0)
    writeFileSync(`/tmp/mgproto/${v}.marks`, JSON.stringify(marks))
    await page.close()
    await page.video()!.saveAs(`/tmp/mgproto/${v}.webm`)
})
