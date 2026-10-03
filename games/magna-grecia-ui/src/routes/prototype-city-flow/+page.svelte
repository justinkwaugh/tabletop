<script lang="ts">
    // PROTOTYPE, throwaway: three motion styles for city tiles (?variant=A|B|C, ?speed=0.5).
    // Run: `pnpm dev` in games/magna-grecia-ui, open /prototype-city-flow
    import { page } from '$app/state'
    import { goto } from '$app/navigation'
    import { hexCenter, localHexPoints, HEX } from '$lib/utils/boardGeometry.js'
    import { mixColor } from '$lib/utils/colorMix.js'
    import TempleArt from '$lib/components/board/TempleArt.svelte'
    import {
        SCENARIOS,
        VARIANT_NAMES,
        backgroundSpaces,
        frame,
        makePlan,
        timing,
        totalDuration,
        type Variant
    } from './cityFlowPrototype.js'
    import '../../app.css'

    const VARIANTS: Variant[] = ['A', 'B', 'C', 'D']
    const variant = $derived((page.url.searchParams.get('variant') ?? 'A') as Variant)
    const speedParam = Number(page.url.searchParams.get('speed') ?? '1')
    let speed = $state(speedParam > 0 ? speedParam : 1)
    const color = page.url.searchParams.get('color') ?? '#c8461f'

    let scenarioIndex = $state(Number(page.url.searchParams.get('scenario') ?? '1'))
    let t = $state(0)
    let playing = $state(false)
    let playAll = $state(false)

    const scenario = $derived(SCENARIOS[scenarioIndex])
    const plan = $derived(makePlan(scenario))
    // ?compare=A,C plays several variants side by side on one clock
    const shown = $derived(
        (page.url.searchParams.get('compare')?.split(',') as Variant[] | undefined) ?? [variant]
    )
    const total = $derived(Math.max(...shown.map((v) => totalDuration(timing(v, plan)))))
    const background = $derived(backgroundSpaces(scenario).map(hexCenter))
    const hexShape = localHexPoints()

    const OUTLINE = '#1d1a17'
    const band = mixColor(color, '#2a1a0a', 0.22)
    const houseShadow = mixColor(color, '#2a1a0a', 0.16)
    const roof = mixColor(color, '#fffaf0', 0.16)
    const roofShade = mixColor(color, '#fffaf0', 0.07)
    const TINTS = ['#d6b564', '#d1af5d', '#d7b96c', '#cbac5a', '#d3b360']

    const viewBox = $derived.by(() => {
        const pts = backgroundSpaces(scenario).map(hexCenter)
        const xs = pts.map((p) => p.x)
        const ys = pts.map((p) => p.y)
        const pad = -HEX.xRadius * 0.6
        const x0 = Math.min(...xs) - pad
        const y0 = Math.min(...ys) - pad
        return `${x0} ${y0} ${Math.max(...xs) + pad - x0} ${Math.max(...ys) + pad - y0}`
    })

    let raf = 0
    let last = 0
    let holdUntil = 0
    function tick(now: number) {
        if (!playing) return
        if (holdUntil) {
            if (now < holdUntil) {
                raf = requestAnimationFrame(tick)
                return
            }
            holdUntil = 0
            last = now
        }
        t = Math.min(total, t + (now - last) * speed)
        last = now
        if (t >= total) {
            if (playAll && scenarioIndex < SCENARIOS.length - 1) {
                holdUntil = now + 900
                raf = requestAnimationFrame(() => {
                    scenarioIndex += 1
                    t = 0
                    raf = requestAnimationFrame(tick)
                })
                return
            }
            playing = false
            playAll = false
            ;(window as unknown as { protoDone: boolean }).protoDone = true
            return
        }
        raf = requestAnimationFrame(tick)
    }
    function play(index = scenarioIndex, all = false) {
        cancelAnimationFrame(raf)
        ;(window as unknown as { protoDone: boolean }).protoDone = false
        scenarioIndex = index
        playAll = all
        t = 0
        playing = true
        last = performance.now()
        holdUntil = last + 500
        raf = requestAnimationFrame(tick)
    }
    ;(window as unknown as { protoPlayAll: () => void }).protoPlayAll = () => play(0, true)
    ;(window as unknown as { protoSet: (i: number, ms: number) => void }).protoSet = (i, ms) => {
        playing = false
        scenarioIndex = i
        t = ms
    }

    function setVariant(v: Variant) {
        const url = new URL(page.url)
        url.searchParams.set('variant', v)
        goto(url, { replaceState: true, noScroll: true, keepFocus: true })
        play()
    }
    function cycle(dir: number) {
        const i = VARIANTS.indexOf(variant)
        setVariant(VARIANTS[(i + dir + VARIANTS.length) % VARIANTS.length])
    }
    function onKey(e: KeyboardEvent) {
        const el = e.target as HTMLElement
        if (el.closest('input, textarea, [contenteditable]')) return
        if (e.key === 'ArrowLeft') cycle(-1)
        if (e.key === 'ArrowRight') cycle(1)
        if (e.key === ' ') {
            e.preventDefault()
            play()
        }
    }
