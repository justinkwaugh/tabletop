#!/usr/bin/env node
import { webkit } from '@playwright/test'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs, promisify } from 'node:util'
import {
    formatReport,
    median,
    parseProcessTable,
    parseViewport,
    summarizeFrames,
    webProcessRssMb
} from './lib.mjs'

const usage = `Usage: webkit-probe <url> [options]

Opens <url> in Playwright WebKit as a phone and reports the web process's memory
and the board's repaint time, once as served and once more per --css.

Options:
  --scenario <file|name>  load a harness scenario from a JSON file or the Scenarios menu
  --wait <selector>       wait for this element before the first mark
  --steps <file.mjs>      run the module's default export:
                            async ({ page, mark, time, quietly }) => {}
                          mark(label, { settleMs = 1000 }) records memory and repaint there;
                          time(label, action, { windowMs = 1500 }) records frames while
                            action() runs and for windowMs after it starts;
                          quietly(action) runs setup, such as playing a game forward, with
                            reduced motion
  --board <selector>      time repaints of this element at every mark (median of 8); an
                          svg or a box, laid out by its CSS width
  --css <rule>            add a run with this CSS injected after load; repeatable
  --settle <ms>           wait after loading before the "open" mark (default 3000)
  --reduced-motion        keep reduced motion on after loading, for every mark and timing
  --viewport <WxH>        default 390x664
  --dpr <n>               device pixel ratio (default 3)
  --desktop               no mobile viewport or touch
  --json                  print the report as JSON
  -h, --help

Loading and any scenario run with reduced motion; marks and timings see full motion.`

const run = promisify(execFile)

function options() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            scenario: { type: 'string' },
            wait: { type: 'string' },
            steps: { type: 'string' },
            board: { type: 'string' },
            css: { type: 'string', multiple: true, default: [] },
            settle: { type: 'string', default: '3000' },
            viewport: { type: 'string', default: '390x664' },
            dpr: { type: 'string', default: '3' },
            desktop: { type: 'boolean', default: false },
            'reduced-motion': { type: 'boolean', default: false },
            json: { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false }
        }
    })
    if (values.help || positionals.length !== 1) {
        console.log(usage)
        process.exit(values.help ? 0 : 1)
    }
    return {
        url: positionals[0],
        scenario: values.scenario,
        wait: values.wait,
        steps: values.steps && resolve(values.steps),
        board: values.board,
        css: values.css,
        settleMs: Number(values.settle),
        viewport: parseViewport(values.viewport),
        dpr: Number(values.dpr),
        mobile: !values.desktop,
        reducedMotion: values['reduced-motion'],
        json: values.json
    }
}

async function sampleRssMb() {
    const { stdout } = await run('ps', ['-e', '-o', 'pid=,ppid=,rss=,comm='])
    return webProcessRssMb(parseProcessTable(stdout), process.pid)
}

function memorySampler() {
    let peakMb
    let stopped = false
    const loop = async () => {
        while (!stopped) {
            const mb = await sampleRssMb()
            if (mb !== undefined) peakMb = Math.max(peakMb ?? 0, mb)
            await new Promise((done) => setTimeout(done, 40))
        }
    }
    const running = loop()
    return {
        takePeak() {
            const peak = peakMb
            peakMb = undefined
            return peak
        },
        async stop() {
            stopped = true
            await running
        }
    }
}

function pause(ms) {
    return new Promise((done) => setTimeout(done, ms))
}

async function repaintMs(page, selector) {
    const samples = await page.evaluate(async (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const layoutWidth = parseFloat(getComputedStyle(element).width)
        if (!Number.isFinite(layoutWidth)) {
            throw new Error(`--board ${selector} has no CSS width; choose its svg or box`)
        }
        const frame = () => new Promise((done) => requestAnimationFrame(() => done()))
        const width = element.style.width
        const times = []
        for (let i = 0; i < 8; i++) {
            await frame()
            const start = performance.now()
            element.style.width = `${layoutWidth - 1}px`
            await frame()
            await frame()
            times.push(performance.now() - start)
            element.style.width = width
            await frame()
            await frame()
        }
        return times
    }, selector)
    return samples === null ? null : median(samples)
}

