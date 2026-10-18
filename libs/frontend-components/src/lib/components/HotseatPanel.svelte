<script lang="ts">
    import { Dropdown, DropdownGroup, DropdownItem } from 'flowbite-svelte'
    import { ChevronDownOutline } from 'flowbite-svelte-icons'
    import { nanoid } from 'nanoid'
    import { getGameSession } from '$lib/model/gameSessionContext.js'
    import ActingPlayerControl from './ActingPlayerControl.svelte'

    let gameSession = getGameSession()
    const { myPlayer, colors } = gameSession.bridge
    let hotseatPlayerBgColor = $derived($colors.getPlayerBgColorValue($myPlayer?.id))
    let hotseatPlayerTextColor = $derived($colors.getPlayerTextColorValue($myPlayer?.id))
    let showActingPlayerControl = $derived(
        gameSession.isActingAdmin && !gameSession.isViewingAsNonActivePlayer
    )
    // Any Player who is not acting may be viewed as; an older UI Artifact offers only the first.
    let otherWaitingPlayers = $derived(
        (gameSession.nonActivePlayers ?? []).filter((player) => player.id !== $myPlayer?.id)
    )
    const waitingTriggerId = `waiting-player-${nanoid()}`
    let waitingDropdownOpen = $state(false)

    function viewAs(playerId: string) {
        gameSession.viewAsNonActivePlayer?.(playerId)
        waitingDropdownOpen = false
    }
</script>

{#if $myPlayer || showActingPlayerControl}
    <div
        class="shrink-0 grow-0 p-2 h-[44px] flex flex-row justify-center items-center text-lg"
        style:background-color={hotseatPlayerBgColor}
        style:color={hotseatPlayerTextColor}
    >
        {#if gameSession.isViewingAsNonActivePlayer && $myPlayer}
            Viewing as&nbsp;{#if otherWaitingPlayers.length > 0 && gameSession.viewAsNonActivePlayer}
                <button id={waitingTriggerId} type="button" class="inline cursor-pointer">
                    <span class="font-bold">{$myPlayer.name}</span><ChevronDownOutline
                        class="inline h-4 w-4"
                    />
                </button>
                <Dropdown
                    bind:isOpen={waitingDropdownOpen}
                    triggeredBy={`#${waitingTriggerId}`}
                    placement="bottom"
                >
                    <DropdownGroup class="py-1">
                        {#each otherWaitingPlayers as player (player.id)}
                            <DropdownItem
                                onclick={() => viewAs(player.id)}
                                class="w-full text-left font-medium py-2 px-4 text-xs hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                                {player.name}
                            </DropdownItem>
                        {/each}
                    </DropdownGroup>
                </Dropdown>
            {:else}
                <span class="font-bold">{$myPlayer.name}</span>
            {/if}&nbsp;- Waiting for active player
        {:else if showActingPlayerControl}
            <ActingPlayerControl />
        {:else if $myPlayer}
            <span class="font-bold">{$myPlayer.name}</span>&nbsp;- It's your turn
        {/if}
    </div>
{/if}
