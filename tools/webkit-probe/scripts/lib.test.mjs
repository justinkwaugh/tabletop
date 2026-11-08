import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    descendantsOf,
    formatReport,
    median,
    parseProcessTable,
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
    const text = formatReport({ config, runs: [run(undefined, 400, 50), run('.x {}', 300, 40)] })
    assert.match(text, /open\s+\+300 MB  peak \+310 MB  repaint 50 ms/)
    assert.match(text, /open\s+\+200 MB \(-100\)  peak \+210 MB \(-100\)  repaint 40 ms \(-10\)/)
    assert.match(text, /place \(timed\)\s+longest frame 80 ms, 1 over 50 ms, settled 200 ms/)
})
