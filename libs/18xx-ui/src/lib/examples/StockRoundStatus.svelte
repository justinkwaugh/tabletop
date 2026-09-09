<script lang="ts">
    import { getCompany, controllingOwner } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const state = $derived(session.financialState)
</script>

<section aria-label="Round status">
    {#if !state.stockRound.completed}
        <p><strong>{session.getPlayerName(state.activePlayerIds[0])}’s stock turn</strong></p>
        <p>
            Turn order: {state.turnManager.turnOrder
                .map((id) => session.getPlayerName(id))
                .join(' → ')}
        </p>
        <p>
            {session.passing === 'pass-order' ? 'Pass order' : 'Consecutive passes'}:
            {state.stockRound.passedPlayerIds.length
                ? state.stockRound.passedPlayerIds
                      .map((id) => session.getPlayerName(id))
                      .join(' → ')
                : 'None'}
        </p>
    {:else if state.operatingSet}
        <p>Round {state.operatingSet.roundNumber} of {state.operatingSet.roundCount}</p>
        <ol aria-label="Operating order">
            {#each state.operatingSet.companyOrder as companyId}
                {@const owner = controllingOwner(state, companyId)}
                <li>
                    {getCompany(state, companyId).name}{#if owner}
                        · {session.ownerName(owner)}{/if}
                </li>
            {/each}
        </ol>
        <p>
            Next stock round: {state.turnManager.turnOrder
                .map((id) => session.getPlayerName(id))
                .join(' → ')}
        </p>
    {/if}
</section>

<style>
    p {
        margin: 8px 0;
    }
    ol {
        padding-left: 22px;
    }
</style>