async function framesDuring(page, action, windowMs) {
    const start = await page.evaluate(() => {
        const probe = { frames: [], stopped: false }
        window.__webkitProbe = probe
        const record = (timestamp) => {
            probe.frames.push(timestamp)
            if (!probe.stopped) requestAnimationFrame(record)
        }
        requestAnimationFrame(record)
        return performance.now()
    })
    let reloaded = false
    const noteReload = () => {
        reloaded = true
    }
    page.on('load', noteReload)
    const actionStarted = Date.now()
    await action()
    await pause(Math.max(0, windowMs - (Date.now() - actionStarted)))
    page.off('load', noteReload)
    if (reloaded) return { reloaded: true }
    const frames = await page.evaluate(() => {
        window.__webkitProbe.stopped = true
        return window.__webkitProbe.frames
    })
    return summarizeFrames(start, frames)
}

async function loadScenario(page, scenario) {
    if (existsSync(scenario)) {
        await page.locator('input[aria-label="Scenario file"]').setInputFiles(resolve(scenario))
        return
    }
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(scenario, { exact: true }).click()
}

async function probe(config, css) {
    const browser = await webkit.launch()
    const sampler = memorySampler()
    try {
        const context = await browser.newContext({
            viewport: config.viewport,
            deviceScaleFactor: config.dpr,
            isMobile: config.mobile,
            hasTouch: config.mobile,
            reducedMotion: 'reduce'
        })
        const page = await context.newPage()
        await pause(1000)
        const blankMb = await sampleRssMb()
        sampler.takePeak()

        const marks = []
        const timings = []
        const mark = async (label, { settleMs = 1000 } = {}) => {
            await pause(settleMs)
            const rssMb = await sampleRssMb()
            const repaint = config.board ? await repaintMs(page, config.board) : undefined
            const samples = [sampler.takePeak(), rssMb].filter((mb) => mb !== undefined)
            const peakMb = samples.length > 0 ? Math.max(...samples) : undefined
            marks.push({ label, rssMb, peakMb, repaintMs: repaint })
        }
        const time = async (label, action, { windowMs = 1500 } = {}) => {
            timings.push({ label, ...(await framesDuring(page, action, windowMs)) })
        }
        const motion = config.reducedMotion ? 'reduce' : 'no-preference'
        const quietly = async (action) => {
            await page.emulateMedia({ reducedMotion: 'reduce' })
            try {
                await action()
            } finally {
                await page.emulateMedia({ reducedMotion: motion })
            }
        }

        await page.goto(config.url, { waitUntil: 'networkidle' })
        if (config.scenario) await loadScenario(page, config.scenario)
        if (config.wait) await page.locator(config.wait).first().waitFor()
        if (css !== undefined) await page.addStyleTag({ content: css })
        await page.emulateMedia({ reducedMotion: motion })
        await mark('open', { settleMs: config.settleMs })

        if (config.steps) {
            const { default: steps } = await import(pathToFileURL(config.steps).href)
            try {
                await steps({ page, mark, time, quietly })
            } catch (error) {
                const screenshot = join(tmpdir(), `webkit-probe-failure-${Date.now()}.png`)
                await page.screenshot({ path: screenshot })
                console.error(`Steps failed; the page at that moment: ${screenshot}`)
                throw error
            }
        }
        return { css, blankMb, marks, timings }
    } finally {
        await sampler.stop()
        await browser.close()
    }
}

const config = options()
const runs = []
for (const css of [undefined, ...config.css]) {
    console.error(css === undefined ? 'Probing as served…' : `Probing with css: ${css}…`)
    runs.push(await probe(config, css))
}
const report = { config, runs }
console.log(config.json ? JSON.stringify(report, null, 2) : formatReport(report))
