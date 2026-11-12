<script lang="ts">
    import GuildArea from '$lib/components/guilds/GuildArea.svelte'
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'
    import { GuildBox } from '$lib/utils/boardGeometry.js'

    /**
     * One card, writ, tile, bead or guild area at any size, as its owner shows it. A guild area lies
     * sideways on the board; enlarged, it stands upright as the trade picker shows it, turned a
     * quarter clockwise, and `width` is its long side.
     */
    let { face, width }: { face: EnlargedFace; width: number } = $props()

    let short = $derived((width * GuildBox.height) / GuildBox.width)
</script>

{#if face.kind === 'card'}
    <ActionCardFace
        faceShown={face.faceShown}
        kind={face.card}
        paint={face.paint}
        number={face.number}
        {width}
    />
{:else if face.kind === 'writ'}
    <WritFace faceShown={face.faceShown} writId={face.writId} sealed={face.sealed} {width} />
{:else if face.kind === 'tile'}
    <TileFace
        faceShown={face.faceShown}
        epoch={face.epoch}
        landscape={face.landscape}
        region={face.region}
        size={width}
    />
{:else if face.kind === 'guild'}
    <div
        class="relative overflow-hidden"
        style:width="{short}px"
        style:height="{width}px"
        data-enlarged-upright={face.guild}
    >
        <div
            class="turned absolute"
            style:width="{width}px"
            style:height="{short}px"
            data-enlarged-turned
        >
            <GuildArea
                guild={face.guild}
                state={face.state}
                paintOf={face.paintOf}
                colourPaintOf={face.colourPaintOf}
                {width}
            />
        </div>
    </div>
{:else}
    <SealFace faceShown={face.faceShown} beadValue={face.beadValue} size={width} />
{/if}

<style>
    /* A quarter turn clockwise about the centre: the long side stands upright. */
    .turned {
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(90deg);
    }

    .turned > :global(svg) {
        display: block;
    }
</style>
