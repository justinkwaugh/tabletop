<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState, BuildingType, computeDistrictScores } from '@tabletop/urbino'

    const session = getGameSession()
    const state = $derived(session.gameState)

    const liveScores = $derived(computeDistrictScores(state.board, state.monumentsVariant))

    function isActivePlayer(playerId: string): boolean {
        return state.activePlayerIds.includes(playerId)
    }
</script>

<div class="flex flex-col gap-3 p-3">
    {#each state.players as player}
        {@const uiColor = session.colors.getPlayerUiColor(player.playerId)}
        <div
            class="rounded-lg border-2 p-3 transition-all"
            style:border-color={isActivePlayer(player.playerId) ? uiColor : 'transparent'}
            style:background-color={isActivePlayer(player.playerId) ? `${uiColor}22` : 'transparent'}
        >
            <div class="mb-2 flex items-center gap-2">
                <div
                    class="h-4 w-4 rounded-full border border-gray-400"
                    style:background-color={uiColor}
                ></div>
                <PlayerName playerId={player.playerId} additionalClasses="font-semibold" />
                {#if isActivePlayer(player.playerId)}
                    <span class="ml-auto text-xs text-[#6b3a2a]">Active</span>
                {/if}
            </div>
            <div class="mb-2 text-xl font-bold text-[#2c1810]">{liveScores.get(player.playerId) ?? 0} pts</div>
            <div class="flex gap-3 text-sm">
                {#each [{ type: BuildingType.House, count: player.houses, label: 'Houses' }, { type: BuildingType.Palace, count: player.palaces, label: 'Palaces' }, { type: BuildingType.Tower, count: player.towers, label: 'Towers' }] as { type, count, label }}
                    <span class="flex items-center gap-1" style:color={uiColor} title="{label}: {count}">
                        <svg viewBox="0 0 20 20" width="17" height="17" fill={uiColor} stroke="#483737" stroke-width="1" stroke-linejoin="round">
                            {#if type === BuildingType.House}
                                <path d="M 2.5,4.75 L 17.5,4.75 L 19,9.25 L 1,9.25 Z" />
                                <path d="M 1,9.25 L 19,9.25 L 19,15.25 L 1,15.25 Z" />
                            {:else if type === BuildingType.Palace}
                                <path d="M 1,11.5 L 19,11.5 L 19,17.5 L 1,17.5 Z" />
                                <path d="M 10,2.5 L 19,11.5 L 1,11.5 Z" />
                                <path d="M 2.5,7 L 10,2.25 L 10,5.5 L 1,11.5 Z" />
                                <path d="M 10,2.25 L 17.5,7 L 19,11.5 L 10,5.5 Z" />
                            {:else}
                                <path d="M 2.3,8.7 L 17.7,8.7 L 17.7,19 L 2.3,19 Z" />
                                <path d="M 10,4.1 L 17.2,8.7 L 17.2,10.3 L 2.8,10.3 L 2.8,8.7 Z" />
                                <path d="M 3.6,4.9 L 10,1 L 10,3.6 L 2.3,8.7 Z" />
                                <path d="M 10,1 L 16.4,4.9 L 17.2,8.7 L 10,3.6 Z" />
                            {/if}
                        </svg>
                        {count}
                    </span>
                {/each}
            </div>
        </div>
    {/each}
</div>
