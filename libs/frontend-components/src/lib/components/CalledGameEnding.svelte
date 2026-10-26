<script lang="ts">
    import { GameCallKind } from '@tabletop/common'
    import { getGameSession } from '$lib/model/gameSessionContext.js'
    import { nameListSeparator, winVerb } from '$lib/utils/gameCallText.js'
    import PlayerName from './PlayerName.svelte'

    let { class: className = '' }: { class?: string } = $props()

    const gameSession = getGameSession()
    const call = $derived(gameSession.gameCall)
    const winnerId = $derived(call?.declaredWinnerId)
    const otherApprovers = $derived(
        call?.approvingPlayerIds.filter((playerId) => playerId !== call.initiatorPlayerId) ?? []
    )
</script>

{#snippet names(playerIds: readonly string[])}
    {#each playerIds as playerId, position (playerId)}<PlayerName {playerId} />{nameListSeparator(
            position,
            playerIds.length
        )}{/each}
{/snippet}

{#if call}
    <div class="flex flex-col items-center gap-1 text-center {className}">
        {#if call.kind === GameCallKind.Conceded}
            <p>{@render names([call.initiatorPlayerId])} conceded.</p>
        {:else if winnerId === undefined}
            <p>The game was called with no winner.</p>
        {:else}
            <p>The game was called.</p>
        {/if}
        {#if winnerId !== undefined}
            <p>
                <PlayerName playerId={winnerId} />
                {winVerb(winnerId, gameSession.myPlayer?.id)}.
            </p>
        {/if}
        {#if call.kind === GameCallKind.Called}
            <p class="text-sm opacity-80">
                Asked by {@render names([call.initiatorPlayerId])}{#if otherApprovers.length > 0},
                    agreed by {@render names(otherApprovers)}{/if}.
            </p>
        {/if}
    </div>
{/if}
