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

export function parseRepeat(text) {
    const repeat = Number(text)
    if (!Number.isInteger(repeat) || repeat < 1) {
        throw new Error(`--repeat takes a whole number of at least 1, not ${text}`)
    }
    return repeat
}

function present(values) {
    return values.filter((value) => value !== undefined && value !== null)
}

function roundedMedian(values) {
    const known = present(values)
    return known.length > 0 ? Math.round(median(known)) : undefined
}

function byOccurrence(entries) {
    const seen = new Map()
    return new Map(
        entries.map((entry) => {
            const occurrence = seen.get(entry.label) ?? 0
            seen.set(entry.label, occurrence + 1)
            return [`${entry.label}#${occurrence}`, entry]
        })
    )
}

function combineMarks(repeats, blankMb) {
    const marksOf = repeats.map((run) => byOccurrence(run.marks))
    const keys = [...new Set(marksOf.flatMap((marks) => [...marks.keys()]))]
    return keys.map((key) => {
        const same = repeats
            .map((run, index) => ({ run, mark: marksOf[index].get(key) }))
            .filter(({ mark }) => mark !== undefined)
        const overBlank = (field) =>
            roundedMedian(
                same.map(({ run, mark }) =>
                    mark[field] === undefined || run.blankMb === undefined
                        ? undefined
                        : mark[field] - run.blankMb
                )
            )
        const over = (field) => {
            const mb = overBlank(field)
            return mb === undefined || blankMb === undefined ? undefined : blankMb + mb
        }
        const repaints = same.map(({ mark }) => mark.repaintMs)
        const boardMissing = repaints.filter((repaint) => repaint === null).length
        return {
            label: same[0].mark.label,
            measured: same.length,
            rssMb: over('rssMb'),
            peakMb: over('peakMb'),
            repaintMs: boardMissing === same.length ? null : roundedMedian(repaints),
            boardMissing
        }
    })
}

function combineTimings(repeats) {
    const timingsOf = repeats.map((run) => byOccurrence(run.timings))
    const keys = [...new Set(timingsOf.flatMap((timings) => [...timings.keys()]))]
    return keys.map((key) => {
        const same = timingsOf.map((timings) => timings.get(key)).filter((timing) => timing)
        const settled = same.filter((timing) => !timing.reloaded)
        return {
            label: same[0].label,
            measured: same.length,
            reloaded: same.length - settled.length,
            longestFrameMs: roundedMedian(settled.map((timing) => timing.longestFrameMs)),
            longFrames: roundedMedian(settled.map((timing) => timing.longFrames)),
            settleMs: roundedMedian(settled.map((timing) => timing.settleMs))
        }
    })
}

export function combineRepeats(repeats) {
    const blankMb = roundedMedian(repeats.map((run) => run.blankMb))
    return {
        css: repeats[0].css,
        repeats: repeats.length,
        blankMb,
        marks: combineMarks(repeats, blankMb),
        timings: combineTimings(repeats)
    }
}

function outOf(count, run) {
    return run.repeats > 1 ? ` in ${count} of ${run.repeats} runs` : ''
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

function repaintText(mark, comparedMark, run) {
    if (mark.repaintMs === undefined) return ''
    if (mark.repaintMs === null) return '  no board'
    const change =
        comparedMark?.repaintMs == null
            ? ''
            : ` (${signed(Math.round(mark.repaintMs - comparedMark.repaintMs))})`
    const missing = mark.boardMissing > 0 ? `, no board${outOf(mark.boardMissing, run)}` : ''
    return `  repaint ${Math.round(mark.repaintMs)} ms${change}${missing}`
}

function timingText(timing, run) {
    if (timing.longestFrameMs === undefined) return 'page reloaded'
    const settled = timing.settleMs === 0 ? 'settled at once' : `settled ${timing.settleMs} ms`
    const reloaded = timing.reloaded > 0 ? `; page reloaded${outOf(timing.reloaded, run)}` : ''
    return `longest frame ${timing.longestFrameMs} ms, ${timing.longFrames} over ${LongFrameMs} ms, ${settled}${reloaded}`
}

function measuredText(entry, run) {
    return entry.measured < run.repeats ? ` (marked${outOf(entry.measured, run)})` : ''
}

export function formatReport(report) {
    const { config, runs } = report
    const lines = [
        `WebKit ${config.viewport.width}x${config.viewport.height} @${config.dpr}x, ${config.mobile ? 'mobile' : 'desktop'}, ${config.reducedMotion ? 'reduced motion' : 'full motion after loading'}: ${config.url}`,
        `Memory is the web process RSS over a blank page${config.repeat > 1 ? `; figures are medians of ${config.repeat} runs` : ''}; changes in brackets are against the page as served.`,
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
                `  ${mark.label.padEnd(24)}${memoryText(mark, run.blankMb, compared)}${repaintText(mark, compared, run)}${measuredText(mark, run)}`
            )
        }
        for (const timing of run.timings) {
            lines.push(
                `  ${`${timing.label} (timed)`.padEnd(24)}${timingText(timing, run)}${measuredText(timing, run)}`
            )
        }
    }
    return lines.join('\n')
}
