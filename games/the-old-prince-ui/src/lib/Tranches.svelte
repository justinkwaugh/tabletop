<script lang="ts">
    import {
        availableTheOldPrinceTranche,
        nextTheOldPrinceTranche,
        theOldPrinceCompanyRole,
        TheOldPrinceRoles
    } from '@tabletop/the-old-prince'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { TheOldPrinceSession } from './session.svelte.js'
    let {
        session,
        slotSize = 22,
        layout,
        showInitial = false
    }: {
        session: TheOldPrinceSession
        slotSize?: number
        layout: 'row' | 'stacked'
        showInitial?: boolean
    } = $props()
    const nextTranche = $derived(nextTheOldPrinceTranche(session.gameState))
    const availableTranche = $derived(availableTheOldPrinceTranche(session.gameState))
</script>

{#each session.gameState.tranches.filter((tranche) => showInitial || tranche.id !== 'initial') as tranche (tranche.id)}
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
                {@const role = companyId && theOldPrinceCompanyRole(session.gameState, companyId)}
                {@const holdsBackNextTranche =
                    !!companyId && !!nextTranche?.waitingCompanyIds.includes(companyId)}
                <span class="slot-column">
                    <span class="tranche-slot" class:empty={!companyId}>
                        {#if companyId}<CompanyToken
                                appearance={session.mapView.stations[companyId]}
                                size={slotSize}
                            />{#if holdsBackNextTranche}<span
                                    class="key"
                                    role="img"
                                    aria-label={`${nextTranche?.tranche.name} waits for this company`}
                                    ><svg
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.7"
                                        stroke-linecap="round"
                                        aria-hidden="true"
                                        ><circle cx="5" cy="8" r="2.6"></circle><path
                                            d="M7.6 8H14M12 8v2.4M14 8v1.8"
                                        ></path></svg
                                    ></span
                                >{/if}
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
                    {#if role}<span class="role">{TheOldPrinceRoles[role].shortName}</span>{/if}
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
    .slot-column {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: calc(var(--slot-size) / 12);
    }
    .role {
        color: var(--rail-muted, #887969);
        font-size: calc(var(--slot-size) / 4);
        font-weight: 650;
        letter-spacing: 0.06em;
        line-height: 1;
        text-transform: uppercase;
    }
    .key {
        position: absolute;
        top: calc(var(--slot-size) / -9);
        right: calc(var(--slot-size) / -7);
        display: flex;
        align-items: center;
        justify-content: center;
        width: calc(var(--slot-size) * 0.45);
        height: calc(var(--slot-size) * 0.45);
        border-radius: 50%;
        background: var(--rail-text, #4b4239);
        color: var(--rail-surface, #faf7f2);
    }
    .key svg {
        width: 70%;
        height: 70%;
    }
    .tranche-slot {
        position: relative;
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
