<script lang="ts">
    import { tick, onDestroy } from 'svelte'
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'
    import { placedTileLayout } from '../tiles/standardTileLayouts.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import Tile from '../tiles/Tile.svelte'
    import type { TileAppearance } from '../tiles/tileAppearance.js'
    import { tileChoiceArc } from './tileChoiceArc.js'
    import { HexPickerFrame } from './hexPickerFrame.svelte.js'
    import HexPickerControls from './HexPickerControls.svelte'
    import TilePiece from './TilePiece.svelte'
    import { TileBox, pieceLayout, type PieceHex } from './tilePiece.js'
    import { tileGroupOf } from './tileGroups.js'
    import { assertExists, type Point } from '@tabletop/common'

    let {
        session,
        viewport,
        appearance
    }: { session: EighteenXXSessionView; viewport: HTMLDivElement; appearance?: TileAppearance } =
        $props()
    const money = $derived(session.presentation.money)
    const frame = new HexPickerFrame()
    const locationId = $derived(session.track.selection.locationId?.value)
    const mapScale = $derived(frame.tileSize / TileBox)
    function sceneHex(id: string) {
        const entry = session.map.scene.locations.find((candidate) => candidate.location.id === id)
        assertExists(entry, `The map draws ${id}`)
        return entry
    }
    /** Where a point of the map, in map units, stands on screen, from the followed hex. */
    function onScreen(point: Point): Point {
        assertExists(locationId, 'The picker follows a chosen hex')
        const anchor = sceneHex(locationId).center
        return {
            x: frame.center.x + (point.x - anchor.x) * mapScale,
            y: frame.center.y + (point.y - anchor.y) * mapScale
        }
    }
    const group = $derived(locationId ? tileGroupOf(session.mapView, locationId) : undefined)
    const groupLayout = $derived(
        group ? pieceLayout(group.map((id) => sceneHex(id).center)) : undefined
    )
    const center = $derived(groupLayout ? onScreen(groupLayout.middle) : frame.center)
    /** Half the height the hex, or the piece, takes on screen. */
    const halfHeight = $derived(
        frame.hexHeight / 2 + (groupLayout ? ((groupLayout.height - TileBox) * mapScale) / 2 : 0)
    )
    const controls = $derived(frame.controlsAbove(center, halfHeight))
    /** The tiles each choice lays as one piece, by tile, where it lays more than one. */
    const pieces = $derived.by(() => {
        const preview = session.track.preview
        return new Map(
            session.track.tiles.flatMap((tile) => {
                const details =
                    preview?.definitionId === tile.id
                        ? preview
                        : session.track.choices.find((choice) => choice.definitionId === tile.id)
                const tiles = details ? session.track.pieceOf(details) : []
                if (tiles.length < 2) return []
                const layout = pieceLayout(tiles.map((entry) => sceneHex(entry.locationId).center))
                const hexes = tiles.map((entry, index): PieceHex => {
                    const definition = session.mapView.tileSet.definitions.find(
                        (candidate) => candidate.id === entry.definitionId
                    )
                    assertExists(definition, `Tile ${entry.definitionId} is in the set`)
                    const { outline, joints } = sceneHex(entry.locationId)
                    return {
                        face: definition.face,
                        printedNumber: definition.printedNumber,
                        rotation: entry.rotation,
                        layout: placedTileLayout(session.mapView.layouts, entry.definitionId),
                        offset: layout.offsets[index],
                        outline,
                        joints
                    }
                })
                return [[tile.id, { hexes, layout }] as const]
            })
        )
    })
    const width = $derived(frame.width)
    const height = $derived(frame.height)
    const tileSize = $derived(frame.tileSize)
    const hexHeight = $derived(frame.hexHeight)
    let collapsing = $derived.by(() => {
        session.track.selection
        return false
    })
    const selectedId = $derived(session.track.preview?.definitionId)
    /** How many hexes across a piece laid over the group is, so its hexes keep a tile's size. */
    const pieceExtent = $derived(
        groupLayout ? Math.max(groupLayout.width, groupLayout.height) / TileBox : 1
    )
    /**
     * The choices' arc, and the size a choice's whole piece takes there: each hex at a tile's
     * size where the pieces fit around the group, otherwise a piece within one tile's size.
     */
    const layout = $derived.by(() => {
        const count = session.track.tiles.length
        const whole = groupLayout
            ? tileChoiceArc(center, width, height, count, tileSize * pieceExtent, 1.4)
            : undefined
        if (whole) return { ...whole, size: whole.size / pieceExtent, pieceSize: whole.size }
        const arc = tileChoiceArc(center, width, height, count, tileSize, 1.4 * pieceExtent)
        return arc ? { ...arc, pieceSize: arc.size } : undefined
    })

    const trackHex = frame.follow(
        () => viewport,
        () => releaseStuckEntrances()
    )
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
                if (elements.get(id) === node) elements.delete(id)
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
        const clicked = event.target
            .closest('[data-map-location]')
            ?.getAttribute('data-map-location')
        if (clicked && (clicked === locationId || group?.includes(clicked))) return
        void cancel()
    }
