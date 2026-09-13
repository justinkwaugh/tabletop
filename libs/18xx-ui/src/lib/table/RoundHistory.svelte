<script lang="ts">
    import type { Snippet } from 'svelte'
    import { assertExists } from '@tabletop/common'
    import { roundHeaderPositions, type HistoryRound } from './historyRounds.js'
    let {
        rounds,
        children,
        phaseColors
    }: {
        rounds: HistoryRound[]
        children: Snippet<[HistoryRound]>
        phaseColors: Readonly<Record<string, string>>
    } = $props()
    const rowHeight = 20
    function phaseBackground(round: HistoryRound) {
        const colors = round.phases
            .map((phase) => {
                const color = phaseColors[phase]
                assertExists(color, `Unknown history phase color: ${phase}`)
                return `color-mix(in srgb, ${color} 38%, #f7f5f0)`
            })
            .filter((color, index, all) => index === 0 || color !== all[index - 1])
        return `linear-gradient(to bottom right, ${colors
            .map(
                (color, index) =>
                    `${color} ${(index * 100) / colors.length}% ${((index + 1) * 100) / colors.length}%`
            )
            .join(', ')})`
    }
    let scrollToRound: (id: string) => void = () => {}
    function attach(root: HTMLElement) {
        const viewport = root.querySelector<HTMLElement>('.history-scroll')!
        const content = root.querySelector<HTMLElement>('.history-content')!
        let frame = 0
        let markers: HTMLElement[] = []
        let buttons: HTMLButtonElement[] = []
        let bands: HTMLElement[] = []
        let offsets: number[] = []
        function draw() {
            frame = 0
            const headers = markers.map((marker, index) => ({
                group: marker.dataset.group!,
                top: offsets[index] - viewport.scrollTop
            }))
            const positions = roundHeaderPositions(headers, viewport.clientHeight, rowHeight)
            for (let i = 0; i < markers.length; i++) {
                const inline = Math.abs(positions[i] - headers[i].top) < 1 &&
                    positions[i] > 0 && positions[i] < viewport.clientHeight - rowHeight
                bands[i].dataset.inline = String(inline)
                buttons[i].dataset.inline = String(inline)
                bands[i].style.transform = `translateY(${positions[i]}px)`
                buttons[i].style.transform = `translateY(${positions[i]}px)`
                const next = headers.findIndex(
                    (header, index) =>
                        index < i &&
                        header.group === headers[i].group &&
                        Math.abs(positions[index] - positions[i]) < 1
                )
                buttons[i].dataset.joined = String(next >= 0)
                for (const [side, neighbor] of [
                    ['left', i + 1],
                    ['right', i - 1]
                ] as const) {
                    const radius =
                        headers[neighbor]?.group === headers[i].group
                            ? Math.min(5, Math.abs(positions[neighbor] - positions[i]))
                            : 0
                    buttons[i].style.setProperty(`--${side}-radius`, `${radius}px`)
                }
            }
        }
        function schedule() {
            if (!frame) frame = requestAnimationFrame(draw)
        }
        function measure() {
            markers = [...content.querySelectorAll<HTMLElement>('[data-round-marker]')]
            buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-round-link]')]
            bands = [...root.querySelectorAll<HTMLElement>('[data-round-band]')]
            offsets = markers.map((marker) => marker.offsetTop)
            schedule()
        }
        scrollToRound = (id) => {
            const index = markers.findIndex((marker) => marker.dataset.roundMarker === id)
            if (index < 0) return
            const groupsBelow = new Set(markers.slice(index).map((marker) => marker.dataset.group))
            const top = viewport.clientHeight - groupsBelow.size * rowHeight
            viewport.scrollTo({
                top: offsets[index] - top,
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'instant'
                    : 'smooth'
            })
        }
        const resize = new ResizeObserver(measure)
        resize.observe(viewport)
        resize.observe(content)
        const mutation = new MutationObserver(measure)
        mutation.observe(content, { childList: true, subtree: true })
        viewport.addEventListener('scroll', schedule, { passive: true })
        measure()
        return {
            destroy() {
                resize.disconnect()
                mutation.disconnect()
                viewport.removeEventListener('scroll', schedule)
                cancelAnimationFrame(frame)
                scrollToRound = () => {}
            }
        }
    }
