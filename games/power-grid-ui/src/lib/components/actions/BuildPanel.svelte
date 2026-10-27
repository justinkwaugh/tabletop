<script lang="ts">
    import { gameMap } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Elektro from './Elektro.svelte'

    const session = getGameSession()
    const names = $derived(
        new Map(gameMap(session.gameState.mapId).cities.map((city) => [city.id, city.name]))
    )
    const hasNetwork = $derived(
        session.myPlayerId !== undefined && session.gameState.cityCount(session.myPlayerId) > 0
    )
</script>

<div class="column">
    <p class="prompt">
        {#if session.buildTargets.size === 0 && session.buildDraft.length === 0}
            You cannot afford to connect another city.
        {:else if !hasNetwork && session.buildDraft.length === 0}
            Choose a starting city on the map; it costs 10 to build there.
        {:else}
            Click cities on the map to connect them. Each one shows what it adds to the bill.
        {/if}
    </p>
    <div class="controls">
        {#each session.buildQuote?.steps ?? [] as step (step.cityId)}
            <button type="button" class="chip" onclick={() => session.toggleCity(step.cityId)}>
                {names.get(step.cityId)}
                <span class="cost"
                    >{step.houseCost}{step.connectionCost > 0
                        ? ` + ${step.connectionCost}`
                        : ''}</span
                >
            </button>
        {/each}
        <button type="button" class="btn primary" onclick={() => session.buildCities()}>
            {#if session.buildDraft.length > 0}
                Build {session.buildDraft.length}
                {session.buildDraft.length === 1 ? 'city' : 'cities'} for <Elektro
                    amount={session.buildCost}
                />
            {:else}
                Build nothing
            {/if}
        </button>
    </div>
</div>

<style>
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #1b201b;
        border: 2px solid #f3c534;
        border-radius: 6px;
        padding: 2px 8px;
        font-weight: 600;
        color: #ecebe1;
    }
    .cost {
        color: #f3c534;
        font-weight: 700;
    }
</style>
