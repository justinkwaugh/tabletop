<script lang="ts">
import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { type GameAction, range } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import {
        Barrier,
        BarrierDirection,
        Cube,
        isBarrier,
        isCube,
        isEndAuction,
        isMayor,
        isPlaceBarrier,
        isPlaceCube,
        isPlaceMayor,
        isPlaceRoof,
        isRoof,
        isStartAuction,
        Roof
    } from '@tabletop/estates'

    let { action }: { action: GameAction } = $props()

    let gameSession = getGameSession() as EstatesGameSession

    function playerIdForAction(action: GameAction): string | undefined {
        if (!action) {
            return undefined
        }

        if (action.playerId) {
            return action.playerId
        }

        if (isEndAuction(action)) {
            return action.metadata?.auction?.winnerId ?? action.metadata?.auction?.auctioneerId
        }

        return undefined
    }
</script>

{#snippet cube(cube: Cube)}
    <span
        class="inline-flex justify-center items-center text-[#EEEEEE] w-6 h-6 font-bold text-xl select-none rounded-sm {gameSession.colors.getBgColor(
            gameSession.getCompanyColor(cube.company)
        )}"
    >
        {cube.value}
    </span>
{/snippet}

{#snippet roof(roof: Roof)}
    <span
        class="inline-flex justify-center items-center text-[#DDDDDD] w-6 h-6 font-bold text-xl select-none rounded-sm bg-[#222222]"
    >
        {roof.value}
    </span>
{/snippet}

{#snippet mayor()}
    <span
        class="inline-flex justify-center items-center w-6 h-6 font-bold text-xl select-none rounded-sm bg-gray-300 align-middle"
    >
        <svg
            width="20px"
            height="20px"
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            aria-hidden="true"
            role="img"
            class="iconify iconify--emojione-monotone"
            preserveAspectRatio="xMidYMid meet"
            ><path
                d="M61.338 41.881c-1.663-3.873-5.663-4.015-11.069-3.241c.041-9.028 1.562-17.65 4.452-27.072c1.344-3.374-8.67-9.501-22.72-9.567c-14.05.066-24.065 6.192-22.721 9.566c2.873 9.365 4.384 18.047 4.438 27.07c-5.399-.771-9.394-.627-11.057 3.243C-.961 49.077 10.487 62 32 62c21.514 0 32.961-12.923 29.338-20.119m-48.856 5.962s1.357-4.745 1.14-7.254c11.804 10.624 24.954 10.624 36.757 0c.045 2.56 1.139 7.254 1.139 7.254c-11.62 11.057-27.415 11.057-39.036 0"
                fill="#000000"
            ></path></svg
        >
    </span>
{/snippet}

{#snippet barrier(barrier: Barrier)}
    <span
        class="inline-flex justify-around items-start rounded-sm w-6 h-6 font-bold text-xl px-1 select-none bg-gray-500"
    >
        {#each range(0, barrier.value) as value, i (value)}
            <span class="w-1 bg-[#DDDDDD] h-4"></span>
        {/each}
    </span>
{/snippet}

<p class="text-left font-normal">
    {#if playerIdForAction(action)}
        <span class="text-gray-200">
            <PlayerName playerId={playerIdForAction(action)} />
        </span>
    {/if}
    {#if isStartAuction(action)}
        put
        {#if isCube(action.piece)}
            {@render cube(action.piece)}
        {:else if isRoof(action.piece)}
            {@render roof(action.piece)}
        {:else if isMayor(action.piece)}
            {@render mayor()}
        {:else if isBarrier(action.piece)}
            {@render barrier(action.piece)}
        {/if}
        up for auction
    {:else if isPlaceCube(action)}
        placed {@render cube(action.cube)} on the board
    {:else if isPlaceRoof(action)}
        placed {@render roof(action.roof)} on the board
    {:else if isPlaceMayor(action)}
        placed {@render mayor()} on the board
    {:else if isPlaceBarrier(action)}
        placed {@render barrier(action.barrier)} on the board {action.barrier.direction ===
        BarrierDirection.Lengthen
            ? 'lengthening'
            : 'shortening'} the row
    {:else}
        {getDescriptionForAction(action)}
    {/if}
</p>
