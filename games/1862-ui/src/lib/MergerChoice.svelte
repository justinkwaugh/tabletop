<script lang="ts">
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { Session1862 } from './session.svelte.js'
    let {
        session,
        companyId,
        label,
        text
    }: { session: Session1862; companyId: string; label: string; text: string } = $props()
    const money = $derived(session.presentation.money)
</script>

<section class="merger title-panel" aria-label={label}>
    <p>{text}</p>
    <div class="choices" role="group" aria-label="Partners">
        {#each session.mergerPartners as partnerId (partnerId)}
            <button
                class="token-choice"
                aria-pressed={session.mergerPartner === partnerId}
                aria-label={session.companyName(partnerId)}
                onclick={() => (session.mergerPartner = partnerId)}
                ><CompanyToken appearance={session.mapView.stations[partnerId]} size={34} /></button
            >
        {/each}
    </div>
    {#if session.mergerPartner}
        {@const partnerId = session.mergerPartner}
        {@const price = session.mergedPrice(partnerId)}
        {#if price !== undefined}<p>The merged company’s price would be {money(price)}.</p>{/if}
        <div class="choices">
            {#each [companyId, partnerId] as survivorId (survivorId)}
                <button
                    class="action-button"
                    onclick={() => session.proposeMerger(partnerId, survivorId)}
                    >{session.companyInitials(survivorId)} survives</button
                >
            {/each}
        </div>
    {/if}
</section>

<style>
    .merger {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        font-size: 13px;
    }
    p {
        margin: 0;
        max-width: 34em;
        text-align: center;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
</style>
