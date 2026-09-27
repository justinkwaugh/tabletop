<script lang="ts">
    import { availableTheOldPrinceTranche } from '@tabletop/the-old-prince'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { TheOldPrinceSession } from './session.svelte.js'
    let {
        session,
        slotSize = 22,
        layout
    }: {
        session: TheOldPrinceSession
        slotSize?: number
        layout: 'row' | 'stacked'
    } = $props()
    const availableTranche = $derived(availableTheOldPrinceTranche(session.gameState))
</script>

{#each session.gameState.tranches.filter((tranche) => tranche.id !== 'initial') as tranche (tranche.id)}
    {@const closed =
        tranche.companyIds.length < tranche.capacity && tranche.id !== availableTranche?.id}
    <div
        class="tranche"
        class:row={layout === 'row'}
        class:stacked={layout === 'stacked'}
        class:closed
        aria-label={`${tranche.name}${closed ? ': closed' : ''}`}
        title={closed ? `${tranche.name}: closed` : tranche.name}
        style:--slot-size={`${slotSize}px`}
    >
        <div class="slots">
            {#each Array.from({ length: tranche.capacity }, (_, index) => tranche.companyIds[index]) as companyId, i (i)}
                <span class="tranche-slot" class:empty={!companyId}>
                    {#if companyId}<CompanyToken
                            appearance={session.mapView.stations[companyId]}
                            size={slotSize}
                        />
                    {:else if closed}<svg
                            width={slotSize / 2}
                            height={slotSize / 2}
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            aria-hidden="true"
                            ><rect x="3" y="7" width="10" height="7" rx="1.5"></rect><path
                                d="M5 7V5a3 3 0 0 1 6 0v2"
                            ></path></svg
                        >{/if}
                </span>
            {/each}
        </div>
    </div>
{/each}

<style>
    .tranche {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: calc(var(--slot-size) / 4);
        padding: 0 8px;
    }
    .row {
        flex-grow: 1;
    }
    .row:last-child {
        padding-right: 0;
    }
    .row + .row {
        border-left: 1px solid var(--rail-border, #b8a995);
    }
    .stacked {
        padding: 0;
    }
    .stacked.closed {
        opacity: 0.55;
    }
    .slots {
        display: flex;
        gap: calc(var(--slot-size) / 4.4);
    }
    .tranche-slot.empty {
        background: color-mix(in srgb, var(--rail-muted, #887969) 35%, transparent);
    }
    .closed .tranche-slot.empty {
        border-style: dashed;
        background: transparent;
        color: var(--rail-text, #776657);
    }
    .stacked .tranche-slot.empty {
        border-color: var(--rail-muted, #887969);
    }
    .row.closed .tranche-slot.empty {
        opacity: 0.55;
    }
    .tranche-slot {
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--slot-size);
        height: var(--slot-size);
        border: 1px solid var(--rail-border, #b8a995);
        border-radius: 50%;
        background: var(--rail-surface-raised, #dfd3c8);
    }
</style>