</script>

<svelte:window onkeydown={onKey} />

<div class="proto">
    <div class="controls">
        <strong>PROTOTYPE · city tile flow</strong>
        {#each SCENARIOS as s, i (s.name)}
            <button class:on={i === scenarioIndex} onclick={() => play(i)}>{s.name}</button>
        {/each}
        <button onclick={() => play(0, true)}>Play all</button>
        <label
            >speed
            <select bind:value={speed}>
                <option value={1}>1×</option>
                <option value={0.5}>0.5×</option>
                <option value={0.25}>0.25×</option>
            </select>
        </label>
        <input
            type="range"
            min="0"
            max={total}
            step="1"
            bind:value={t}
            oninput={() => (playing = false)}
        />
        <span class="t">{Math.round(t)} / {Math.round(total)} ms</span>
    </div>

    <div class="stages">
        {#each shown as v (v)}
            {@const f = frame(v, plan, timing(v, plan), t)}
            <div class="stage">
                <div class="caption">{v} · {VARIANT_NAMES[v]} · {scenario.name}</div>
                <svg {viewBox} preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <filter id="proto-shadow" x="-10%" y="-10%" width="125%" height="130%">
                            <feDropShadow
                                dx="1.5"
                                dy="2.5"
                                stdDeviation="1.6"
                                flood-color="#3a2410"
                                flood-opacity="0.45"
                            ></feDropShadow>
                        </filter>
                        <clipPath id="proto-city-{v}">
                            {#each plan.staticTiles as c, i (i)}
                                <polygon points={hexShape} transform="translate({c.x} {c.y})"
                                ></polygon>
                            {/each}
                            {#each f.regionPaths as r, i (i)}
                                {#if v === 'B'}
                                    <path d={r.d}></path>
                                {:else}
                                    <path d={r.d}></path>
                                {/if}
                            {/each}
                        </clipPath>
                    </defs>

                    {#each background as c, i (i)}
                        <polygon
                            points={hexShape}
                            transform="translate({c.x} {c.y})"
                            fill={TINTS[i % TINTS.length]}
                            stroke="#c4a352"
                            stroke-width="1"
                        ></polygon>
                    {/each}

                    <g filter="url(#proto-shadow)">
                        <g clip-path="url(#proto-city-{v})">
                            {#each plan.staticTiles as c, i (i)}
                                <polygon
                                    points={hexShape}
                                    transform="translate({c.x} {c.y})"
                                    fill={color}
                                ></polygon>
                            {/each}
                            {#each f.regionPaths as r, i (i)}
                                <path d={r.d} fill={color} opacity={r.opacity}></path>
                            {/each}
                            {#each plan.staticEdges as e, i (i)}
                                <line
                                    x1={e.from.x}
                                    y1={e.from.y}
                                    x2={e.to.x}
                                    y2={e.to.y}
                                    stroke={band}
                                    stroke-width="8"
                                    stroke-linecap="round"
                                ></line>
                            {/each}
                            {#if f.sharedEdgeOpacity > 0}
                                {#each plan.sharedEdges as e, i (i)}
                                    <line
                                        x1={e.from.x}
                                        y1={e.from.y}
                                        x2={e.to.x}
                                        y2={e.to.y}
                                        stroke={band}
                                        stroke-width="8"
                                        stroke-linecap="round"
                                        opacity={f.sharedEdgeOpacity}
                                    ></line>
                                {/each}
                            {/if}
                            {#each f.animatedEdges as e, i (i)}
                                <path
                                    d={e.d}
                                    fill="none"
                                    stroke={band}
                                    stroke-width="8"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    opacity={e.opacity}
                                    stroke-dasharray={e.dash}
                                ></path>
                            {/each}
                            {#each f.houses as { house, scale, opacity }, i (i)}
                                {#if opacity > 0}
                                    {@const x = -house.length / 2}
                                    {@const y = -house.depth / 2}
                                    <g
                                        transform="translate({house.center.x} {house.center
                                            .y}) rotate({house.rotation}) scale({scale})"
                                        {opacity}
                                    >
                                        <rect
                                            x={x + 0.9}
                                            y={y + 1.1}
                                            width={house.length}
                                            height={house.depth}
                                            rx="0.7"
                                            fill={houseShadow}
                                        ></rect>
                                        <rect
                                            {x}
                                            {y}
                                            width={house.length}
                                            height={house.depth}
                                            rx="0.7"
                                            fill={roof}
                                        ></rect>
                                        <rect
                                            {x}
                                            y="0"
                                            width={house.length}
                                            height={house.depth / 2}
                                            fill={roofShade}
                                        ></rect>
                                    </g>
                                {/if}
                            {/each}
                            {#each f.temples as temple, i (i)}
                                {#if temple.opacity > 0}
                                    <g
                                        transform="translate({temple.point.x} {temple.point.y})"
                                        opacity={temple.opacity}
                                    >
                                        <g
                                            transform="translate(0 11.5) scale({0.6 +
                                                0.4 *
                                                    temple.rise} {temple.rise}) translate(0 -11.5)"
                                        >
                                            <TempleArt {color} />
                                        </g>
                                    </g>
                                {/if}
                            {/each}
                        </g>
                        {#each plan.staticEdges as e, i (i)}
                            <line
                                x1={e.from.x}
                                y1={e.from.y}
                                x2={e.to.x}
                                y2={e.to.y}
                                stroke={OUTLINE}
                                stroke-width="1.2"
                                stroke-linecap="round"
                            ></line>
                        {/each}
                        {#if f.sharedEdgeOpacity > 0}
                            {#each plan.sharedEdges as e, i (i)}
                                <line
                                    x1={e.from.x}
                                    y1={e.from.y}
                                    x2={e.to.x}
                                    y2={e.to.y}
                                    stroke={OUTLINE}
                                    stroke-width="1.2"
                                    stroke-linecap="round"
                                    opacity={f.sharedEdgeOpacity}
                                ></line>
                            {/each}
                        {/if}
                        {#each f.animatedEdges as e, i (i)}
                            <path
                                d={e.d}
                                fill="none"
                                stroke={OUTLINE}
                                stroke-width="1.2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                opacity={e.opacity}
                                stroke-dasharray={e.dash}
                            ></path>
                        {/each}
                    </g>
                </svg>
            </div>
        {/each}
    </div>

    <div class="switcher">
        <button onclick={() => cycle(-1)} aria-label="Previous variant">←</button>
        <span>{variant} ({VARIANT_NAMES[variant]})</span>
        <button onclick={() => cycle(1)} aria-label="Next variant">→</button>
    </div>
</div>

<style>
    .proto {
        min-height: 100vh;
        background: #f3ecdc;
        color: #4a2c12;
        font-family: system-ui, sans-serif;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        font-size: 14px;
    }
    .controls button {
        border: 1px solid #8c5b2e;
        border-radius: 999px;
        padding: 2px 12px;
        background: #fbf7ee;
    }
    .controls button.on {
        background: #6b3f1d;
        color: #fbf3dc;
    }
    .t {
        font-variant-numeric: tabular-nums;
        width: 110px;
    }
    .stages {
        display: flex;
    }
    .stage {
        flex: 1;
        min-width: 0;
        position: relative;
        height: calc(100vh - 60px);
    }
    .caption {
        position: absolute;
        top: 6px;
        left: 16px;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 22px;
        letter-spacing: 0.05em;
    }
    svg {
        width: 100%;
        height: 100%;
    }
    .switcher {
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 14px;
        border-radius: 999px;
        background: #111;
        color: #fff;
        font-size: 14px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }
    .switcher button {
        padding: 0 6px;
        font-size: 16px;
    }
</style>
