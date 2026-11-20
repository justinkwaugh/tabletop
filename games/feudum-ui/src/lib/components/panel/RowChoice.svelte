<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import LocationDisc from '$lib/components/pieces/LocationDisc.svelte'
    import PawnPiece from '$lib/components/pieces/PawnPiece.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { ActionRow } from '$lib/model/actionPanel.js'
    import DieChoice from './DieChoice.svelte'

    /** R-4.3 A held tile shows its landscape once known, its epoch side before. */
    let { row, pointer }: { row: ActionRow; pointer: RowPointer } = $props()

    const GoodSize = 18
    const PawnSize = 24
    const TileSize = 28
    const WritWidth = 22
    const DiscSize = 34
    const BackSize = 24
</script>

{#snippet lead()}
    {#if row.art?.kind === 'good'}
        <GoodToken good={row.art.good} size={GoodSize} />
    {:else if row.art?.kind === 'pawn'}
        <PawnPiece character={row.art.character} paint={row.art.paint} size={PawnSize} />
    {:else if row.art?.kind === 'tile'}
        <TileFace
            faceShown={row.art.landscape !== undefined}
            epoch={row.art.epoch}
            region={row.art.region}
            landscape={row.art.landscape}
            size={TileSize}
        />
    {:else if row.art?.kind === 'writ-back'}
        <WritFace faceShown={false} width={WritWidth} />
    {:else if row.art?.kind === 'seal'}
        <SealFace faceShown={false} size={PawnSize} />
    {:else if row.art?.kind === 'vessel'}
        <VesselToken vessel={row.art.vessel} size={PawnSize} />
    {:else if row.art?.kind === 'disc'}
        <span class="disc" data-disc-back={row.art.back ?? 'plain'}>
            {#if row.art.back}
                <span class="back"><LocationDisc kind={row.art.back} size={BackSize} /></span>
            {/if}
            <span class="front"><LocationDisc kind={row.art.location} size={DiscSize} /></span>
        </span>
    {/if}
{/snippet}

{#if row.art?.kind === 'die'}
    <DieChoice choice={row.choice} art={row.art} {pointer} onPress={() => void row.press()} />
{:else}
    <PanelRow
        choice={row.choice}
        {pointer}
        lead={row.art ? lead : undefined}
        quiet={row.quiet}
        onPress={() => void row.press()}
    />
{/if}

<style>
    .disc {
        position: relative;
        display: inline-block;
        width: 2.9rem;
        height: 2.5rem;
        flex: none;
    }

    .back {
        position: absolute;
        top: 0;
        right: 0;
        line-height: 0;
    }

    .front {
        position: absolute;
        bottom: 0;
        left: 0;
        line-height: 0;
    }
</style>
