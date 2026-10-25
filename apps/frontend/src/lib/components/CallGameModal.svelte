<script lang="ts">
    import { Button, Checkbox, Modal } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import {
        assertExists,
        findPlayerForUserId,
        requiredCallApprovals,
        votingPlayers,
        type GameState,
        type HydratedGameState
    } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { voteErrorMessage } from '$lib/utils/playerVoteText'

    let {
        open = $bindable(),
        session,
        concession
    }: {
        open: boolean
        session: GameSession<GameState, HydratedGameState>
        concession: boolean
    } = $props()

    const { gameService, authorizationService } = getAppContext()
    const colors = $derived(session.bridge.colors)

    const game = $derived(gameService.cachedGame(session.primaryGame.id) ?? session.primaryGame)
    const me = $derived.by(() => {
        const userId = authorizationService.getSessionUser()?.id
        return userId === undefined ? undefined : findPlayerForUserId(game, userId)
    })
    const opponent = $derived(game.players.find((player) => player.id !== me?.id))

    let winnerIds: string[] = $state([])
    let sending = $state(false)

    function toggleWinner(playerId: string) {
        winnerIds = winnerIds.includes(playerId)
            ? winnerIds.filter((id) => id !== playerId)
            : [...winnerIds, playerId]
    }

    function declaredWinnerIds(): string[] {
        if (!concession) return winnerIds
        assertExists(opponent, 'A concession has an opponent')
        return [opponent.id]
    }

    async function send() {
        sending = true
        try {
            await gameService.requestCall(game, declaredWinnerIds())
            open = false
            winnerIds = []
        } catch (error) {
            toast.error(voteErrorMessage(error))
        } finally {
            sending = false
        }
    }
</script>

{#snippet playerChip(playerId: string, name: string)}
    <span
        class="rounded px-1.5 font-semibold"
        style:background-color={$colors.getPlayerBgColorValue(playerId)}
        style:color={$colors.getPlayerTextColorValue(playerId)}>{name}</span
    >
{/snippet}

<Modal
    bind:open
    title={concession ? 'Concede this game?' : 'Call the game?'}
    size="xs"
    outsideclose
    autoclose={false}
>
    <div class="flex flex-col gap-4 text-sm text-gray-300">
        {#if concession}
            {@const winner = opponent}
            {#if winner}
                <p>{@render playerChip(winner.id, winner.name)} wins.</p>
            {/if}
            <p>The game ends for both of you straight away, and this can't be undone.</p>
        {:else}
            <p>
                Ask everyone to end the game now. It ends if {requiredCallApprovals(game.players)}
                of the {votingPlayers(game.players).length} players agree, you included.
            </p>
            <fieldset class="flex flex-col gap-2">
                <legend class="mb-2 font-medium text-white">Who wins?</legend>
                <Checkbox checked={winnerIds.length === 0} onchange={() => (winnerIds = [])}
                    >No winner</Checkbox
                >
                {#each game.players as player (player.id)}
                    <Checkbox
                        checked={winnerIds.includes(player.id)}
                        onchange={() => toggleWinner(player.id)}
                        >{@render playerChip(player.id, player.name)}</Checkbox
                    >
                {/each}
            </fieldset>
            <p class="text-gray-400">Play goes on while everyone votes.</p>
        {/if}
        <div class="flex justify-end gap-2 pt-2">
            <Button color="light" disabled={sending} onclick={() => (open = false)}>Cancel</Button>
            <Button color={concession ? 'red' : 'blue'} disabled={sending} onclick={send}
                >{concession ? 'Concede' : 'Ask everyone'}</Button
            >
        </div>
    </div>
</Modal>
