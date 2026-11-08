<script lang="ts">
    import type { PieceKind } from '@tabletop/punct'
    import { VIEW, type BoardView } from '$lib/board/geometry.js'
    import { dotsOnScreen, type Tone } from '$lib/board/pieceShape.js'
    import { bodyImage, dishBox, dishUrl } from '$lib/board/looks.js'
    import { SPECK_SCALE, speckPaths } from '$lib/board/specks.js'
    import PieceBody from './PieceBody.svelte'
    import DishLook from './DishLook.svelte'

    // One piece standing on whatever is under it, its PÜNCT at the origin: its body and its three
    // dots sunk as flat-bottomed dishes, the PÜNCT's in its smooth insert, from pre-rendered
    // images where it lies at rest (board/looks.ts), drawn live while it turns; its specks over
    // them, its own.
    let {
        kind,
        angle,
        tone,
        seed,
        prefix,
        view = VIEW,
        live = false,
        moving = false
    }: {
        kind: PieceKind
        angle: number
        tone: Tone
        seed: number
        prefix: string
        view?: BoardView
        // Drawn without images, as the icons are for the looks page.
        live?: boolean
        // A piece that turns, so changes between its live drawing and its images: each image
        // loads after it is put in, so until it has the live drawing stays under it, or the
        // piece's body would vanish for a frame as it comes to rest.
        moving?: boolean
    } = $props()

    let loaded: string | undefined = $state()

    const dots = $derived(dotsOnScreen(kind, angle, view))
    const body = $derived(live ? undefined : bodyImage(kind, angle, tone))
    const dish = dishBox()
    const specks = $derived(speckPaths(kind, seed, angle, view))
</script>

<g class="piece {tone}">
    {#if !body || (moving && loaded !== body.href)}
        <PieceBody {kind} {angle} {tone} {prefix} {view} />
    {/if}
    {#if body}
        {@const href = body.href}
        <image
            {href}
            x={body.x}
            y={body.y}
            width={body.width}
            height={body.height}
            onload={() => (loaded = href)}
        ></image>
    {/if}
    <g transform="scale({SPECK_SCALE})">
        <path d={specks.side} class="specks side-specks"></path>
        <path d={specks.sideGrey} class="specks grey side-specks"></path>
    </g>
    {#each dots as dot, index (index)}
        {@const material = index === 0 ? (`${tone}-insert` as const) : tone}
        {@const href = body ? dishUrl(material) : undefined}
        {#if href}
            <image
                {href}
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
        <path d={specks.top} class="specks"></path>
        <path d={specks.topGrey} class="specks grey"></path>
    </g>
</g>

<style>
    .light .specks {
        fill: #24282d;
    }

    .dark .specks {
        fill: #d6dbe1;
    }

    .light .specks.grey {
        fill: #858b93;
    }

    .dark .specks.grey {
        fill: #858c94;
    }

    .side-specks {
        opacity: 0.8;
    }
</style>