</script>

<div class="round-history" style:--round-height={`${rowHeight}px`} use:attach>
    <div class="history-scroll" role="region" aria-label="Scrollable history">
        <nav aria-label="History rounds">
            {#each rounds as round (round.id)}
                <div class="round-band" data-round-band aria-hidden="true"></div>
            {/each}
            {#each rounds as round (round.id)}
                {@const siblings = rounds.filter((r) => r.group === round.group).toReversed()}
                <button
                    data-round-link={round.id}
                    aria-label={`Scroll to ${round.label}`}
                    title={`${round.label} · Phase ${round.phases.join(' → ')}`}
                    style:background={phaseBackground(round)}
                    style:left={`${(siblings.findIndex((r) => r.id === round.id) / siblings.length) * 100}%`}
                    style:width={`${100 / siblings.length}%`}
                    onclick={() => scrollToRound(round.id)}
                >
                    {round.label}<span class="separator" aria-hidden="true"></span>
                </button>
            {/each}
        </nav>
        <ol class="history-content" aria-label="Action history">
            {#each rounds as round (round.id)}
                <li class="round-section" aria-label={round.label}>
                    {@render children(round)}
                    <div
                        class="round-marker"
                        data-round-marker={round.id}
                        data-group={round.group}
                    ></div>
                </li>
            {:else}<li class="empty">No actions yet.</li>{/each}
            <li
                class="end-space"
                aria-hidden="true"
                style:height={`${new Set(rounds.map((r) => r.group)).size * rowHeight}px`}
            ></li>
        </ol>
    </div>
</div>

<style>
    .round-history {
        position: relative;
        height: 100%;
        min-height: 0;
        overflow: hidden;
    }
    .history-scroll {
        height: 100%;
        overflow-y: auto;
        scrollbar-width: thin;
        overscroll-behavior: contain;
    }
    .history-content {
        position: relative;
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .round-section {
        margin: 0;
        padding: 0;
    }
    .round-marker {
        height: var(--round-height);
    }
    nav {
        position: sticky;
        top: 0;
        height: 0;
        z-index: 2;
        pointer-events: none;
        overflow: visible;
    }
    .round-band {
        pointer-events: auto;
        position: absolute;
        inset: 0 0 auto;
        height: var(--round-height);
        background: #ece8e1;
        border-bottom: 1px solid #9b93884d;
        box-sizing: border-box;
    }
    .round-band:global([data-inline='true']) {
        background: #6f5c46;
        border-top: 1px solid #6f5c46;
        border-bottom: 1px solid #6f5c46;
    }
    nav button:global([data-inline='true']) {
        border-radius: 0;
        font-size: 11px;
        font-weight: 750;
        color: #29271f;
        box-shadow: inset 0 1px #6f5c46, inset 0 -1px #6f5c46;
    }
    nav button {
        position: absolute;
        top: 0;
        height: var(--round-height);
        padding: 0 3px;
        border: 0;
        border-bottom: 1px solid #514a3d30;
        border-radius: var(--left-radius, 0) var(--right-radius, 0) var(--right-radius, 0)
            var(--left-radius, 0);
        background: transparent;
        color: #39392f;
        font:
            600 10px/var(--round-height) ui-sans-serif,
            system-ui,
            sans-serif;
        letter-spacing: 0.01em;
        cursor: pointer;
        pointer-events: auto;
        white-space: nowrap;
    }
    nav button:hover {
        filter: brightness(1.04);
    }
    nav button:focus-visible {
        outline: 2px solid #8d573a;
        outline-offset: -2px;
    }
    .separator {
        position: absolute;
        right: 0;
        top: 5px;
        bottom: 5px;
        width: 1px;
        background: #514a3d40;
        z-index: 1;
        display: none;
    }
    button:global([data-joined='true']) .separator {
        display: inline;
    }
    .empty {
        padding: 20px 8px;
        color: #7d7266;
        font-size: 13px;
    }
</style>
