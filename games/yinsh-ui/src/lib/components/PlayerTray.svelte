<script lang="ts">
    import type { HydratedYinshPlayerState } from '@tabletop/yinsh'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { removedRingSeed } from '$lib/board/ringSeeds.js'
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
            filled: index < playerState.ringsRemoved,
            seed: removedRingSeed(playerState, index)
        }))
    )
</script>

<div class="tray" class:active={isActive}>
    <!-- The player's colour shows as one of their rings rather than a band of it across the card. -->
    <div class="flex items-center gap-2 px-3 pt-2 font-semibold">
        <RingIcon {tone} seedKey="tray-name-{playerState.playerId}" size={22} />
        <span class="truncate text-[17px]">{session.getPlayerName(playerState.playerId)}</span>
        <span
            class="ms-auto text-[13px] tracking-[0.12em] whitespace-nowrap text-(--yinsh-ink-quiet) uppercase"
        >
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    <div class="body">
        <div class="slots" title="Rings removed ({playerState.ringsRemoved} of {slots.length})">
            {#each slots as slot (slot.index)}
                <RingIcon {tone} seedKey={slot.seed} size={40} filled={slot.filled} />
            {/each}
        </div>
    </div>
</div>

<style>
    /* White like the action card, so black rings stand out as well as white ones. */
    .tray {
        border-radius: 12px;
        background: var(--yinsh-panel);
        box-shadow:
            inset 0 0 0 1px var(--yinsh-panel-edge),
            var(--yinsh-panel-shadow);
        color: var(--yinsh-ink);
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--yinsh-target),
            var(--yinsh-panel-shadow);
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
