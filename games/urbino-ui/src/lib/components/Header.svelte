<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { BuildingStyle, BuildingType } from '@tabletop/urbino'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)

    const activePlayerId = $derived(state.activePlayerIds[0])
    const canUndo = $derived(
        session.canUndoPlacement ||
            session.canUndoReposition ||
            session.canUndoArchitectPlacement ||
            session.canUndoChooseFirstPlayer
    )
</script>

<div
    class="urbino-plank urbino-display flex h-[46px] items-center justify-between border-b-2 border-(--maple-edge) px-4 tracking-[0.12em] max-sm:h-[38px] max-sm:px-3"
>
    <div class="header-grid grid text-[19px] max-sm:text-[15px]">
        {#if session.isViewingHistory}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>HISTORY</div>
        {:else if state.result}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>END OF GAME</div>
        {:else}
            <div in:fade={{ duration: 200 }} out:fade={{ duration: 120 }} class="flex items-center gap-2.5">
                {#if activePlayerId}
                    <PieceIcon
                        buildingType={BuildingType.Tower}
                        color={session.colors.getPlayerUiColor(activePlayerId)}
                        buildingStyle={BuildingStyle.TowerRoofs}
                        size={22}
                    />
                {/if}
                {#if session.isMyTurn}
                    <span>YOUR TURN</span>
                {:else}
                    <span class="inline-flex gap-x-1.5">
                        <PlayerName
                            playerId={activePlayerId}
                            capitalization="uppercase"
                            possessive={true}
                            backgroundOpacity={0}
                            additionalClasses="tracking-[0.12em] !text-(--ink) !p-0"
                        />
                        <span>TURN</span>
                    </span>
                {/if}
            </div>
        {/if}
    </div>

    <div class="header-grid grid text-[17px] max-sm:text-[14px]">
        {#if canUndo}
            <button
                type="button"
                onclick={() => session.undo()}
                class="rounded-md px-2 py-0.5 tracking-[0.12em] text-(--ink) hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-(--gold-deep)/50 focus-visible:outline-none"
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 120 }}
            >
                UNDO
            </button>
        {/if}
    </div>
</div>

<style>
    .header-grid > * {
        grid-area: 1 / 1;
    }
</style>
