<script lang="ts">
    import { onMount } from 'svelte'
    import { FLAT_VIEW, TILTED_VIEW } from '$lib/board/geometry.js'
    import { EDGE_LOOK, STONE_COLORS, stoneBox, stoneLook, woodLook } from '$lib/board/looks.js'
    import { renderStone } from '$lib/board/stoneLight.js'
    import { renderEdge, renderTop } from '$lib/board/woodTexture.js'
    import type { Bitmap } from '$lib/board/light.js'
    import '../../app.css'

    // For scripts/render-looks.mjs to save as the images the game shows.
    let urls: Record<string, string> | undefined = $state()
    let millis = $state(0)

    function toUrl(bitmap: Bitmap, quality: number): string {
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        context?.putImageData(new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width), 0, 0)
        return canvas.toDataURL('image/webp', quality)
    }

    onMount(() => {
        const start = performance.now()
        const drawn: Record<string, string> = {}
        for (const view of VIEWS) {
            for (const color of STONE_COLORS) {
                drawn[stoneLook(color, view.flat)] = toUrl(renderStone(color, view.tilt), 0.92)
            }
            drawn[woodLook(view.flat)] = toUrl(renderTop(view.woodBox, view.tilt), 0.86)
        }
        drawn[EDGE_LOOK] = toUrl(renderEdge(TILTED_VIEW.edgeBox), 0.86)
        urls = drawn
        millis = Math.round(performance.now() - start)
    })

    const VIEWS = [TILTED_VIEW, FLAT_VIEW]
</script>

<main class="looks">
    {#if urls}
        {@const drawn = urls}
        <p>Drawn in {millis} ms.</p>
        <section data-looks={JSON.stringify(drawn)}>
            {#each VIEWS as view (view.tilt)}
                {@const box = stoneBox(view.tilt)}
                {#each STONE_COLORS as color (color)}
                    <svg
                        viewBox="{box.x} {box.y} {box.width} {box.height}"
                        width={box.width * 6}
                        height={box.height * 6}
                    >
                        <image
                            href={drawn[stoneLook(color, view.flat)]}
                            x={box.x}
                            y={box.y}
                            width={box.width}
                            height={box.height}
                        ></image>
                    </svg>
                {/each}
            {/each}
        </section>
        {#each VIEWS as view (view.tilt)}
            {@const wood = view.woodBox}
            <svg viewBox="{wood.x} {wood.y} {wood.width} {wood.height + 40}" width={wood.width}>
                {#if !view.flat}
                    <image
                        href={drawn[EDGE_LOOK]}
                        x={view.edgeBox.x}
                        y={view.edgeBox.y}
                        width={view.edgeBox.width}
                        height={view.edgeBox.height}
                    ></image>
                {/if}
                <image
                    href={drawn[woodLook(view.flat)]}
                    x={wood.x}
                    y={wood.y}
                    width={wood.width}
                    height={wood.height}
                ></image>
            </svg>
        {/each}
    {:else}
        <p>Drawing…</p>
    {/if}
</main>

<style>
    .looks {
        min-height: 100vh;
        padding: 16px;
        background: #e6dfd3;
        font-family: system-ui, sans-serif;
    }

    section {
        display: flex;
        gap: 24px;
        margin-bottom: 24px;
    }

    svg {
        display: block;
    }
</style>