</script>

<svelte:window onpointerdown={dismissChoices} />

<span class="hex-anchor" hidden use:trackHex={locationId}></span>
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
                    {@const size = chosen ? tileSize : layout.size}
                    {@const piece = pieces.get(tile.id)}
                    {@const pieceScale = piece
                        ? chosen
                            ? mapScale
                            : layout.pieceSize / Math.max(piece.layout.width, piece.layout.height)
                        : 1}
                    {@const point = chosen
                        ? piece
                            ? onScreen(piece.layout.middle)
                            : center
                        : layout.points[index]}
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
                        style:width={`${piece ? piece.layout.width * pieceScale : size}px`}
                        style:height={`${piece ? piece.layout.height * pieceScale : size}px`}
                        onclick={() => moveTile(tile.id)}
                    >
                        {#if piece}<TilePiece
                                hexes={piece.hexes}
                                viewWidth={piece.layout.width}
                                viewHeight={piece.layout.height}
                                width={piece.layout.width * pieceScale}
                                height={piece.layout.height * pieceScale}
                                orientation={session.mapView.map.definition.orientation}
                                {appearance}
                                label={`Tile ${tile.printedNumber} across ${piece.hexes.length} hexes`}
                                shadow
                            />{:else}<Tile
                                face={tile.face}
                                printedNumber={tile.printedNumber}
                                {appearance}
                                {size}
                                shadow
                                layout={placedTileLayout(session.mapView.layouts, tile.id)}
                                orientation={session.mapView.map.definition.orientation}
                                rotation={chosen
                                    ? session.track.preview?.rotation
                                    : session.track.choices.find(
                                          (choice) => choice.definitionId === tile.id
                                      )?.rotation}
                            />{/if}
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
                    style:top={`${Math.min(height - tileSize * 0.3, center.y + halfHeight + tileSize * 0.06)}px`}
                    style:font-size={`${tileSize * 0.15}px`}
                >
                    {money(session.track.preview.cost)}
                </div>
            {/if}
            <HexPickerControls
                at={controls}
                size={frame.buttonSize}
                cancel={{ label: 'Cancel track lay', onclick: cancel }}
                accept={{
                    label: 'Accept track lay',
                    title: `Accept track lay · ${money(session.track.preview.cost)}`,
                    onclick: accept
                }}
            />
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
        /* Keep the overlay composited above the map after Safari finishes its animations. */
        transform: translateZ(0);
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
    }
    .picker[data-track-motion='true'] .tile-choice {
        transition: none;
        /* Tiles moving under a still pointer would otherwise pick up a stale hover gameState. */
        pointer-events: none;
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
</style>
