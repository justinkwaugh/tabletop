<script lang="ts">
    import type { HydratedYinshPlayerState } from '@tabletop/yinsh'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RingIcon from './RingIcon.svelte'

    let { playerState }: { playerState: HydratedYinshPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.includes(playerState.playerId)
    )
    const tone = $derived(session.toneOfPlayer(playerState.playerId))
    const slots = $derived(
        Array.from({ length: session.gameState.ringsToWin }, (_, index) => ({
            index,
            filled: index < playerState.ringsRemoved
        }))
    )
</script>

<div class="tray" class:active={isActive}>
    <div
        class="flex items-center gap-2 rounded-t-[10px] px-3 py-1 font-semibold"
        style:background={session.colors.getPlayerBgColorValue(playerState.playerId)}
        style:color={session.colors.getPlayerTextColorValue(playerState.playerId)}
    >
        <span class="truncate text-[17px]">{session.getPlayerName(playerState.playerId)}</span>
        <span class="ms-auto text-[13px] tracking-[0.12em] whitespace-nowrap uppercase">
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    <div class="body">
        <div class="slots" title="Rings removed ({playerState.ringsRemoved} of {slots.length})">
            {#each slots as slot (slot.index)}
                <RingIcon
                    {tone}
                    seedKey="tray-{playerState.playerId}-{slot.index}"
                    size={40}
                    filled={slot.filled}
                />
            {/each}
        </div>
    </div>
</div>

<style>
    /* Light enough for black rings to stand out as well as white ones. */
    .tray {
        --ring: 1px;
        border-radius: 12px;
        background: #c9d6e8;
        box-shadow:
            inset 0 0 0 var(--ring) #8fa5c4,
            0 3px 8px rgb(0 0 0 / 0.3);
        color: #0d1626;
        overflow: hidden;
    }

    .tray.active {
        --ring: 2px;
        box-shadow:
            inset 0 0 0 var(--ring) var(--yinsh-target),
            0 3px 8px rgb(0 0 0 / 0.35);
    }

    .body {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
    }

    .slots {
        display: flex;
        gap: 6px;
    }
</style>
