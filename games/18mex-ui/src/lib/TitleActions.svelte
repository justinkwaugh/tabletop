<script lang="ts">
    import { NdmId } from '@tabletop/18mex'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { SessionMex } from './session.svelte.js'
    let { session }: { session: SessionMex } = $props()
    const name = (companyId: string) => session.companyName(companyId)
    const token = (companyId: string) => session.mapView.stations[companyId]
    const money = $derived(session.presentation.money)
    const decision = $derived(session.mergerDecision)
</script>

{#snippet heading(companyId: string, text: string)}
    <p class="heading">
        <CompanyToken appearance={token(companyId)} size={28} /><span>{text}</span>
    </p>
{/snippet}

{#snippet company(companyId: string, detail?: string)}
    <CompanyToken appearance={token(companyId)} size={30} />
    <span class="company">
        <span class="name">{name(companyId)}</span>
        {#if detail}<span class="detail">{detail}</span>{/if}
    </span>
{/snippet}

{#if decision?.kind === 'offer'}
    <section class="merger" aria-label="NdM merger">
        {@render heading(NdmId, 'Merge one of your companies into the NdM?')}
        <div class="choices">
            {#each decision.options as option (option.companyId)}
                <button
                    class="action-button choice"
                    disabled={session.actionsLocked}
                    aria-label="Merge {name(option.companyId)} into the NdM"
                    onclick={() => void session.mergeIntoNdm(option.companyId)}
                    >{@render company(
                        option.companyId,
                        option.payout
                            ? `You get NdM 10% + ${money(option.payout)}`
                            : 'You get NdM 10%'
                    )}</button
                >
            {/each}
        </div>
        <button
            class="action-button"
            disabled={session.actionsLocked}
            onclick={() => void session.declineMerger()}>Decline</button
        >
    </section>
{:else if decision?.kind === 'unfloated'}
    <section class="merger" aria-label="NdM merger">
        {@render heading(NdmId, 'Choose an unfloated company to merge into the NdM')}
        <div class="choices">
            {#each decision.companyIds as companyId (companyId)}
                <button
                    class="action-button choice"
                    disabled={session.actionsLocked}
                    aria-label="Merge {name(companyId)} into the NdM"
                    onclick={() => void session.mergeIntoNdm(companyId)}
                    >{@render company(companyId)}</button
                >
            {/each}
        </div>
    </section>
{:else if decision?.kind === 'station'}
    <section class="merger" aria-label="NdM exchange station">
        {@render heading(decision.companyId ?? NdmId, 'Which station becomes the NdM’s?')}
        <div class="choices">
            {#each decision.locationIds as locationId (locationId)}
                <button
                    class="action-button"
                    disabled={session.actionsLocked}
                    onclick={() => void session.chooseExchangeStation(locationId)}
                    >{session.placeName(locationId)}</button
                >
            {/each}
        </div>
    </section>
{:else if session.mergerWaitingOn}
    <section class="merger" aria-label="NdM merger">
        {@render heading(
            NdmId,
            `Waiting for ${session.getPlayerName(session.mergerWaitingOn)} to decide the NdM merger`
        )}
    </section>
{/if}

<style>
    .merger {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin: 4px 0;
        font-size: 13px;
    }
    .heading {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-weight: 600;
    }
    .action-button {
        margin: 0;
        padding: 5px 14px;
        border-radius: 4px;
        cursor: pointer;
    }
    .action-button:disabled {
        cursor: default;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .choice {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px 6px 6px;
        text-align: left;
    }
    .company {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
    }
    .name {
        font-weight: 600;
    }
    .detail {
        font-size: 11px;
        opacity: 0.8;
    }
</style>
