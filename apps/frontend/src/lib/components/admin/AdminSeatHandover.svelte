<script lang="ts">
    import { Button, Select } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import { SeatHandoverBlock, seatHandoverBlock, type Game } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { UsernameSuggestions } from '$lib/utils/usernameSuggestions.svelte'

    let { game, onhandover }: { game: Game; onhandover: (game: Game) => void } = $props()
    const { api } = getAppContext()

    const blockedReasons: Record<SeatHandoverBlock, string> = {
        [SeatHandoverBlock.Tournament]: 'Replace tournament players from the tournament page.',
        [SeatHandoverBlock.Hotseat]: 'Hotseat games have no accounts to hand over.',
        [SeatHandoverBlock.NotInProgress]: 'Only games in progress can have seats handed over.'
    }

    let seats = $derived(game.players.filter((player) => player.userId))
    let block = $derived(seatHandoverBlock(game))
    let playerId = $state('')
    let seat = $derived(seats.find((player) => player.id === playerId))
    let username = $state('')
    let busy = $state(false)
    const suggestions = new UsernameSuggestions((text) => api.searchUsernames(text))

    async function handOver(event: SubmitEvent) {
        event.preventDefault()
        const newHolder = username.trim()
        if (!seat || !newHolder || busy) return
        if (!window.confirm(`Give ${seat.name}'s seat to ${newHolder}?`)) return
        busy = true
        try {
            const updated = await api.handOverSeatAsAdministrator(game.id, seat.id, newHolder)
            toast.success(`${newHolder} has taken over ${seat.name}'s seat.`)
            playerId = ''
            username = ''
            suggestions.clear()
            onhandover(updated)
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'The seat could not be handed over.'
            )
        } finally {
            busy = false
        }
    }
</script>

<section class="flex flex-col gap-2 py-4" aria-label="Hand over a seat">
    <h2 class="text-lg font-semibold">Players</h2>
    <ul class="text-sm">
        {#each game.players as player (player.id)}
            <li>
                {player.name}{player.userId && player.userId === game.ownerId ? ' (owner)' : ''}
            </li>
        {/each}
    </ul>
    {#if block}
        <p class="text-sm text-gray-500 dark:text-gray-400">{blockedReasons[block]}</p>
    {:else}
        <p class="max-w-xl text-xs text-gray-500 dark:text-gray-400">
            The new player takes over the seat as it stands, including its hidden information and
            game ownership. Any open vote is cancelled, both players are notified, the table is told
            in chat, and open game pages reload.
        </p>
        <form class="flex max-w-xl flex-row flex-wrap items-end gap-2" onsubmit={handOver}>
            <label class="flex flex-col gap-1 text-xs"
                >Seat
                <Select size="sm" class="w-48" bind:value={playerId} disabled={busy} required>
                    <option value="">Choose a player</option>
                    {#each seats as player (player.id)}
                        <option value={player.id}>{player.name}</option>
                    {/each}
                </Select>
            </label>
            <label class="flex flex-col gap-1 text-xs"
                >New player
                <input
                    class="block w-48 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                    list="admin-seat-handover-matches"
                    autocomplete="off"
                    placeholder="Username"
                    bind:value={username}
                    oninput={() =>
                        void suggestions.suggest(
                            username,
                            seats.map((player) => player.name)
                        )}
                    required
                    disabled={busy}
                />
            </label>
            <datalist id="admin-seat-handover-matches">
                {#each suggestions.matches as match (match)}<option value={match}></option>{/each}
            </datalist>
            <Button type="submit" size="sm" disabled={busy || !seat || !username.trim()}
                >Hand over</Button
            >
        </form>
    {/if}
</section>
