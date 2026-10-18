<script lang="ts">
    // The pacts naming the Player: offers to answer, their own waiting on others, and agreed
    // pacts, which resolve once everyone has finished exploring.
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionType,
        anomalyDefinition,
        canAccept,
        eventDefinition,
        pactsNaming,
        shipDefinition,
        type Pact
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import PactEditor from './PactEditor.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const me = $derived(gameSession.myPlayerId ?? '')
    const pacts = $derived(pactsNaming(gameState, me))
    let countering: string | undefined = $state()
    // Pacts are shown to whoever they name, but answered only by a Player who may act now.
    const offered = (type: ActionType) =>
        !gameSession.isViewingHistory && gameSession.validActionTypes.includes(type)

    function targetName(candidate: Pact): string {
        return candidate.terms.targetKind === 'Event'
            ? eventDefinition(candidate.terms.targetId).name
            : anomalyDefinition(candidate.terms.targetId).name
    }

    function shareText(candidate: Pact, playerId: string): string {
        const share = candidate.terms.shares[playerId]
        if (candidate.terms.keeperId !== undefined) {
            return candidate.terms.keeperId === playerId ? 'keeps the tile' : ''
        }
        const parts = [
            share.influence ? `${share.influence} IP` : '',
            share.cash ? `$${share.cash}B` : '',
            share.markers ? `${share.markers} ${share.markers === 1 ? 'marker' : 'markers'}` : '',
            share.settlements
                ? `${share.settlements} ${share.settlements === 1 ? 'settlement' : 'settlements'}`
                : ''
        ].filter(Boolean)
        return parts.length ? parts.join(', ') : 'nothing'
    }
</script>

{#if pacts.length > 0}
    <div class="pacts sh-step">
        {#each pacts as candidate (candidate.id)}
            {@const accepted = candidate.acceptedIds.includes(me)}
            <section class="pact" class:agreed={candidate.agreed}>
                <div class="title">
                    Pact on {targetName(candidate)} at {systemName(candidate.systemId)}
                    <span class="status"
                        >{candidate.agreed
                            ? 'Agreed. It resolves once everyone has finished exploring.'
                            : accepted
                              ? 'Waiting for the other partners'
                              : 'Proposed to you'}</span
                    >
                </div>
                <ul>
                    {#each candidate.terms.partnerIds as playerId (playerId)}
                        <li>
                            <PlayerName {playerId} />
                            {playerId === me ? 'pledge' : 'pledges'}
                            {(candidate.terms.pledges[playerId] ?? [])
                                .map((shipId) => shipDefinition(shipId).name)
                                .join(', ')}; {shareText(candidate, playerId)}
                            {#if candidate.acceptedIds.includes(playerId) && !candidate.agreed}
                                <span class="accepted">accepted</span>
                            {/if}
                        </li>
                    {/each}
                </ul>
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
                            <button type="button" onclick={() => (countering = candidate.id)}
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
                    {#if countering === candidate.id}
                        <PactEditor
                            subject={{
                                targetKind: candidate.terms.targetKind,
                                targetId: candidate.terms.targetId,
                                challenge: candidate.terms.challenge,
                                systemId: candidate.systemId
                            }}
                            existing={candidate}
                            onclose={() => (countering = undefined)}
                        />
                    {/if}
                {/if}
            </section>
        {/each}
    </div>
{/if}

<style>
    .pacts {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .pact {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 10px;
        border: 1px solid #6b4a80;
        border-radius: 8px;
        background: #1a1427;
    }

    .pact.agreed {
        border-color: #3f8f5a;
        background: #12241b;
    }

    .title {
        font-weight: 700;
        color: #e8f1ff;
    }

    .status {
        margin-left: 8px;
        font-size: 12.5px;
        font-weight: 400;
        color: #c9b6e8;
    }

    .agreed .status {
        color: #7fe08a;
    }

    ul {
        font-size: 13px;
        color: #c9d6ea;
    }

    li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }

    .accepted {
        font-size: 11.5px;
        color: #7fe08a;
    }

    .buttons {
        display: flex;
        gap: 8px;
    }
</style>
