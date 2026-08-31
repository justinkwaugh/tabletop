<script lang="ts">
    import { Dropdown, DropdownGroup, DropdownItem } from 'flowbite-svelte'
    import { ChevronDownOutline } from 'flowbite-svelte-icons'
    import { nanoid } from 'nanoid'
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let gameSession = getGameSession()
    const { myPlayer, activePlayers } = gameSession.bridge
    const triggerId = `acting-player-${nanoid()}`
    let dropdownOpen = $state(false)

    let actingPlayer = $derived(
        $activePlayers.find((player) => player.id === $myPlayer?.id)
    )
    let otherActivePlayers = $derived(
        $activePlayers.filter((player) => player.id !== actingPlayer?.id)
    )

    function setActingPlayer(playerId: string) {
        gameSession.bridge.setChosenAdminPlayerId(playerId)
        dropdownOpen = false
    }
</script>

<span>Acting as&nbsp;</span>
{#if $activePlayers.length > 1}
    <button id={triggerId} type="button" class="inline cursor-pointer">
        <span class="font-bold">{actingPlayer?.name ?? 'Choose player'}</span><ChevronDownOutline
            class="inline h-4 w-4"
        />
    </button>
    <Dropdown bind:isOpen={dropdownOpen} triggeredBy={`#${triggerId}`} placement="bottom">
        <DropdownGroup class="py-1">
            {#each otherActivePlayers as player}
                <DropdownItem
                    onclick={() => setActingPlayer(player.id)}
                    class="w-full text-left font-medium py-2 px-4 text-xs hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                    {player.name}
                </DropdownItem>
            {/each}
        </DropdownGroup>
    </Dropdown>
{:else if actingPlayer}
    <span class="font-bold">{actingPlayer.name}</span>
{:else}
    <span class="font-bold">No active player</span>
{/if}
