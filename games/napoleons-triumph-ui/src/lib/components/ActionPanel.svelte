<script lang="ts">
    import PlaceText from './PlaceText.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { Side, VictoryKind } from '@tabletop/napoleons-triumph'
    import { describeAction } from '$lib/utils/describeAction.js'
    import { revealedRideLines } from '$lib/utils/revealedRide.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Orders from './Orders.svelte'

    let { ordersDrawerHeight = $bindable(0) }: { ordersDrawerHeight?: number } = $props()

    const gameSession = getGameSession()

    const game = $derived(gameSession.gameState)
    const waitingOn = $derived(game.activePlayerIds[0])
    const lastAction = $derived(
        gameSession.currentAction ? describeAction(gameSession.currentAction, game) : ''
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

{#if gameSession.isViewingHistory}
    <p class="nt-action">
        {#if lastAction}<PlaceText text={lastAction} />{:else}The armies are about to take the
            field.{/if}
    </p>
{:else if gameSession.gameState.result}
    <p class="nt-action">{outcome}</p>
{:else if gameSession.isSeeingRide}
    {@const lines = revealedRideLines(game)}
    <div class="nt-reveal">
        <p class="nt-action"><span><PlaceText text={lines?.riding ?? ''} /></span></p>
        <p class="nt-action">
            <span>{lines?.revealed}</span>
            <button
                type="button"
                class="nt-plain-button"
                onclick={() => gameSession.acknowledgeReveal()}>Continue</button
            >
        </p>
    </div>
{:else if gameSession.isCommanding}
    <Orders bind:drawerHeight={ordersDrawerHeight} />
{:else}
    <p class="nt-action">
        <span
            >{#if lastAction}<PlaceText text={lastAction} />{:else}Waiting for the other army.{/if}</span
        >
        {#if waitingOn}
            <span class="nt-action-faint">Waiting for <PlayerName playerId={waitingOn} />.</span>
        {/if}
    </p>
{/if}

<style>
    .nt-action {
        display: flex;
        flex-wrap: wrap;
        gap: 0 12px;
        font-size: 16px;
        line-height: 1.35;
    }

    .nt-reveal {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .nt-action-faint {
        opacity: 0.66;
    }

    @media (max-width: 639px) {
        .nt-action {
            font-size: 13px;
        }
    }
</style>
