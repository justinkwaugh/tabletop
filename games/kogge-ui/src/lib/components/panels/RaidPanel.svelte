<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, cityInfo } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const me = $derived(gameSession.me)
    const victims = $derived(
        me && gameSession.can(ActionType.RaidCog)
            ? gameSession.gameState.raidableCogs(me.playerId)
            : []
    )
    const city = $derived(me?.city !== undefined ? cityInfo(me.city).name : '')
</script>

<div class="flex flex-col gap-1 rounded-md border border-[#9e231f] bg-[#f3dcc8] p-2 text-sm">
    <div>
        A raid ends your turn. You may never enter {city} again, the guild master will pass it by, and
        the other merchants send your cog away along one of its routes.
    </div>
    <div class="flex flex-wrap items-center gap-2">
        <button class="kogge-button" onclick={() => gameSession.raidCity()}>Plunder {city}</button>
        {#each victims as victimId (victimId)}
            <button
                class="kogge-button inline-flex gap-1"
                onclick={() => gameSession.raidCog(victimId)}
            >
                Rob the cog of <PlayerName playerId={victimId} />
            </button>
        {/each}
    </div>
</div>
