<script lang="ts">
    import { GameCallKind, isPlayerCall, STALLED_GAME_END_DAYS } from '@tabletop/common'
    import { getGameSession } from '$lib/model/gameSessionContext.js'
    import { nameListSeparator, winVerb } from '$lib/utils/gameCallText.js'
    import PlayerName from './PlayerName.svelte'

    let { class: className = '' }: { class?: string } = $props()

    const gameSession = getGameSession()
    const call = $derived(gameSession.gameCall)
    const playerCall = $derived(call && isPlayerCall(call) ? call : undefined)
    const winnerId = $derived(playerCall?.declaredWinnerId)
    const otherApprovers = $derived(
        playerCall?.approvingPlayerIds.filter(
            (playerId) => playerId !== playerCall.initiatorPlayerId
        ) ?? []
    )
</script>

{#snippet names(playerIds: readonly string[])}
    {#each playerIds as playerId, position (playerId)}<PlayerName {playerId} />{nameListSeparator(
            position,
            playerIds.length
        )}{/each}
{/snippet}

{#if call?.kind === GameCallKind.Stalled}
    <div class="flex flex-col items-center gap-1 text-center {className}">
        <p>The game ended with no winner.</p>
        <p class="text-sm opacity-80">Nobody moved for {STALLED_GAME_END_DAYS} days.</p>
    </div>
{:else if playerCall}
    <div class="flex flex-col items-center gap-1 text-center {className}">
        {#if playerCall.kind === GameCallKind.Conceded}
            <p>{@render names([playerCall.initiatorPlayerId])} conceded.</p>
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
        {#if playerCall.kind === GameCallKind.Called}
            <p class="text-sm opacity-80">
                Asked by {@render names([
                    playerCall.initiatorPlayerId
                ])}{#if otherApprovers.length > 0}, agreed by {@render names(otherApprovers)}{/if}.
            </p>
        {/if}
    </div>
{/if}
