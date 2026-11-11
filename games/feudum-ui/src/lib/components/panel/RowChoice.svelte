<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import PawnPiece from '$lib/components/pieces/PawnPiece.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { ActionRow } from '$lib/model/actionPanel.js'
    import DieChoice from './DieChoice.svelte'
    import RowChoice from './RowChoice.svelte'

    /**
     * One row with its art, and what it asks beside itself: R-1.4.8 the sulfur's destination. A
     * held tile shows its landscape once known (R-4.3), its epoch side before. A guild's die is the
     * whole row.
     */
    let { row, pointer }: { row: ActionRow; pointer: RowPointer } = $props()

    const GoodSize = 18
    const PawnSize = 24
    const TileSize = 28
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
    {/if}
{/snippet}

{#if row.art?.kind === 'die'}
    <DieChoice choice={row.choice} art={row.art} {pointer} onPress={() => void row.press()} />
{:else}
    <PanelRow
        choice={row.choice}
        {pointer}
        lead={row.art ? lead : undefined}
        onPress={() => void row.press()}
    />
{/if}
{#if row.popup}
    <span
        class="inline-flex items-center gap-1 rounded-lg border border-feudum-accent bg-feudum-surface-raised p-1"
        role="group"
        aria-label="Where {row.choice.label} goes"
        data-row-popup={row.choice.label}
    >
        {#each row.popup as asked (asked.choice.label)}
            <RowChoice row={asked} {pointer} />
        {/each}
    </span>
{/if}
