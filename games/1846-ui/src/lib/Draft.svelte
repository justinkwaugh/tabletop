<script lang="ts">
    import { draftCompany, isBlank, priceFor } from '@tabletop/1846'
    import { CompanyDescriptions } from './companyDescriptions.js'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const state = $derived(session.gameState)
    const hiddenDraft = $derived(state.draft.kind === 'hidden' ? state.draft : undefined)
    const mine = $derived(
        hiddenDraft?.participants.find((player) => player.playerId === session.myPlayer?.id)
    )
    const name = (id: string) => session.getPlayerName(id)
    const label = (id: string) => (isBlank(id) ? 'Blank — take no company' : draftCompany(id).name)
</script>

{#if hiddenDraft}
    <section>
        <h2>{state.activePlayerIds.map(name).join(', ')} to choose</h2>
        <p>
            Draft counter-clockwise. Choose one card; the others return shuffled to the bottom. Pay
            when everyone reveals.
        </p>
        {#if hiddenDraft.finalOffer}
            <h3>Last company: {label(hiddenDraft.finalOffer.cardId)}</h3>
            <p>
                Current total: ${hiddenDraft.finalOffer.price}. Passing reduces its list price by
                $10; debt must still be paid.
            </p>
            <button
                disabled={!session.canChooseAction || !session.draftChoices.length}
                onclick={() => session.choose(hiddenDraft!.finalOffer!.cardId)}
                >Buy for ${hiddenDraft.finalOffer.price}</button
            >
            <button disabled={!session.canChooseAction} onclick={() => session.passFinalCompany()}
                >Pass · reduce by $10</button
            >
        {/if}
        {#if (mine?.packet?.length || mine?.selections?.length) && !session.packetVisible}
            <p>Pass the device to {session.myPlayer?.name} before opening these cards.</p>
            <button onclick={() => session.revealPacket()}>Show my cards</button>
        {:else if mine?.packet && session.packetVisible}
            {#if !hiddenDraft.finalOffer}
                <div class="cards">
                    {#each mine.packet as id (id)}
                        <button
                            class="card"
                            disabled={!session.canChooseAction ||
                                !session.draftChoices.includes(id)}
                            onclick={() => session.choose(id)}
                        >
                            <strong>{label(id)}</strong>
                            {#if !isBlank(id)}<span>${priceFor(state, id)} total</span>
                                <small>{CompanyDescriptions[id]}</small><small
                                    >{draftCompany(id).kind === 'independent'
                                        ? `$${draftCompany(id).price} treasury + $${draftCompany(id).debt} debt`
                                        : `$${draftCompany(id).revenue} income per operating round`}</small
                                >{/if}
                        </button>
                    {/each}
                </div>
            {/if}
            <button onclick={() => session.hidePacket()}>Hide cards</button>
        {:else if !hiddenDraft.finalOffer}<p>
                Waiting for the active player to choose privately.
            </p>{/if}
        {#if session.packetVisible && mine?.selections?.length}
            <h3>
                Your commitments · ${mine.selections.reduce((sum, item) => sum + item.price, 0)}
            </h3>
            <ul>
                {#each mine.selections as selection (selection.cardId)}<li>
                        {label(selection.cardId)} · ${selection.price}
                    </li>{/each}
            </ul>
        {/if}
    </section>
{/if}
