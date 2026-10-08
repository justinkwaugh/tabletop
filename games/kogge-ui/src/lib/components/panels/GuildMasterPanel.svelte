<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        CITY_COUNT,
        GUILD_MASTER_LAPS,
        GUILD_MASTER_STEP_CHOICES,
        cityInfo,
        guildMasterPath,
        lapsCompleted
    } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const moverId = $derived(game.turnManager.turnOrder[0])
    const myTurn = $derived(gameSession.canAct && moverId === gameSession.myPlayerId)
    const remaining = $derived(CITY_COUNT * GUILD_MASTER_LAPS - game.guildMaster.distance)
    const choices = $derived(
        GUILD_MASTER_STEP_CHOICES.map((steps) => {
            const path = guildMasterPath(game.guildMaster, game.cities, steps)
            return {
                steps,
                city: path.stops[path.stops.length - 1],
                endsGame: path.distance >= remaining
            }
        })
    )
</script>

<div class="flex flex-col gap-2">
    {#if myTurn}
        <div class="kogge-prompt">
            You lead this round. Move the guild master one or two cities on
        </div>
        <div class="kogge-note">
            He brings two goods to the city where he stops, and skips raided cities. When he passes
            the Spiel&nbsp;Ende marker for the second time the game ends. He has completed {lapsCompleted(
                game.guildMaster
            )}
            of 2 rounds.
        </div>
        <div class="flex flex-wrap gap-2">
            {#each choices as choice (choice.steps)}
                <button
                    class="kogge-button"
                    onclick={() => gameSession.moveGuildMaster(choice.steps)}
                >
                    {choice.steps === 1 ? 'One city' : 'Two cities'} → {cityInfo(choice.city).name}
                    {#if choice.endsGame}<span class="text-[#9e231f]"> (ends the game)</span>{/if}
                </button>
            {/each}
        </div>
    {:else}
        <div class="kogge-prompt inline-flex gap-1">
            <PlayerName playerId={moverId} />
            <span>leads the round and moves the guild master</span>
        </div>
    {/if}
</div>
