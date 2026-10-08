<script lang="ts">
    import { ActionType, BonusChit, cityInfo } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { TurnTool } from '$lib/model/selection.js'
    import PaymentPicker from './PaymentPicker.svelte'
    import TradePanel from './TradePanel.svelte'
    import GuildMasterTradePanel from './GuildMasterTradePanel.svelte'
    import ChangeRoutePanel from './ChangeRoutePanel.svelte'
    import RaidPanel from './RaidPanel.svelte'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const me = $derived(gameSession.me)
    const turn = $derived(game.turn)
    const here = $derived(me?.city !== undefined ? cityInfo(me.city).name : '')
    const sailing = $derived(gameSession.sailOptions.length > 0)
    const nextCost = $derived(me && turn ? game.moveCost(me.playerId, false) : 0)

    const tools = $derived([
        {
            tool: TurnTool.Trade,
            label: 'Trade with the city',
            available: gameSession.can(ActionType.TradeGoods)
        },
        {
            tool: TurnTool.GuildMaster,
            label: 'Deal with the guild master',
            available:
                gameSession.can(ActionType.ClaimBonusChit) ||
                gameSession.can(ActionType.ClaimRaidMarker) ||
                gameSession.can(ActionType.ExchangeGoodForMarker) ||
                gameSession.can(ActionType.ExchangeMarkerForGood)
        },
        {
            tool: TurnTool.ChangeRoute,
            label: 'Change a route',
            available: gameSession.can(ActionType.ChangeRoute)
        },
        {
            tool: TurnTool.Raid,
            label: 'Raid',
            available: gameSession.can(ActionType.RaidCity)
        }
    ])
</script>

<div class="flex flex-col gap-2">
    {#if gameSession.pendingSail}
        <PaymentPicker />
    {:else if gameSession.tool === TurnTool.BuyMarkers}
        <PaymentPicker />
    {:else}
        <div class="kogge-prompt">
            {#if sailing}
                Your cog lies in {here}. {nextCost === 0
                    ? 'Click a route to sail; this move is free.'
                    : `Sail on for ${nextCost} good or route marker, or trade here.`}
            {:else if turn?.movementDone}
                In {here}: take your actions, then end your turn.
            {:else}
                Your cog lies in {here} and cannot sail on.
            {/if}
        </div>
        {#if sailing && me?.hasBonus(BonusChit.SecretPassage) && game.guildMaster.city !== me.city}
            <div class="kogge-note">
                The secret passage leads straight to the guild master, for one more good or marker.
            </div>
        {/if}
        <div class="flex flex-wrap items-center gap-2">
            {#if gameSession.can(ActionType.BuildOffice)}
                <button class="kogge-button" onclick={() => gameSession.buildOffice()}
                    >Found an office</button
                >
            {/if}
            {#if gameSession.can(ActionType.BuyRouteMarkers)}
                <span class="kogge-note">Click a pair in the market to buy it for one good.</span>
            {/if}
            {#each tools as entry (entry.tool)}
                {#if entry.available}
                    <button
                        class="kogge-button {gameSession.tool === entry.tool
                            ? 'kogge-button-selected'
                            : ''}"
                        onclick={() => gameSession.chooseTool(entry.tool)}>{entry.label}</button
                    >
                {/if}
            {/each}
            <button
                class="kogge-button kogge-button-primary ml-auto"
                onclick={() => gameSession.endTurn()}>End turn</button
            >
        </div>
        {#if gameSession.tool === TurnTool.Trade}
            <TradePanel />
        {:else if gameSession.tool === TurnTool.GuildMaster}
            <GuildMasterTradePanel />
        {:else if gameSession.tool === TurnTool.ChangeRoute}
            <ChangeRoutePanel />
        {:else if gameSession.tool === TurnTool.Raid}
            <RaidPanel />
        {/if}
    {/if}
</div>
