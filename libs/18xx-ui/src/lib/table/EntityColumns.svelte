<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Company } from '@tabletop/18xx'
    import { chainSidewaysScroll } from '@tabletop/frontend-components'
    import type { EntityColumn, EntityHolders } from './entityColumns.js'

    let {
        columns,
        holders,
        company
    }: {
        columns: readonly EntityColumn[]
        holders: Snippet<[EntityHolders]>
        company: Snippet<[Company]>
    } = $props()
</script>

<div class="entity-columns" aria-label="Entities" {@attach chainSidewaysScroll}>
    {#each columns as column (column.key)}
        {@const uncontrolled = !column.playerIds.length}
        <section
            class="entity-column"
            aria-label={uncontrolled ? 'Companies without a president' : undefined}
        >
            {#if uncontrolled}<h3 class="no-president">No president</h3>{/if}
            {#if column.playerIds.length || column.portfolioCompanyIds.length}{@render holders(
                    column
                )}{/if}
            {#each column.companies as entry (entry.id)}{@render company(entry)}{/each}
        </section>
    {/each}
</div>

<style>
    .entity-columns {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 310px;
        align-items: start;
        gap: 10px;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
        overflow: auto;
    }
    .entity-column {
        display: grid;
        gap: 8px;
        min-width: 0;
    }
    /* Lines the player cards up with the company cards under them. */
    .entity-column :global(.players) {
        padding: 0;
    }
    .no-president {
        margin: 0;
        padding: 8px 10px;
        border: 1px solid var(--rail-border, #d2c5b7);
        border-radius: 8px;
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-muted, #887969);
        font-size: 14px;
        font-weight: 700;
    }
</style>
