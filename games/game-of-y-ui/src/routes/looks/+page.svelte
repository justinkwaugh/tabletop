<script lang="ts">
    import { onMount } from 'svelte'
    import { BoardShape } from '@tabletop/game-of-y'
    import { boardView } from '$lib/board/geometry.js'
    import {
        edgeLook,
        shadowLook,
        STONE_COLORS,
        stoneBox,
        stoneLook,
        woodLook
    } from '$lib/board/looks.js'
    import { drawShadow, SHADOW_PIXELS, shadowBox } from '$lib/board/boardShadow.js'
    import type { BoardView } from '$lib/board/geometry.js'
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

    function shadowUrl(view: BoardView): string {
        const box = shadowBox(view)
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(box.width * SHADOW_PIXELS)
        canvas.height = Math.ceil(box.height * SHADOW_PIXELS)
        const context = canvas.getContext('2d')
        if (context) drawShadow(context, view, box)
        return canvas.toDataURL('image/webp', 0.86)
    }

    onMount(() => {
        const start = performance.now()
        const drawn: Record<string, string> = {}
        for (const flat of [false, true]) {
            const { tilt } = boardView(BoardShape.Kadon, flat)
            for (const color of STONE_COLORS) {
                drawn[stoneLook(color, flat)] = toUrl(renderStone(color, tilt), 0.92)
            }
        }
        for (const view of VIEWS) {
            drawn[woodLook(view.shape, view.flat)] = toUrl(renderTop(view.woodBox, view.tilt), 0.86)
            if (!view.flat) drawn[edgeLook(view.shape)] = toUrl(renderEdge(view.edgeBox), 0.86)
            drawn[shadowLook(view.shape, view.flat)] = shadowUrl(view)
        }
        urls = drawn
        millis = Math.round(performance.now() - start)
    })

    // Every board, tilted and flat.
    const VIEWS = Object.values(BoardShape).flatMap((shape) =>
        [false, true].map((flat) => boardView(shape, flat))
    )
    const STONE_TILTS = [false, true].map((flat) => boardView(BoardShape.Kadon, flat))
</script>

<main class="looks">
    {#if urls}
        {@const drawn = urls}
        <p>Drawn in {millis} ms.</p>
        <section data-looks={JSON.stringify(drawn)}>
            {#each STONE_TILTS as view (view.tilt)}
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
        {#each VIEWS as view (`${view.shape}-${view.tilt}`)}
            {@const wood = view.woodBox}
            {@const shadow = shadowBox(view)}
            <svg viewBox="{wood.x} {wood.y} {wood.width} {wood.height + 40}" width={wood.width}>
                <image
                    href={drawn[shadowLook(view.shape, view.flat)]}
                    x={shadow.x}
                    y={shadow.y}
                    width={shadow.width}
                    height={shadow.height}
                ></image>
                {#if !view.flat}
                    <image
                        href={drawn[edgeLook(view.shape)]}
                        x={view.edgeBox.x}
                        y={view.edgeBox.y}
                        width={view.edgeBox.width}
                        height={view.edgeBox.height}
                    ></image>
                {/if}
                <image
                    href={drawn[woodLook(view.shape, view.flat)]}
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
