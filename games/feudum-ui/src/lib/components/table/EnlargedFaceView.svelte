<script lang="ts">
    import GuildArea from '$lib/components/guilds/GuildArea.svelte'
    import UprightArea from '$lib/components/guilds/UprightArea.svelte'
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'

    let { face, width }: { face: EnlargedFace; width: number } = $props()
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
    <UprightArea
        guild={face.guild}
        long={width}
        class="overflow-hidden"
        data-enlarged-upright={face.guild}
    >
        <GuildArea
            guild={face.guild}
            state={face.state}
            paintOf={face.paintOf}
            colourPaintOf={face.colourPaintOf}
            {width}
        />
    </UprightArea>
{:else}
    <SealFace faceShown={face.faceShown} beadValue={face.beadValue} size={width} />
{/if}
