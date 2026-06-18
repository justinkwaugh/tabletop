<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { BuildingType } from '@tabletop/urbino'

    const session = getGameSession()
    const state = $derived(session.gameState)

    const buildingTypes = [BuildingType.House, BuildingType.Palace, BuildingType.Tower]
    const buildingLabel: Record<BuildingType, string> = {
        [BuildingType.House]: 'House (1pt)',
        [BuildingType.Palace]: 'Palace (2pt)',
        [BuildingType.Tower]: 'Tower (3pt)',
    }
    function myPlayerState() {
        return state.players.find((p) => p.playerId === session.myPlayer?.id)
    }

    function hasBuildingType(type: BuildingType): boolean {
        const p = myPlayerState()
        if (!p) return false
        if (type === BuildingType.House) return p.houses > 0
        if (type === BuildingType.Palace) return p.palaces > 0
        return p.towers > 0
    }

    function getStatusMessage(): string {
        if (!session.isMyTurn) return 'Waiting for opponent...'
        if (session.isPlacingArchitects) {
            return state.architectsPlaced === 0
                ? 'Place the first architect on any empty square'
                : 'Place the second architect on any empty square'
        }
        if (session.canChooseFirstPlayer) return 'Choose who takes the first turn'
        if (session.canUndoPlacement) return 'Building placed — select next action or undo'
        if (session.canPass) return 'No valid placement — you must skip your turn'
        if (session.selectedArchitectIndex !== undefined) {
            return 'Click a square to move the selected architect there'
        }
        if (session.selectedBuildingType) {
            return `Click a highlighted square to place a ${session.selectedBuildingType}`
        }
        if (session.isTakingTurn) {
            return 'Select a building type to place, or select an architect to reposition'
        }
        return ''
    }
</script>

<div class="flex flex-col gap-2 border-b border-[#c8bfaf] bg-[#f0ebe2] px-4 py-3">
    <div class="text-sm text-[#6b5040]">{getStatusMessage()}</div>

    {#if session.canChooseFirstPlayer}
        <div class="flex flex-wrap gap-2">
            {#each state.players as player}
                <button
                    class="rounded border border-[#6b3a2a] bg-white px-3 py-1.5 text-sm font-medium text-[#2c1810] transition-colors hover:bg-gray-100"
                    onclick={() => session.chooseFirstPlayer(player.playerId)}
                >
                    <PlayerName playerId={player.playerId} />
                    {player.playerId === session.myPlayer?.id ? 'go' : 'goes'} first
                </button>
            {/each}
        </div>
    {/if}

    {#if session.isMyTurn && !session.canChooseFirstPlayer}
        <div class="flex flex-wrap gap-2">
            {#if session.canPlaceBuilding}
                {#each buildingTypes as type}
                    {#if hasBuildingType(type)}
                        <button
                            class="flex items-center gap-1.5 rounded border border-[#6b3a2a] px-3 py-1.5 text-sm font-medium transition-colors"
                            class:bg-[#6b3a2a]={session.selectedBuildingType === type}
                            class:text-white={session.selectedBuildingType === type}
                            class:bg-white={session.selectedBuildingType !== type}
                            class:text-[#2c1810]={session.selectedBuildingType !== type}
                            onclick={() => session.selectBuildingType(type)}
                        >
                            <svg viewBox="0 0 20 20" width="19" height={type === BuildingType.Tower ? 20.9 : 19} preserveAspectRatio={type === BuildingType.Tower ? 'none' : 'xMidYMid meet'} fill={session.selectedBuildingType === type ? '#ffffff' : session.colors.getPlayerUiColor(session.myPlayer?.id)} stroke="#483737" stroke-width="1" stroke-linejoin="round">
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
                            {buildingLabel[type]}
                        </button>
                    {/if}
                {/each}
            {/if}

            {#if session.canRepositionArchitect}
                {#each [0, 1] as idx}
                    <button
                        class="rounded border border-[#c87941] px-3 py-1.5 text-sm font-medium transition-colors"
                        class:bg-[#c87941]={session.selectedArchitectIndex === idx}
                        class:text-white={session.selectedArchitectIndex === idx}
                        class:bg-white={session.selectedArchitectIndex !== idx}
                        class:text-[#2c1810]={session.selectedArchitectIndex !== idx}
                        onclick={() => session.selectArchitect(idx)}
                    >
                        ✦ Move Architect {idx + 1}
                    </button>
                {/each}
            {/if}

            {#if session.canPass}
                <button
                    class="rounded border border-gray-400 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                    onclick={() => session.pass()}
                >
                    Skip Turn
                </button>
            {/if}
        </div>
    {/if}
</div>
