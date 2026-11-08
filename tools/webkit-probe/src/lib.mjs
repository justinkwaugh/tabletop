export const WebProcessName = 'WPEWebProcess'
export const FrameBudgetMs = 1000 / 60
export const LongFrameMs = 50

export function parseViewport(text) {
    const match = /^(\d+)x(\d+)$/.exec(text)
    if (!match) throw new Error(`--viewport takes WIDTHxHEIGHT, such as 390x664, not ${text}`)
    return { width: Number(match[1]), height: Number(match[2]) }
}

export function parseProcessTable(output) {
    return output
        .split('\n')
        .map((line) => line.trim().split(/\s+/))
        .filter((fields) => fields.length >= 4)
        .map(([pid, ppid, rss, ...command]) => ({
            pid: Number(pid),
            ppid: Number(ppid),
            rssKb: Number(rss),
            command: command.join(' ')
        }))
}

export function descendantsOf(processes, rootPid) {
    const children = new Map()
    for (const entry of processes) {
        const siblings = children.get(entry.ppid) ?? []
        siblings.push(entry)
        children.set(entry.ppid, siblings)
    }
    const found = []
    const pending = [rootPid]
    while (pending.length > 0) {
        for (const child of children.get(pending.pop()) ?? []) {
            found.push(child)
            pending.push(child.pid)
        }
    }
    return found
}

export function webProcessRssMb(processes, rootPid) {
    const webProcesses = descendantsOf(processes, rootPid).filter((entry) =>
        entry.command.endsWith(WebProcessName)
    )
    if (webProcesses.length === 0) return undefined
    return Math.round(Math.max(...webProcesses.map((entry) => entry.rssKb)) / 1024)
}

export function median(values) {
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function summarizeFrames(start, timestamps) {
    let previous = start
    let longestFrameMs = 0
    let longFrames = 0
    let settleMs = 0
    for (const timestamp of timestamps) {
        const frameMs = timestamp - previous
        longestFrameMs = Math.max(longestFrameMs, frameMs)
        if (frameMs > LongFrameMs) longFrames++
        if (frameMs > 2 * FrameBudgetMs) settleMs = timestamp - start
        previous = timestamp
    }
    return {
        longestFrameMs: Math.round(longestFrameMs),
        longFrames,
        settleMs: Math.round(settleMs)
    }
}

function signed(value) {
    return value >= 0 ? `+${value}` : `${value}`
}

function memoryText(mark, blankMb, comparedMark) {
    const over = (mb) => (mb === undefined || blankMb === undefined ? '?' : signed(mb - blankMb))
    const change = (key) =>
        comparedMark?.[key] === undefined || mark[key] === undefined
            ? ''
            : ` (${signed(mark[key] - comparedMark[key])})`
    return `${over(mark.rssMb)} MB${change('rssMb')}  peak ${over(mark.peakMb)} MB${change('peakMb')}`
}

function repaintText(mark, comparedMark) {
    if (mark.repaintMs === undefined) return ''
    const change =
        comparedMark?.repaintMs === undefined
            ? ''
            : ` (${signed(Math.round(mark.repaintMs - comparedMark.repaintMs))})`
    return `  repaint ${Math.round(mark.repaintMs)} ms${change}`
}

function timingText(timing) {
    const settled = timing.settleMs === 0 ? 'settled at once' : `settled ${timing.settleMs} ms`
    return `longest frame ${timing.longestFrameMs} ms, ${timing.longFrames} over ${LongFrameMs} ms, ${settled}`
}

export function formatReport(report) {
    const { config, runs } = report
    const lines = [
        `WebKit ${config.viewport.width}x${config.viewport.height} @${config.dpr}x, ${config.mobile ? 'mobile' : 'desktop'}, ${config.reducedMotion ? 'reduced motion' : 'full motion'}: ${config.url}`,
        'Memory is the web process RSS over a blank page; changes in brackets are against the first run.',
        'A repaint takes two frames at least (about 33 ms); only the time above that is drawing.'
    ]
    const [reference] = runs
    for (const run of runs) {
        lines.push('', run.css === undefined ? 'as served' : `with css: ${run.css}`)
        lines.push(`  ${'blank page'.padEnd(24)}${run.blankMb ?? '?'} MB`)
        for (const mark of run.marks) {
            const compared =
                run === reference ? undefined : reference.marks.find((m) => m.label === mark.label)
            lines.push(
                `  ${mark.label.padEnd(24)}${memoryText(mark, run.blankMb, compared)}${repaintText(mark, compared)}`
            )
        }
        for (const timing of run.timings) {
            lines.push(`  ${`${timing.label} (timed)`.padEnd(24)}${timingText(timing)}`)
        }
    }
    return lines.join('\n')
}
