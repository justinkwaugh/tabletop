<script lang="ts">
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import { privateOwner } from '@tabletop/18xx'
    let { session, showUndo = true }: { showUndo?: boolean; session: EighteenXXSession } =
        $props()
    const selection = $derived(session.privates.exchangeSelection)
</script>

<section aria-label="Private companies" class="privates">
    <h2>Private companies</h2>
    <div class="cards">
        {#each session.privates.companies as company (company.id)}
            <article aria-label={company.name}>
                <strong>{company.name}</strong>
                {#if company.closed}<p>Closed</p>
                {:else}
                    {@const owner = privateOwner(session.financialState, company.id)}
                    <p>
                        {owner ? session.ownerName(owner) : 'Unowned'} · Revenue {company.privateRevenue ??
                            0}
                    </p>
                    <p>{company.description}</p>
                    {#each session.privates.exchangeOffers.filter((offer) => offer.privateCompanyId === company.id) as offer (offer.certificateId)}
                        <button onclick={() => session.privates.selectExchange(offer)}
                            >Exchange for {offer.certificateId}</button
                        >
                    {/each}
                {/if}
            </article>
        {/each}
    </div>
    {#if selection}
        <div aria-label="Private exchange preview">
            <p>
                {session.getPlayerName(selection.playerId)} closes {selection.privateCompanyId} for {selection.certificateId}.
            </p>
            <button onclick={() => session.privates.clear()}>Back</button>
            <button onclick={() => session.privates.confirmExchange()}
                >Confirm private exchange</button
            >
        </div>
    {/if}
    {#if showUndo}<button
            disabled={session.busy ||
                session.isViewingHistory ||
                (!selection && !session.actions.length)}
            onclick={() => session.undo()}>Undo</button
        >{/if}
</section>

<style>
    .privates {
        margin-block: 1rem;
    }
    .cards {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    article {
        width: 18rem;
        padding: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.4rem;
    }
    p {
        margin-block: 0.35rem;
    }
    button {
        border: 1px solid #94a3b8;
        border-radius: 0.3rem;
        padding: 0.3rem 0.6rem;
        margin: 0.2rem;
    }
    button:disabled {
        opacity: 0.4;
    }
</style>
