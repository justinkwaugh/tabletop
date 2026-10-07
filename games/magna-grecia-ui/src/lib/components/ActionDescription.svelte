<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import {
        isBuildMarket,
        isEndTurn,
        isPlaceCity,
        isPlaceRoad,
        isResupply,
        isSellMarket,
        type OracleChange
    } from '@tabletop/magna-grecia'
    import { PlayerName } from '@tabletop/frontend-components'
    import { plural, resupplyText } from '$lib/utils/historyTurns.js'

    let { action, justify = 'start' }: { action: GameAction; justify?: 'start' | 'center' } =
        $props()

    const oracleChanges: OracleChange[] = $derived(
        isPlaceRoad(action) || isPlaceCity(action) ? (action.metadata?.oracleChanges ?? []) : []
    )
</script>

<span
    class="inline-flex flex-wrap items-center gap-x-1 {justify === 'center'
        ? 'justify-center'
        : 'justify-start'}"
>
    {#if isPlaceRoad(action)}
        <span>built a road</span>
    {:else if isPlaceCity(action)}
        {#if action.metadata?.founded}
            <span>founded a city</span>
        {:else}
            <span>expanded a city</span>
        {/if}
        {#if action.metadata?.claimVillage}
            <span>beside a village</span>
        {/if}
        {#if action.metadata?.foundingMarket}
            <span>with a free market</span>
        {/if}
        {#if action.metadata?.mergedCityIds.length}
            <span>, joining cities</span>
        {/if}
        {#each action.metadata?.removedMarkets ?? [] as market (`${market.coords.q},${market.coords.r}:${market.playerId}`)}
            <span>—</span>
            <PlayerName playerId={market.playerId} possessive={true} />
            <span>{market.sold ? 'sold market' : 'market'} leaves the game</span>
        {/each}
    {:else if isResupply(action)}
        <span>resupplied {resupplyText(action.roads, action.cities)}</span>
    {:else if isBuildMarket(action)}
        <span>built a market for {plural(action.metadata?.cost ?? 0, 'point')}</span>
    {:else if isSellMarket(action)}
        <span>sold a market for {plural(action.metadata?.value ?? 0, 'point')}</span>
    {:else if isEndTurn(action)}
        <span>ended their turn</span>
    {:else}
        <span>{action.type}</span>
    {/if}
    {#each oracleChanges as change (`${change.oracle.q},${change.oracle.r}`)}
        <span>— an oracle turns to</span>
        {#if change.toPlayerId}
            <PlayerName playerId={change.toPlayerId} possessive={true} />
        {/if}
        <span>city</span>
    {/each}
</span>
