<script lang="ts">
    import type { PieceKind } from '@tabletop/punct'
    import { VIEW, type BoardView } from '$lib/board/geometry.js'
    import { drawPiece, type Tone } from '$lib/board/pieceShape.js'
    import { bodyImage, dishBox, dishUrl } from '$lib/board/looks.js'
    import { speckPaths } from '$lib/board/specks.js'
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
        live = false
    }: {
        kind: PieceKind
        angle: number
        tone: Tone
        seed: number
        prefix: string
        view?: BoardView
        // Drawn without images, as the icons are for the looks page.
        live?: boolean
    } = $props()

    const dots = $derived(drawPiece(kind, angle, view).dots)
    const body = $derived(live ? undefined : bodyImage(kind, angle, tone))
    const dish = dishBox()
    const specks = $derived(speckPaths(kind, seed, angle, view))
</script>

<g class="piece {tone}">
    {#if body}
        <image href={body.href} x={body.x} y={body.y} width={body.width} height={body.height}
        ></image>
    {:else}
        <PieceBody {kind} {angle} {tone} {prefix} {view} />
    {/if}
    <path d={specks.side} class="specks side-specks"></path>
    <path d={specks.sideGrey} class="specks grey side-specks"></path>
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
    <path d={specks.top} class="specks"></path>
    <path d={specks.topGrey} class="specks grey"></path>
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
