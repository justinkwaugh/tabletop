<script lang="ts">
    import { draftCompany, isBlank, priceFor } from '@tabletop/1846'
    import DraftCard from './DraftCard.svelte'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const state = $derived(session.gameState)
    const money = $derived(session.presentation.money)
    const hiddenDraft = $derived(state.draft.kind === 'hidden' ? state.draft : undefined)
    const mine = $derived(
        hiddenDraft?.participants.find((player) => player.playerId === session.myPlayer?.id)
    )
    const choosers = $derived(state.activePlayerIds.map((id) => session.getPlayerName(id)))
    const label = (id: string) => (isBlank(id) ? 'Pass' : draftCompany(id).name)
</script>

{#if hiddenDraft}
    <section class="draft" aria-label="Private company draft">
        <header class="draft-heading">
            <h2>{choosers.join(', ')} to choose</h2>
            <p>
                Draft counter-clockwise. Choose one card; the others return shuffled to the bottom.
                Pay when everyone reveals.
            </p>
        </header>
        {#if hiddenDraft.finalOffer}
            {@const offer = hiddenDraft.finalOffer}
            <div class="draft-cards">
                <DraftCard {session} cardId={offer.cardId} price={offer.price}>
                    {#snippet actions()}
                        <button
                            class="action-button"
                            disabled={!session.canChooseAction || !session.draftChoices.length}
                            onclick={() => session.choose(offer.cardId)}>Buy</button
                        >
                        <button
                            disabled={!session.canChooseAction}
                            onclick={() => session.passFinalCompany()}
                            >Pass · reduce by {money(10)}</button
                        >
                    {/snippet}
                </DraftCard>
            </div>
            <p class="draft-note">
                Last company. Passing reduces its list price by {money(10)}; debt must still be
                paid.
            </p>
        {/if}
        {#if (mine?.packet?.length || mine?.selections?.length) && !session.packetVisible}
            <div class="draft-gate">
                <p>Pass the device to {session.myPlayer?.name} before opening these cards.</p>
                <button class="action-button" onclick={() => session.revealPacket()}
                    >Show my cards</button
                >
            </div>
        {:else if mine?.packet && session.packetVisible}
            {#if !hiddenDraft.finalOffer}
                <div class="draft-cards">
                    {#each mine.packet as id (id)}
                        <DraftCard {session} cardId={id} price={priceFor(state, id)}>
                            {#snippet actions()}
                                <button
                                    class="action-button"
                                    disabled={!session.canChooseAction ||
                                        !session.draftChoices.includes(id)}
                                    onclick={() => session.choose(id)}>Choose</button
                                >
                            {/snippet}
                        </DraftCard>
                    {/each}
                </div>
            {/if}
        {:else if !hiddenDraft.finalOffer}
            <p class="draft-waiting">Waiting for {choosers.join(', ')} to choose privately.</p>
        {/if}
        {#if session.packetVisible && mine?.selections?.length}
            <div class="draft-commitments" aria-label="Your commitments">
                <span class="commitments-label">Your picks</span>
                {#each mine.selections as selection (selection.cardId)}<span class="commitment"
                        >{label(selection.cardId)} <strong>{money(selection.price)}</strong></span
                    >{/each}
                <span class="commitments-total"
                    >Total <strong
                        >{money(mine.selections.reduce((sum, item) => sum + item.price, 0))}</strong
                    ></span
                >
            </div>
        {/if}
        {#if mine?.packet && session.packetVisible}
            <button class="draft-hide" onclick={() => session.hidePacket()}>Hide my cards</button>
        {/if}
    </section>
{/if}
