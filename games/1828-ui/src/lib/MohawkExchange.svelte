<script lang="ts">
    import { CompanyToken, StockPanelHeading } from '@tabletop/18xx-ui'
    import { MhId, type MohawkShareOffer } from '@tabletop/1828'
    import type { Session1828 } from './session.svelte.js'
    let { session }: { session: Session1828 } = $props()
    const money = $derived(session.presentation.money)
    const offers = $derived(session.mohawkExchange)
    const FloatNotes = {
        now: 'Floats the company',
        'this-round': 'Floats, operates this round',
        'next-round': 'Floats, operates next round'
    } as const
    function notes(offer: MohawkShareOffer): string[] {
        return [
            ...(offer.float ? [FloatNotes[offer.float]] : []),
            ...(offer.becomesDirector ? [`You become ${session.terms.presidentWord}`] : [])
        ]
    }
</script>

{#snippet company(companyId: string, detail: string)}
    <CompanyToken appearance={session.mapView.stations[companyId]} size={22} />
    <span class="name">{session.companyName(companyId)}</span>
    <span class="detail">{detail}</span>
{/snippet}

<section class="exchange" aria-label="Exchange the Mohawk & Hudson Railroad">
    <StockPanelHeading text={`Exchange ${session.companyName(MhId)} for`} />
    {#if offers.shares.length}
        <h3>A 10% share</h3>
        <div class="rows">
            {#each offers.shares as offer (offer.certificateId)}
                <button
                    class="row"
                    disabled={session.actionsLocked}
                    onclick={() => void session.exchangeMohawkForShare(offer)}
                >
                    {@render company(offer.companyId, session.poolName(offer.poolId))}
                    {#each notes(offer) as note (note)}<span class="note">{note}</span>{/each}
                </button>
            {/each}
        </div>
    {/if}
    {#if offers.directorships.length}
        <h3>
            A {session.terms.presidentWord}’s certificate
            <small>Pay for the other 10%, then set its par</small>
        </h3>
        <div class="rows">
            {#each offers.directorships as offer (offer.companyId)}
                <button
                    class="row"
                    aria-pressed={session.mohawkDirectorship?.companyId === offer.companyId}
                    disabled={session.actionsLocked}
                    onclick={() => session.chooseMohawkDirectorship(offer.companyId)}
                >
                    {@render company(offer.companyId, `from ${money(offer.pars[0].price)}`)}
                </button>
                {#if session.mohawkDirectorship?.companyId === offer.companyId}
                    <div class="pars" role="group" aria-label="Par price">
                        {#each offer.pars as par (par.marketSpaceId)}
                            <button
                                aria-pressed={session.mohawkPar?.marketSpaceId ===
                                    par.marketSpaceId}
                                disabled={session.actionsLocked}
                                onclick={() => session.chooseMohawkPar(par.marketSpaceId)}
                                >{money(par.price)}</button
                            >
                        {/each}
                    </div>
                    {#if session.mohawkPar}
                        <button
                            class="confirm"
                            disabled={session.actionsLocked}
                            onclick={() => void session.exchangeMohawkForDirectorship()}
                            >Pay {money(session.mohawkPar.price)} and take the certificate</button
                        >
                    {/if}
                {/if}
            {/each}
        </div>
    {/if}
</section>

<style>
    .exchange {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 4px auto 8px;
        width: min(100%, 440px);
        color: var(--rail-text, #514536);
        font-size: 12px;
    }
    h3 {
        margin: 6px 0 0;
        font-size: 12px;
        font-weight: 600;
    }
    small {
        display: block;
        font-weight: 400;
        color: var(--rail-muted, #817565);
    }
    .rows {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    button {
        border: 0;
        border-radius: 4px;
        background: var(--rail-surface-inset, #e7dccb);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    button:disabled {
        cursor: default;
        opacity: 0.55;
    }
    button[aria-pressed='true'] {
        background: var(--rail-surface-selected, #ded0c2);
        font-weight: 600;
    }
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px 8px;
        padding: 4px 8px;
        text-align: left;
    }
    .name {
        flex: 1 1 auto;
    }
    .detail {
        color: var(--rail-muted, #817565);
    }
    .note {
        flex-basis: 100%;
        padding-left: 30px;
        color: var(--rail-muted, #817565);
        font-size: 11px;
    }
    .pars {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 2px 0 2px 30px;
    }
    .pars button {
        padding: 3px 10px;
    }
    .confirm {
        margin-left: 30px;
        padding: 5px 10px;
        background: var(--rail-solid, #695540);
        color: #fffaf4;
        font-weight: 600;
    }
</style>
