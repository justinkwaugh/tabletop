import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    combineRepeats,
    descendantsOf,
    formatReport,
    median,
    parseProcessTable,
    parseRepeat,
    parseViewport,
    summarizeFrames,
    webProcessRssMb
} from '../src/lib.mjs'

const table = `
    10     1  50000 node
    20    10  10000 pw_run.sh
    21    20  80000 MiniBrowser
    22    21 307200 WPEWebProcess
    23    21  40000 WPENetworkProcess
    30     1 512000 WPEWebProcess
`

test('reads the viewport size', () => {
    assert.deepEqual(parseViewport('390x664'), { width: 390, height: 664 })
    assert.throws(() => parseViewport('390'))
})

test('finds only the web process launched under the probe', () => {
    const processes = parseProcessTable(table)
    assert.deepEqual(
        descendantsOf(processes, 10).map((entry) => entry.pid),
        [20, 21, 22, 23]
    )
    assert.equal(webProcessRssMb(processes, 10), 300)
    assert.equal(webProcessRssMb(processes, 23), undefined)
})

test('takes the median of odd and even counts', () => {
    assert.equal(median([3, 1, 2]), 2)
    assert.equal(median([4, 1, 3, 2]), 2.5)
})

test('summarizes frames from the start of an action', () => {
    assert.deepEqual(summarizeFrames(0, [16, 33, 120, 136, 153]), {
        longestFrameMs: 87,
        longFrames: 1,
        settleMs: 120
    })
    assert.deepEqual(summarizeFrames(0, [16, 33, 50]), {
        longestFrameMs: 17,
        longFrames: 0,
        settleMs: 0
    })
})

test('reports later runs against the first', () => {
    const config = {
        url: 'http://localhost:5186',
        viewport: { width: 390, height: 664 },
        dpr: 3,
        mobile: true,
        reducedMotion: true
    }
    const run = (css, rssMb, repaintMs) => ({
        css,
        blankMb: 100,
        marks: [{ label: 'open', rssMb, peakMb: rssMb + 10, repaintMs }],
        timings: [{ label: 'place', longestFrameMs: 80, longFrames: 1, settleMs: 200 }]
    })
    const text = formatReport({
        config,
        runs: [run(undefined, 400, 50), run('.x {}', 300, 40), run('.y {}', 300, null)]
    })
    assert.match(text, /open\s+\+300 MB  peak \+310 MB  repaint 50 ms/)
    assert.match(text, /open\s+\+200 MB \(-100\)  peak \+210 MB \(-100\)  repaint 40 ms \(-10\)/)
    assert.match(text, /place \(timed\)\s+longest frame 80 ms, 1 over 50 ms, settled 200 ms/)
    assert.match(text, /open\s+\+200 MB \(-100\)  peak \+210 MB \(-100\)  no board/)
})

test('reports a page that reloaded during a timed action', () => {
    const config = {
        url: 'http://localhost:5186',
        viewport: { width: 390, height: 664 },
        dpr: 3,
        mobile: true,
        reducedMotion: false
    }
    const runs = [{ blankMb: 100, marks: [], timings: [{ label: 'place', reloaded: true }] }]
    assert.match(formatReport({ config, runs }), /place \(timed\)\s+page reloaded/)
})

test('accepts only a whole number of repeats', () => {
    assert.equal(parseRepeat('3'), 3)
    assert.throws(() => parseRepeat('0'))
    assert.throws(() => parseRepeat('abc'))
    assert.throws(() => parseRepeat('1.5'))
})

const repeatOf = (blankMb, marks, timings = []) => ({ css: undefined, blankMb, marks, timings })

test("combines repeated runs by rounded medians over each run's blank page", () => {
    const run = (blankMb, rssMb, repaintMs, longestFrameMs) =>
        repeatOf(
            blankMb,
            [{ label: 'open', rssMb, peakMb: rssMb + 10, repaintMs }],
            [{ label: 'place', longestFrameMs, longFrames: 1, settleMs: 0 }]
        )
    const odd = combineRepeats([run(100, 400, 40, 30), run(110, 380, 60, 50), run(90, 500, 50, 40)])
    assert.equal(odd.blankMb, 100)
    assert.deepEqual(odd.marks[0], {
        label: 'open',
        measured: 3,
        rssMb: 400,
        peakMb: 410,
        repaintMs: 50,
        boardMissing: 0
    })
    assert.equal(odd.timings[0].longestFrameMs, 40)
    const even = combineRepeats([run(100, 401, 40, 30), run(100, 400, 41, 31)])
    assert.equal(even.marks[0].rssMb, 401)
    assert.equal(even.marks[0].repaintMs, 41)
})

test('matches marks by label and occurrence, not position', () => {
    const combined = combineRepeats([
        repeatOf(100, [
            { label: 'open', rssMb: 300 },
            { label: 'bonus', rssMb: 900 },
            { label: 'after', rssMb: 400 }
        ]),
        repeatOf(100, [
            { label: 'open', rssMb: 310 },
            { label: 'after', rssMb: 420 }
        ])
    ])
    assert.deepEqual(
        combined.marks.map((mark) => [mark.label, mark.rssMb, mark.measured]),
        [
            ['open', 305, 2],
            ['bonus', 900, 1],
            ['after', 410, 2]
        ]
    )
})

test('says when only some runs had a board or reloaded', () => {
    const combined = combineRepeats([
        repeatOf(
            100,
            [{ label: 'open', rssMb: 300, repaintMs: null }],
            [{ label: 'place', reloaded: true }]
        ),
        repeatOf(
            100,
            [{ label: 'open', rssMb: 300, repaintMs: 60 }],
            [{ label: 'place', longestFrameMs: 80, longFrames: 1, settleMs: 200 }]
        )
    ])
    assert.equal(combined.marks[0].repaintMs, 60)
    assert.equal(combined.marks[0].boardMissing, 1)
    assert.equal(combined.timings[0].reloaded, 1)
    const config = {
        url: 'http://localhost:5186',
        viewport: { width: 390, height: 664 },
        dpr: 3,
        mobile: true,
        reducedMotion: false,
        repeat: 2
    }
    const text = formatReport({ config, runs: [combined] })
    assert.match(text, /repaint 60 ms, no board in 1 of 2 runs/)
    assert.match(text, /settled 200 ms; page reloaded in 1 of 2 runs/)
})
