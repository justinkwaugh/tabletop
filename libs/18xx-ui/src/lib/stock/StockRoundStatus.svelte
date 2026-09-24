<script lang="ts">
    import { getCompany, controllingOwner } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSession } = $props()
    const gameState = $derived(session.gameState)
</script>

<section aria-label="Round status">
    {#if !gameState.stockRound.completed}
        <p><strong>{session.getPlayerName(gameState.activePlayerIds[0])}’s stock turn</strong></p>
        <p>
            Turn order: {gameState.turnManager.turnOrder
                .map((id) => session.getPlayerName(id))
                .join(' → ')}
        </p>
        <p>
            {session.passing === 'pass-order' ? 'Pass order' : 'Consecutive passes'}:
            {gameState.stockRound.passedPlayerIds.length
                ? gameState.stockRound.passedPlayerIds
                      .map((id) => session.getPlayerName(id))
                      .join(' → ')
                : 'None'}
        </p>
    {:else if gameState.operatingSet}
        <p>
            Operating set {gameState.operatingSet.number} · Round {gameState.operatingSet
                .roundNumber} of {gameState.operatingSet.roundCount}
        </p>
        <ol class="steps" aria-label="Operating steps">
            {#each [['LayingTrack', 'Track'], ['PlacingStation', 'Stations'], ['RunningTrains', 'Run trains'], ['DistributingEarnings', 'Distribute earnings'], ['BuyingTrains', 'Buy trains']] as [step, label]}
                <li
                    aria-current={gameState.machineState === step ||
                    gameState.phaseChange?.continuation.machineState === step
                        ? 'step'
                        : undefined}
                >
                    {label}
                </li>
            {/each}
        </ol>
        <ol aria-label="Operating order">
            {#each gameState.operatingSet.companyOrder as companyId}
                {@const owner = controllingOwner(gameState, companyId)}
                <li>
                    {getCompany(gameState, companyId).name}{#if owner}
                        · {session.ownerName(owner)}{/if}
                    {#if gameState.operatingSet.completedCompanyIds.includes(companyId)}
                        · Done{/if}
                </li>
            {/each}
        </ol>
        <p>
            Next stock round: {gameState.turnManager.turnOrder
                .map((id) => session.getPlayerName(id))
                .join(' → ')}
        </p>
    {/if}
</section>

<style>
    .steps {
        display: flex;
        gap: 24px;
        list-style: none;
        padding: 0;
    }
    .steps li {
        color: var(--rail-text, #607268);
    }
    .steps li[aria-current='step'] {
        color: #253b35;
        font-weight: 700;
        text-decoration: underline;
        text-underline-offset: 5px;
    }
    p {
        margin: 8px 0;
    }
    ol {
        padding-left: 22px;
    }
</style>
