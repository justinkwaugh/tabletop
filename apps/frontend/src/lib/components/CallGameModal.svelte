<script lang="ts">
    import { Modal, Radio } from 'flowbite-svelte'
    import { FlagSolid, UsersGroupSolid } from 'flowbite-svelte-icons'
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

    // Radio values are strings, so "No winner" is the empty one
    const noWinner = ''
    let winnerId: string = $state(noWinner)
    let sending = $state(false)

    function declaredWinnerId(): string | undefined {
        if (!concession) return winnerId === noWinner ? undefined : winnerId
        assertExists(opponent, 'A concession has an opponent')
        return opponent.id
    }

    async function send() {
        sending = true
        try {
            await gameService.requestCall(game, declaredWinnerId())
            open = false
            winnerId = noWinner
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

<Modal bind:open size="xs" outsideclose autoclose={false}>
    <div class="relative p-4 text-center bg-transparent rounded-lg sm:p-5">
        {#if concession}
            <FlagSolid class="text-gray-400 dark:text-gray-500 w-11 h-11 mb-3.5 mx-auto" />
            <p class="mb-4 text-gray-500 dark:text-gray-300">
                Are you sure you want to concede this game?<br />
                <span class="text-yellow-300 font-bold">This cannot be undone.</span>
            </p>
        {:else}
            <UsersGroupSolid class="text-gray-400 dark:text-gray-500 w-11 h-11 mb-3.5 mx-auto" />
            <p class="mb-4 text-gray-500 dark:text-gray-300">
                Ask everyone to end the game now?<br />
                It ends if {requiredCallApprovals(game.players)} of the
                {votingPlayers(game.players).length} players agree, you included.
            </p>
            <fieldset class="mb-4 inline-flex flex-col gap-2 text-left">
                <legend class="mb-2 w-full text-center font-medium text-gray-200">Who wins?</legend>
                <Radio name="call-winner" value={noWinner} bind:group={winnerId}>No winner</Radio>
                {#each game.players as player (player.id)}
                    <Radio name="call-winner" value={player.id} bind:group={winnerId}
                        >{@render playerChip(player.id, player.name)}</Radio
                    >
                {/each}
            </fieldset>
            <p class="mb-4 text-sm text-gray-400">Play goes on while everyone votes.</p>
        {/if}
        <div class="flex justify-center items-center space-x-4">
            <button
                type="button"
                disabled={sending}
                onclick={() => (open = false)}
                class="py-2 px-3 text-sm font-medium text-gray-500 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600"
            >
                No, cancel
            </button>
            {#if concession}
                <button
                    type="button"
                    disabled={sending}
                    onclick={send}
                    class="py-2 px-3 text-sm font-medium text-center text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 dark:bg-red-700 dark:hover:bg-red-600 dark:focus:ring-red-900"
                >
                    Yes, I concede
                </button>
            {:else}
                <button
                    type="button"
                    disabled={sending}
                    onclick={send}
                    class="py-2 px-3 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                >
                    Ask everyone
                </button>
            {/if}
        </div>
    </div>
</Modal>
