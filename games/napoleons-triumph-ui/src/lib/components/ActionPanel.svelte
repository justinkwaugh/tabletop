<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, Side, VictoryKind, commanderDefinition } from '@tabletop/napoleons-triumph'
    import { describeAction } from '$lib/utils/describeAction.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { reinforcementKey } from '$lib/model/session.svelte.js'

    const gameSession = getGameSession()

    const reinforcements = $derived(gameSession.reinforcements)
    const game = $derived(gameSession.gameState)
    const waitingOn = $derived(game.activePlayerIds[0])
    const context = $derived({
        map: game.map,
        sideOf: (playerId: string | undefined) => game.findPlayerState(playerId ?? '')?.side
    })
    const lastAction = $derived(
        gameSession.currentAction ? describeAction(gameSession.currentAction, context) : ''
    )
    const outcome = $derived.by(() => {
        const winner = game.findPlayerState(game.winningPlayerIds[0] ?? '')?.side
        if (!winner) {
            return 'The battle is over.'
        }
        const army = winner === Side.French ? 'The French' : 'The Allies'
        return game.victory === VictoryKind.Decisive
            ? `${army} win a decisive victory: the enemy army is demoralized.`
            : `${army} win a marginal victory on the objectives.`
    })
</script>

<div class="flex flex-wrap items-center gap-2 px-3 max-sm:px-1 pb-2 text-[15px] max-sm:text-[13px] text-[#2b2620]">
    {#if gameSession.gameState.result}
        <span class="nt-outcome">{outcome}</span>
    {:else if !gameSession.canAct}
        <span>{lastAction || 'Waiting for the other army.'}</span>
        {#if !gameSession.isViewingHistory && waitingOn}
            <span class="opacity-70">Waiting for <PlayerName playerId={waitingOn} />.</span>
        {/if}
    {:else if gameSession.isCommanding}
        {#if gameSession.selectedGroup}
            <span>Choose where they go on the map.</span>
        {:else}
            <span>Pick up a corps or a unit on the map.</span>
        {/if}
        {#if reinforcements.length > 0}
            <span class="opacity-70">Off the map:</span>
        {/if}
        {#each reinforcements as reinforcement (reinforcement.commander.id)}
            <button
                type="button"
                class="nt-plain-button"
                aria-label="Bring on {commanderDefinition(reinforcement.commander.id).name}"
                aria-pressed={gameSession.selectedGroupKey === reinforcementKey(reinforcement.commander.id)}
                onclick={() => gameSession.selectReinforcement(reinforcement.commander.id)}
                >{commanderDefinition(reinforcement.commander.id).name}</button
            >
        {/each}
        {#if gameSession.validActionTypes.includes(ActionType.EndTurn)}
            <button type="button" class="nt-plain-button" onclick={() => gameSession.endTurn()}>End turn</button>
        {/if}
    {/if}
</div>
