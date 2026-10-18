<script lang="ts">
    // The pacts naming the Player: offers to answer, their own waiting on others, and agreed
    // pacts, which resolve once everyone has finished exploring.
    import { ActionType, canAccept, pactsNaming, type Pact } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { pactOpening } from '$lib/utils/pacts.js'
    import PactSummary from '../PactSummary.svelte'
    import PactEditor from './PactEditor.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const me = $derived(gameSession.myPlayerId ?? '')
    const pacts = $derived(pactsNaming(gameState, me))
    // Pacts are shown to whoever they name, but answered only by a Player who may act now.
    const offered = (type: ActionType) =>
        !gameSession.isViewingHistory && gameSession.validActionTypes.includes(type)

    function status(candidate: Pact): string {
        if (candidate.agreed) {
            return 'Agreed. It resolves once everyone has finished exploring.'
        }
        return candidate.acceptedIds.includes(me)
            ? 'Waiting for the other partners'
            : 'Proposed to you'
    }

    function counterDraft(candidate: Pact) {
        const draft = gameSession.pactDraft
        return draft?.counteredPactId === candidate.id ? draft : undefined
    }
</script>

{#if pacts.length > 0}
    <div class="pacts sh-step">
        {#each pacts as candidate (candidate.id)}
            {@const accepted = candidate.acceptedIds.includes(me)}
            {@const draft = counterDraft(candidate)}
            <PactSummary pact={candidate} viewerId={me} status={status(candidate)}>
                {#if !candidate.agreed}
                    <div class="buttons">
                        {#if !accepted && offered(ActionType.AcceptPact)}
                            <button
                                type="button"
                                class="primary"
                                disabled={!canAccept(
                                    gameState,
                                    me,
                                    candidate.id,
                                    candidate.revision
                                )}
                                onclick={() =>
                                    gameSession.acceptPact(candidate.id, candidate.revision)}
                                >Accept</button
                            >
                        {/if}
                        {#if offered(ActionType.ProposePact)}
                            <button
                                type="button"
                                aria-pressed={draft !== undefined}
                                onclick={() =>
                                    gameSession.openPactDraft(pactOpening(candidate), candidate)}
                                >Counter</button
                            >
                        {/if}
                        {#if offered(ActionType.WithdrawPact)}
                            <button
                                type="button"
                                onclick={() => gameSession.withdrawPact(candidate.id)}
                                >{accepted ? 'Withdraw' : 'Decline'}</button
                            >
                        {/if}
                    </div>
                    {#if draft}
                        <PactEditor {draft} />
                    {/if}
                {/if}
            </PactSummary>
        {/each}
    </div>
{/if}

<style>
    .pacts {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .buttons {
        display: flex;
        gap: 8px;
    }
</style>
