<script lang="ts">
    import type { PieceKind } from '@tabletop/punct'
    import { assertExists } from '@tabletop/common'
    import { VIEW, type BoardView } from '$lib/board/geometry.js'
    import { dotsOnScreen, type Tone } from '$lib/board/pieceShape.js'
    import { bodyImage, dishBox, dishUrl } from '$lib/board/looks.js'
    import { SIDE_SPECK_OPACITY, SPECK_FILL } from '$lib/board/pieceColours.js'
    import { SPECK_SCALE, speckPaths } from '$lib/board/specks.js'
    import PieceBody from './PieceBody.svelte'
    import DishLook from './DishLook.svelte'

    // One piece at rest, its PÜNCT at the origin: its body and its three dots as dishes, from
    // pre-rendered images (board/looks.ts), with its own specks over them.
    let {
        kind,
        angle,
        tone,
        seed,
        prefix,
        view = VIEW,
        live = false
    }: {
        kind: PieceKind
        angle: number
        tone: Tone
        seed: number
        prefix: string
        view?: BoardView
        // Drawn without images, for the looks page that renders them.
        live?: boolean
    } = $props()

    const dots = $derived(dotsOnScreen(kind, angle, view))
    const body = $derived.by(() => {
        if (live) return undefined
        const image = bodyImage(kind, angle, tone)
        assertExists(image, 'A piece at rest lies a way it has an image for')
        return image
    })
    const dish = dishBox()
    const specks = $derived(speckPaths(kind, seed, angle, view))
    const fill = $derived(SPECK_FILL[tone])
</script>

<g>
    {#if body}
        <image href={body.href} x={body.x} y={body.y} width={body.width} height={body.height}
        ></image>
    {:else}
        <PieceBody {kind} {angle} {tone} {prefix} {view} />
    {/if}
    <g transform="scale({SPECK_SCALE})">
        <path d={specks.side} fill={fill.plain} fill-opacity={SIDE_SPECK_OPACITY}></path>
        <path d={specks.sideGrey} fill={fill.grey} fill-opacity={SIDE_SPECK_OPACITY}></path>
    </g>
    {#each dots as dot, index (index)}
        {@const material = index === 0 ? (`${tone}-insert` as const) : tone}
        {#if body}
            <image
                href={dishUrl(material)}
                x={dot.x + dish.x}
                y={dot.y + dish.y}
                width={dish.width}
                height={dish.height}
            ></image>
        {:else}
            <DishLook center={dot} {material} {prefix} {view} />
        {/if}
    {/each}
    <g transform="scale({SPECK_SCALE})">
        <path d={specks.top} fill={fill.plain}></path>
        <path d={specks.topGrey} fill={fill.grey}></path>
    </g>
</g>
