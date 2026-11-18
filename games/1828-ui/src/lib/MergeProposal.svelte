<script lang="ts">
    import { CompanyToken, StockPanelHeading } from '@tabletop/18xx-ui'
    import MergerHeading from './MergerHeading.svelte'
    import MergerOutcome from './MergerOutcome.svelte'
    import type { Session1828 } from './session.svelte.js'
    let { session }: { session: Session1828 } = $props()
    const initials = (companyId: string) => session.companyInitials(companyId)
</script>

{#snippet token(companyId: string, size: number)}
    <CompanyToken appearance={session.mapView.stations[companyId]} {size} />
{/snippet}

<section class="centered-panel merge" aria-label="Merge companies">
    <div class="heading">
        {#if session.mergerProposal}
            {@const [first, second] = session.mergerProposal.pair.companyIds}
            <MergerHeading
                {session}
                {first}
                {second}
                joiner="+"
                label={`Merge ${initials(first)} and ${initials(second)}`}
            />
        {:else}
            <StockPanelHeading text="Merge two companies" />
        {/if}
    </div>
    {#if session.mergerPairs.length > 1}
        <div class="pairs" role="group" aria-label="Companies to merge">
            {#each session.mergerPairs as pair (pair.key)}
                <button
                    class="pair"
                    aria-pressed={pair.key === session.mergerPair?.key}
                    aria-label={`${initials(pair.companyIds[0])} and ${initials(pair.companyIds[1])}`}
                    disabled={session.actionsLocked}
                    onclick={() => session.chooseMergerPair(pair.key)}
                    >{@render token(pair.companyIds[0], 26)}{@render token(
                        pair.companyIds[1],
                        26
                    )}<span>{initials(pair.companyIds[0])} + {initials(pair.companyIds[1])}</span
                    ></button
                >
            {/each}
        </div>
    {/if}
    {#if session.mergerProposal}
        {@const { pair, preview } = session.mergerProposal}
        <MergerOutcome {session} {preview} />
        <div class="survivors" role="group" aria-label="Survivor">
            {#each pair.options as { survivorId, absorbedId } (survivorId)}
                <button
                    class="action-button propose"
                    disabled={session.actionsLocked}
                    aria-label={`Merge ${initials(absorbedId)} into ${initials(survivorId)}`}
                    onclick={() => session.proposeMerger(survivorId, absorbedId)}
                    >{@render token(survivorId, 20)}<span>Merge into {initials(survivorId)}</span
                    ></button
                >
            {/each}
        </div>
    {/if}
</section>

<style>
    .merge {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
        font-size: 13px;
        text-align: center;
        color: var(--rail-text, #514536);
    }
    .heading {
        display: flex;
        align-items: center;
        min-height: 30px;
    }
    .pairs,
    .survivors {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    .pair {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface, #fbf7f0);
        color: var(--rail-text, #514536);
        font-weight: 600;
        cursor: pointer;
    }
    .pair[aria-pressed='true'] {
        border-color: var(--rail-focus, #443e35);
        background: var(--rail-surface-selected, #e5d9c8);
    }
    .pair:disabled,
    .propose:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .propose {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 13px;
    }
</style>
