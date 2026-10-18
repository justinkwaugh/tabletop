<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plural, systemName } from '$lib/utils/presentation.js'
    import EventTile from '../EventTile.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const bases = $derived(gameState.basesOf(gameSession.myPlayerId ?? ''))
</script>

<div class="sh-step">
    <div class="row">
        <EventTile eventId="homesteaders" width={96} />
        <div class="body">
            <p class="hint">
                Homesteaders: as the faction with the fewest settlements, add 2 settlements to one
                of your bases.
            </p>
            <div class="systems">
                {#each bases as base (base.systemId)}
                    <button
                        type="button"
                        onclick={() => gameSession.placeHomesteaders(base.systemId)}
                        >{systemName(base.systemId)}
                        <span class="note">{plural(base.settlements, 'settlement')}</span></button
                    >
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }

    .body {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .systems {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .note {
        font-size: 12px;
        color: #8fa4c2;
    }
</style>
