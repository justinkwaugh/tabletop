<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()

    const activePlayerId = $derived(session.gameState.activePlayerIds[0])
    const canUndo = $derived(session.hasLocalSelection || !!session.undoableAction)
    const crest = $derived(
        activePlayerId
            ? `${session.rooftopSprite({ coords: { x: 0, y: 0 }, playerId: activePlayerId })}-0`
            : undefined
    )
</script>

<div class="turn">
    <div class="who">
        {#if session.isViewingHistory}
            <div class="said" in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>History</div>
        {:else if session.gameState.result}
            <div class="said" in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>
                End of game
            </div>
        {:else}
            <div class="line" in:fade={{ duration: 200 }} out:fade={{ duration: 120 }}>
                {#if crest}
                    <PieceIcon name={crest} height={24} maxWidth={30} />
                {/if}
                {#if session.isMyTurn}
                    <span>Your turn</span>
                {:else}
                    <span>
                        <PlayerName
                            playerId={activePlayerId}
                            possessive={true}
                            backgroundOpacity={0}
                            additionalClasses="!p-0 !text-[#2a1609]"
                        />
                        turn
                    </span>
                {/if}
            </div>
        {/if}
    </div>
    {#if canUndo}
        <button type="button" class="undo" onclick={() => session.undo()}>Undo</button>
    {/if}
</div>

<style>
    .turn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 46px;
        padding: 0 14px;
        border-bottom: 2px solid #7f5228;
        color: #2a1609;
        font:
            700 23px/1 'Medina Display',
            Georgia,
            serif;
    }

    .who {
        display: grid;
    }

    .who > * {
        grid-area: 1 / 1;
    }

    .line {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .said,
    .line span {
        padding-top: 6px;
    }

    .undo {
        padding: 7px 14px 4px;
        border: 2px solid #2a1609;
        border-radius: 5px;
        background: transparent;
        color: #2a1609;
        font:
            700 16px/1 'Medina Display',
            Georgia,
            serif;
        cursor: pointer;
    }

    .undo:hover {
        background: #2a1609;
        color: #c8935a;
    }

    @media (max-width: 639px) {
        .turn {
            height: 36px;
            padding: 0 10px;
            font-size: 18px;
        }

        .undo {
            padding: 5px 10px 3px;
            font-size: 14px;
        }
    }
</style>
