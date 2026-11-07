<script lang="ts">
    import { onMount } from 'svelte'
    import { coordinatesToNumber, type AxialCoordinates } from '@tabletop/common'
    import { MarbleColor } from '@tabletop/zertz'
    import { viewOf } from '$lib/board/geometry.js'
    import { marbleLook, RING_LOOK, SHINE_LOOK } from '$lib/board/looks.js'
    import { renderMarble, renderRing, type Bitmap } from '$lib/board/pieceLight.js'
    import {
        MARBLE_SHADOW_RADIUS,
        MARBLE_SHADOW_STOPS,
        RING_SHADOW_RADIUS,
        RING_SHADOW_STOPS
    } from '$lib/board/softShadow.js'
    import MarbleLook from '$lib/components/MarbleLook.svelte'
    import RingLook from '$lib/components/RingLook.svelte'
    import '../../app.css'

    // The pieces' looks, lit pixel by pixel, for scripts/render-looks.mjs to save as the images the
    // game shows; drawn here alone and as a patch of board, from either side of the table, to
    // check them.
    const SHADOW_COLOR = '#021624'
    const COLORS = Object.values(MarbleColor)

    let urls: Record<string, string> | undefined = $state()
    let millis = $state(0)

    function toUrl(bitmap: Bitmap): string {
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        context?.putImageData(new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width), 0, 0)
        return canvas.toDataURL('image/webp', 0.9)
    }

    onMount(() => {
        const start = performance.now()
        const view = viewOf(false)
        const drawn: Record<string, string> = { [RING_LOOK]: toUrl(renderRing(view)) }
        for (const color of COLORS) {
            const { body, gloss } = renderMarble(view, color)
            drawn[marbleLook(color)] = toUrl(body)
            drawn[SHINE_LOOK] ??= toUrl(gloss)
        }
        urls = drawn
        millis = Math.round(performance.now() - start)
    })

    // A flower of rings, marbles on three of them.
    const PATCH: { coords: AxialCoordinates; marble?: MarbleColor }[] = [
        { coords: { q: 0, r: -1 } },
        { coords: { q: 1, r: -1 }, marble: MarbleColor.Black },
        { coords: { q: -1, r: 0 } },
        { coords: { q: 0, r: 0 }, marble: MarbleColor.White },
        { coords: { q: 1, r: 0 } },
        { coords: { q: -1, r: 1 }, marble: MarbleColor.Grey },
        { coords: { q: 0, r: 1 } }
    ]
    // Far rings first, as on the board.
    function spotsOf(turned: boolean) {
        const view = viewOf(turned)
        return PATCH.map((spot) => ({
            ...spot,
            seed: coordinatesToNumber(spot.coords),
            center: view.center(spot.coords)
        })).sort((a, b) => a.center.y - b.center.y)
    }
    const SINGLES = [undefined, ...COLORS].map((marble, index) => ({
        marble,
        seed: coordinatesToNumber({ q: index, r: 2 }),
        center: { x: 0, y: 0 }
    }))
    const patchBox = { x: -100, y: -70, width: 200, height: 150 }
    const singleBox = { x: -36, y: -36, width: 72, height: 72 }
</script>

{#snippet pieces(
    turned: boolean,
    spots: { marble?: MarbleColor; seed: number; center: { x: number; y: number } }[],
    drawn: Record<string, string>
)}
    {@const view = viewOf(turned)}
    <defs>
        <radialGradient id="zertz-marble-shadow">
            {#each MARBLE_SHADOW_STOPS as stop, index (index)}
                <stop
                    offset={stop.offset}
                    stop-color={SHADOW_COLOR}
                    stop-opacity={stop.opacity * 0.55}
                ></stop>
            {/each}
        </radialGradient>
        <radialGradient id="zertz-ring-shadow">
            {#each RING_SHADOW_STOPS as stop, index (index)}
                <stop
                    offset={stop.offset}
                    stop-color={SHADOW_COLOR}
                    stop-opacity={stop.opacity * 0.6}
                ></stop>
            {/each}
        </radialGradient>
    </defs>
    {#each spots as { center }, index (index)}
        <g transform="translate({center.x} {center.y + 3 + view.band}) scale(1 {view.tilt})">
            <circle r={RING_SHADOW_RADIUS} fill="url(#zertz-ring-shadow)"></circle>
        </g>
    {/each}
    {#each spots as { center }, index (index)}
        <g transform="translate({center.x} {center.y})">
            <RingLook {view} urls={drawn} />
        </g>
    {/each}
    {#each spots as { center, marble, seed }, index (index)}
        {#if marble}
            <g transform="translate({center.x} {center.y - view.lift})">
                <g transform="translate(0 {view.lift + 3 * view.tilt})">
                    <ellipse
                        rx={MARBLE_SHADOW_RADIUS}
                        ry={MARBLE_SHADOW_RADIUS * view.tilt}
                        fill="url(#zertz-marble-shadow)"
                    ></ellipse>
                </g>
                <MarbleLook color={marble} {seed} {view} urls={drawn} />
            </g>
        {/if}
    {/each}
{/snippet}

<main class="looks zertz-water">
    {#if urls}
        {@const drawn = urls}
        <p class="note">Drawn in {millis} ms. Near side, then turned.</p>
        <section class="pair" data-looks={JSON.stringify(drawn)}>
            {#each [false, true] as turned (turned)}
                <div class="singles">
                    {#each SINGLES as single, index (index)}
                        <svg
                            viewBox="{singleBox.x} {singleBox.y} {singleBox.width} {singleBox.height}"
                            width={singleBox.width * 3}
                            height={singleBox.height * 3}
                        >
                            {@render pieces(turned, [single], drawn)}
                        </svg>
                    {/each}
                </div>
            {/each}
        </section>
        {#each [2.2, 1.1] as size (size)}
            <section class="pair">
                {#each [false, true] as turned (turned)}
                    <figure>
                        <figcaption>{turned ? 'Turned' : 'Near side'}, {size} px a unit</figcaption>
                        <svg
                            viewBox="{patchBox.x} {patchBox.y} {patchBox.width} {patchBox.height}"
                            width={patchBox.width * size}
                            height={patchBox.height * size}
                        >
                            {@render pieces(turned, spotsOf(turned), drawn)}
                        </svg>
                    </figure>
                {/each}
            </section>
        {/each}
    {:else}
        <p class="note">Drawing…</p>
    {/if}
</main>

<style>
    .looks {
        min-height: 100vh;
        padding: 16px;
        color: #f4efe4;
        background: #0f527c;
        font-family: system-ui, sans-serif;
    }

    .note {
        margin: 0 0 12px;
    }

    .pair {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
        margin-bottom: 24px;
    }

    .singles {
        display: grid;
        grid-template-columns: repeat(2, auto);
    }

    figcaption {
        margin-bottom: 4px;
        font-size: 14px;
    }

    svg {
        display: block;
        overflow: visible;
    }
</style>
