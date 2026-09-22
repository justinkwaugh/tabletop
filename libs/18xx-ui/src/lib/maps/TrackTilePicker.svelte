<script lang="ts">
    import { tick, onDestroy } from 'svelte'
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'
    import { StandardTileLayouts } from '../tiles/standardTileLayouts.js'
    import type { Point } from '@tabletop/common'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import Tile from '../tiles/Tile.svelte'
    import { tileChoiceArc } from './tileChoiceArc.js'

    let { session, viewport }: { session: EighteenXXSession; viewport: HTMLDivElement } = $props()
    const money = $derived(session.presentation.money)
    let center: Point = $state({ x: 0, y: 0 })
    let width = $state(0)
    let height = $state(0)
    let tileSize = $state(80)
    let hexHeight = $state(100)
    const locationId = $derived(session.track.selection.locationId?.value)
    let collapsing = $derived.by(() => {
        session.track.selection
        return false
    })
    const selectedId = $derived(session.track.preview?.definitionId)
    const layout = $derived(
        tileChoiceArc(center, width, height, session.track.tiles.length, tileSize, 1.4)
    )
    const buttonSize = $derived(tileSize * 0.42)
    const controls = $derived({
        x: Math.max(buttonSize * 1.2, Math.min(width - buttonSize * 1.2, center.x)),
        y: Math.max(buttonSize * 0.6, center.y - hexHeight / 2 - buttonSize * 0.65) + 1
    })

    function followHex(_anchor: HTMLElement, initialLocationId: string | undefined) {
        let followedId = initialLocationId
        let frame: number | undefined
        function measure() {
            frame = undefined
            const hex = [...viewport.querySelectorAll('[data-map-location]')].find(
                (element) => element.getAttribute('data-map-location') === followedId
            )
            if (!hex) return
            const bounds = viewport.getBoundingClientRect()
            const rect = hex.getBoundingClientRect()
            const next = {
                x: rect.x + rect.width / 2 - bounds.x,
                y: rect.y + rect.height / 2 - bounds.y
            }
            if (center.x !== next.x || center.y !== next.y) center = next
            width = bounds.width
            height = bounds.height
            hexHeight = rect.height
            const svg = viewport.querySelector('svg.map-scene')
            if (svg instanceof SVGSVGElement) {
                // WebKit's getScreenCTM omits the CSS scale on the map wrapper.
                tileSize = (106 * svg.getBoundingClientRect().width) / svg.viewBox.baseVal.width
            }
        }
        function scheduleMeasure() {
            if (frame === undefined) frame = requestAnimationFrame(measure)
            releaseStuckEntrances()
        }
        const resized = new ResizeObserver(scheduleMeasure)
        resized.observe(viewport)
        const viewMoved = new MutationObserver(scheduleMeasure)
        viewMoved.observe(viewport, { subtree: true, attributes: true, attributeFilter: ['style'] })
        measure()
        return {
            update(locationId: string | undefined) {
                followedId = locationId
                measure()
            },
            destroy() {
                resized.disconnect()
                viewMoved.disconnect()
                if (frame !== undefined) cancelAnimationFrame(frame)
            }
        }
    }
    const elements = new Map<string, HTMLButtonElement>()
    const animations = new Set<Animation>()
    let motionVersion = 0
    function register(node: HTMLButtonElement, id: string) {
        elements.set(id, node)
        const autoSelected =
            id === selectedId && session.track.selection.definitionId?.source === 'auto'
        if (autoSelected && prefersReducedMotion.current) session.track.tileInFlight = false
        if ((!selectedId || autoSelected) && !prefersReducedMotion.current) {
            const bounds = viewport.getBoundingClientRect()
            const target = node.getBoundingClientRect()
            const dx = autoSelected ? 0 : bounds.x + center.x - target.x - target.width / 2
            const dy = autoSelected ? 0 : bounds.y + center.y - target.y - target.height / 2
            const version = motionVersion
            const openingLocation = locationId
            const animation = node.animate(
                [
                    {
                        transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.35)`,
                        opacity: 0
                    },
                    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
                ],
                { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            )
            animations.add(animation)
            void animation.finished
                .catch(() => undefined)
                .then(() => {
                    animations.delete(animation)
                    if (autoSelected && version === motionVersion && openingLocation === locationId)
                        session.track.tileInFlight = false
                })
        }
        return {
            destroy() {
                elements.delete(id)
            }
        }
    }
    // Moving the picker into or out of the fullscreen dialog re-parents its choices; an entrance
    // animation caught mid-flight then reports finished yet keeps rendering its first frame.
    function releaseStuckEntrances() {
        for (const animation of animations)
            if (animation.playState === 'finished') {
                animation.cancel()
                animations.delete(animation)
            }
    }
    function stopMotion() {
        motionVersion++
        for (const animation of animations) animation.cancel()
        animations.clear()
    }
    onDestroy(() => {
        stopMotion()
        session.track.tileInFlight = false
    })
    async function moveTile(id: string) {
        const from = new Map(
            [...elements].map(([key, node]) => [key, node.getBoundingClientRect()])
        )
        stopMotion()
        const version = motionVersion
        session.track.previewTile(id)
        collapsing = false
        session.track.tileInFlight = true
        await tick()
        if (version !== motionVersion) return
        const duration = prefersReducedMotion.current ? 0 : 220
        const finished: Promise<unknown>[] = []
        for (const [key, node] of elements) {
            const start = from.get(key)
            if (!start) continue
            const end = node.getBoundingClientRect()
            const animation = node.animate(
                [
                    {
                        transform: `translate(calc(-50% + ${start.x + start.width / 2 - end.x - end.width / 2}px), calc(-50% + ${start.y + start.height / 2 - end.y - end.height / 2}px)) scale(${start.width / end.width})`,
                        opacity: 1
                    },
                    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
                ],
                { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            )
            animations.add(animation)
            finished.push(animation.finished.catch(() => undefined))
        }
        await Promise.all(finished)
        if (version !== motionVersion) return
        animations.clear()
        session.track.tileInFlight = false
    }
    async function cancel() {
        collapsing = true
        const id = locationId
        const from = new Map(
            [...elements].map(([key, node]) => [key, node.getBoundingClientRect()])
        )
        stopMotion()
        const version = motionVersion
        session.track.tileInFlight = true
        const bounds = viewport.getBoundingClientRect()
        const duration = prefersReducedMotion.current ? 0 : 160
        const finished: Promise<unknown>[] = []
        for (const [key, node] of elements) {
            const start = from.get(key)
            if (!start) continue
            const end = node.getBoundingClientRect()
            const animation = node.animate(
                [
                    {
                        transform: `translate(calc(-50% + ${start.x + start.width / 2 - end.x - end.width / 2}px), calc(-50% + ${start.y + start.height / 2 - end.y - end.height / 2}px)) scale(${start.width / end.width})`,
                        opacity: 1
                    },
                    {
                        transform: `translate(calc(-50% + ${bounds.x + center.x - end.x - end.width / 2}px), calc(-50% + ${bounds.y + center.y - end.y - end.height / 2}px)) scale(0)`,
                        opacity: 0
                    }
                ],
                { duration, easing: 'ease-in', fill: 'forwards' }
            )
            animations.add(animation)
            finished.push(animation.finished.catch(() => undefined))
        }
        await Promise.all(finished)
        if (version !== motionVersion || id !== locationId) return
        session.track.tileInFlight = false
        session.track.cancel()
    }
    function accept() {
        stopMotion()
        session.track.tileInFlight = false
        void session.track.confirm()
    }
    function dismissChoices(event: PointerEvent) {
        if (session.track.preview || !(event.target instanceof Element)) return
        if (event.target.closest('[data-map-tile-choice]')) return
        if (
            event.target.closest('[data-map-location]')?.getAttribute('data-map-location') ===
            locationId
        )
            return
        void cancel()
    }
</script>

<svelte:window onpointerdown={dismissChoices} />

<span class="hex-anchor" hidden use:followHex={locationId}></span>
{#if locationId && width && session.track.canBuild}
    <div
        class="picker"
        aria-label="Track tile picker"
        data-track-motion={session.track.tileInFlight}
    >
        {#if layout}
            {#key locationId}
                {#each session.track.tiles as tile, index (tile.id)}
                    {@const chosen = tile.id === selectedId}
                    {@const point = chosen ? center : layout.points[index]}
                    {@const size = chosen ? tileSize : layout.size}
                    <button
                        use:register={tile.id}
                        out:fade|global={{
                            duration: chosen || collapsing || prefersReducedMotion.current ? 0 : 120
                        }}
                        class="tile-choice"
                        class:chosen
                        style:opacity={chosen ? 0 : 1}
                        data-map-tile-choice={chosen ? undefined : tile.id}
                        aria-hidden={chosen}
                        tabindex={chosen ? -1 : 0}
                        aria-label={`Build tile ${tile.printedNumber}`}
                        style:translate={`${point.x}px ${point.y}px`}
                        style:width={`${size}px`}
                        style:height={`${size}px`}
                        onclick={() => moveTile(tile.id)}
                    >
                        <Tile
                            face={tile.face}
                            printedNumber={tile.printedNumber}
                            {size}
                            layout={session.mapView.layouts?.[tile.id] ??
                                StandardTileLayouts[tile.id]}
                            orientation={session.mapView.map.definition.orientation}
                            rotation={chosen
                                ? session.track.preview?.rotation
                                : session.track.choices.find(
                                      (choice) => choice.definitionId === tile.id
                                  )?.rotation}
                        />
                    </button>
                {/each}
            {/key}
        {/if}
        {#if session.track.preview && !collapsing}
            {#if session.track.preview.cost > 0}
                <div
                    class="placement-cost"
                    transition:fade|global={{ duration: prefersReducedMotion.current ? 0 : 120 }}
                    style:left={`${center.x}px`}
                    style:top={`${Math.min(height - tileSize * 0.3, center.y + hexHeight / 2 + tileSize * 0.06)}px`}
                    style:font-size={`${tileSize * 0.15}px`}
                >
                    {money(session.track.preview.cost)}
                </div>
            {/if}
            <div
                class="controls"
                transition:fade|global={{ duration: prefersReducedMotion.current ? 0 : 120 }}
                style:left={`${controls.x}px`}
                style:top={`${controls.y}px`}
                style:font-size={`${buttonSize}px`}
            >
                <button
                    class="cancel"
                    aria-label="Cancel track lay"
                    title="Cancel track lay"
                    onclick={cancel}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true"
                        ><path d="m7 7 10 10M17 7 7 17"></path></svg
                    >
                </button>
                <button
                    class="accept"
                    aria-label="Accept track lay"
                    title={`Accept track lay · ${money(session.track.preview.cost)}`}
                    onclick={accept}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true"
                        ><path d="m5 13 4 4L19 7"></path></svg
                    >
                </button>
            </div>
        {/if}
    </div>
{/if}

<style>
    .picker {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 5;
        overflow: hidden;
    }
    button {
        pointer-events: auto;
        cursor: pointer;
    }
    .tile-choice {
        position: absolute;
        left: 0;
        top: 0;
        transition: translate 100ms ease-out;
        transform: translate(-50%, -50%);
        padding: 0;
        border: 0;
        background: transparent;
        filter: drop-shadow(0 2px 4px #0009);
    }
    .picker[data-track-motion='true'] .tile-choice {
        transition: none;
    }
    .tile-choice.chosen {
        pointer-events: none;
        z-index: 1;
    }
    .tile-choice > :global(svg) {
        transition: transform 120ms ease-out;
        transform-origin: center;
    }
    .tile-choice:not(.chosen):hover > :global(svg) {
        transform: scale(1.1);
    }
    @media (prefers-reduced-motion: reduce) {
        .tile-choice,
        .tile-choice > :global(svg) {
            transition: none;
        }
    }
    button:focus-visible {
        outline: 3px solid #d52f83;
        outline-offset: 3px;
    }
    .placement-cost {
        position: absolute;
        transform: translateX(-50%);
        padding: 0.25em 0.6em;
        border-radius: 0.35em;
        background: var(--rail-solid, #302d29);
        color: #fffaf2;
        line-height: 1.2;
        white-space: nowrap;
        box-shadow: 0 2px 5px #0004;
        font-variant-numeric: tabular-nums;
    }
    .controls {
        position: absolute;
        display: flex;
        gap: 0.18em;
        transform: translate(-50%, -50%);
    }
    .controls button {
        display: grid;
        place-items: center;
        width: 1em;
        height: 1em;
        padding: 0;
        font: inherit;
        border-radius: 50%;
        border: 1px solid #fff9;
        box-shadow: 0 2px 5px #0005;
        color: white;
    }
    .cancel {
        background: #b34242;
    }
    .accept {
        background: #347752;
    }
    .controls button:hover {
        filter: brightness(1.15);
    }
    svg {
        width: 0.69em;
        height: 0.69em;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
</style>
