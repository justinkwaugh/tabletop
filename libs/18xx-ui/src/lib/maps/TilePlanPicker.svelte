<script lang="ts">
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { HexOrientation, Point } from '@tabletop/common'
    import type { TilePlanModule } from '../session/tilePlanModule.svelte.js'
    import type { MapViewDefinition } from './stationPresentation.js'
    import { placedTileLayout } from '../tiles/standardTileLayouts.js'
    import Tile from '../tiles/Tile.svelte'
    import type { TileAppearance } from '../tiles/tileAppearance.js'
    import { HexPickerFrame } from './hexPickerFrame.svelte.js'
    import { tileChoiceArc } from './tileChoiceArc.js'
    import TilePiece from './TilePiece.svelte'
    import { pieceDrawing, pieceLayout } from './tilePiece.js'
    import { drawnLocation, type MapDrawing } from './mapDrawing.js'

    let {
        plan,
        viewport,
        scene,
        mapView,
        appearance
    }: {
        plan: Pick<
            TilePlanModule,
            'locationId' | 'pieceLocationIds' | 'choices' | 'choose' | 'clear'
        >
        viewport: HTMLDivElement
        scene: Pick<MapDrawing, 'locations'>
        mapView: Pick<MapViewDefinition, 'layouts' | 'tileSet'> & {
            map: { definition: { orientation: HexOrientation } }
        }
        appearance?: TileAppearance
    } = $props()
    const frame = new HexPickerFrame()
    const trackHex = frame.follow(() => viewport)
    const orientation = $derived(mapView.map.definition.orientation)
    const sceneCenter = (locationId: string): Point => drawnLocation(scene, locationId).center
    /** The piece the plan lays on screen, around its hexes where it covers more than one. */
    const placed = $derived(
        plan.locationId
            ? frame.piece(
                  sceneCenter(plan.locationId),
                  plan.pieceLocationIds.length > 1
                      ? pieceLayout(plan.pieceLocationIds.map(sceneCenter))
                      : undefined
              )
            : undefined
    )
    const arc = $derived(
        placed
            ? tileChoiceArc(
                  placed.center,
                  frame.width,
                  frame.height,
                  plan.choices.length,
                  frame.tileSize * 0.7,
                  1.9 * placed.extent
              )
            : undefined
    )
    const badgeSize = $derived(frame.buttonSize * 0.36)

    let pressed: Point | undefined
    function press(event: PointerEvent) {
        pressed = { x: event.clientX, y: event.clientY }
    }
    function release(event: PointerEvent) {
        const start = pressed
        pressed = undefined
        if (!start || !(event.target instanceof Element)) return
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return
        if (
            event.target.closest(
                '[data-tile-plan], [data-map-location]:not([aria-disabled="true"])'
            )
        )
            return
        plan.clear()
    }
    function closeOnEscape(event: KeyboardEvent) {
        if (event.key === 'Escape') plan.clear()
    }
</script>

<svelte:window onpointerdown={press} onpointerup={release} onkeydown={closeOnEscape} />

<span class="hex-anchor" hidden use:trackHex={plan.locationId}></span>
{#if frame.width && placed}
    <div class="plan" role="group" aria-label="Tile upgrade preview" data-tile-plan>
        {#if arc}
            {#each plan.choices as choice, index (`${choice.level}:${choice.tile.id}`)}
                {@const point = arc.points[index]}
                {@const piece = choice.piece
                    ? pieceDrawing(choice.piece, scene, mapView)
                    : undefined}
                {@const pieceScale = piece
                    ? arc.size / Math.max(piece.layout.width, piece.layout.height)
                    : 1}
                {#if point}
                    <button
                        transition:fade|global={{
                            duration: prefersReducedMotion.current ? 0 : 120
                        }}
                        class="tile-choice"
                        class:chosen={choice.chosen}
                        class:exhausted={!choice.available}
                        disabled={!choice.available}
                        aria-pressed={choice.chosen}
                        aria-label={`Preview tile ${choice.tile.printedNumber}${choice.available ? '' : ', none left'}`}
                        title={choice.available ? undefined : 'None left in the supply'}
                        style:translate={`${point.x}px ${point.y}px`}
                        style:width={`${piece ? piece.layout.width * pieceScale : arc.size}px`}
                        style:height={`${piece ? piece.layout.height * pieceScale : arc.size}px`}
                        style:font-size={`${arc.size / 10}px`}
                        onclick={() => plan.choose(choice.level, choice.tile.id)}
                        >{#if piece}<TilePiece
                                hexes={piece.hexes}
                                viewWidth={piece.layout.width}
                                viewHeight={piece.layout.height}
                                width={piece.layout.width * pieceScale}
                                height={piece.layout.height * pieceScale}
                                {orientation}
                                {appearance}
                                label={`Tile ${choice.tile.printedNumber} across ${piece.hexes.length} hexes`}
                                shadow
                            />{:else}<Tile
                                face={choice.tile.face}
                                printedNumber={choice.tile.printedNumber}
                                rotation={choice.rotation}
                                layout={placedTileLayout(mapView.layouts, choice.tile.id)}
                                {orientation}
                                {appearance}
                                size={arc.size}
                                shadow
                            />{/if}</button
                    >
                {/if}
            {/each}
        {/if}
        <div
            class="badge"
            transition:fade|global={{ duration: prefersReducedMotion.current ? 0 : 120 }}
            style:left={`${placed.center.x}px`}
            style:top={`${placed.center.y + placed.halfHeight + badgeSize * 1.2}px`}
            style:font-size={`${badgeSize}px`}
        >
            Preview
        </div>
    </div>
{/if}

<style>
    .plan {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 5;
        overflow: hidden;
        transform: translateZ(0);
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
        pointer-events: auto;
        cursor: pointer;
    }
    .tile-choice.exhausted {
        opacity: 0.35;
        cursor: default;
    }
    .tile-choice.chosen::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -1em;
        width: 1.6em;
        height: 1.6em;
        translate: -50% 0;
        border-radius: 50%;
        background: var(--rail-solid, #302d29);
        border: 2px solid var(--rail-solid-text, #fffaf2);
    }
    .tile-choice > :global(svg) {
        transition: transform 120ms ease-out;
        transform-origin: center;
    }
    .tile-choice:not(.exhausted):hover > :global(svg) {
        transform: scale(1.1);
    }
    @media (prefers-reduced-motion: reduce) {
        .tile-choice,
        .tile-choice > :global(svg) {
            transition: none;
        }
    }
    .tile-choice:focus-visible {
        outline: 3px solid #d52f83;
        outline-offset: 3px;
    }
    .badge {
        position: absolute;
        transform: translate(-50%, -50%);
        padding: 0.2em 0.6em;
        border-radius: 0.35em;
        background: var(--rail-solid, #302d29);
        color: var(--rail-solid-text, #fffaf2);
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
        box-shadow: 0 2px 5px #0004;
    }
</style>
