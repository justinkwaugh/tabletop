<script lang="ts">
    import { MARBLE_COLORS, SETUP_RULES, type HydratedZertzPlayerState } from '@tabletop/zertz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MarbleIcon from './MarbleIcon.svelte'

    let { playerState }: { playerState: HydratedZertzPlayerState } = $props()

    const session = getGameSession()

    const win = $derived(SETUP_RULES[session.gameState.setup].win)
    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(session.gameState.winningPlayerIds.includes(playerState.playerId))
    const name = $derived(session.getPlayerName(playerState.playerId))
    const setsTowardEach = $derived(
        Math.min(...MARBLE_COLORS.map((color) => playerState.captured[color]), win.eachColor)
    )
</script>

<div class="tray" class:active={isActive}>
    <div
        class="flex items-center justify-between rounded-t-[10px] px-3 py-1 font-semibold"
        style:background={session.colors.getPlayerBgColorValue(playerState.playerId)}
        style:color={session.colors.getPlayerTextColorValue(playerState.playerId)}
    >
        <span class="truncate text-[17px]">{name}</span>
        <span class="text-[13px] tracking-[0.12em] uppercase">
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    <div class="flex flex-col gap-[6px] px-3 py-2">
        {#each MARBLE_COLORS as color (color)}
            {@const target = win.singleColor[color]}
            {@const count = playerState.captured[color]}
            <div class="flex items-center gap-[5px]" aria-label="{count} of {target} {color}">
                {#each Array.from({ length: target }, (_, slot) => slot) as slot (slot)}
                    <MarbleIcon {color} size={20} faded={slot >= count} />
                {/each}
                {#if count > target}
                    <span class="text-[13px] text-(--zertz-ink-quiet)">+{count - target}</span>
                {/if}
            </div>
        {/each}
        <div class="mt-1 text-[12px] tracking-[0.06em] text-(--zertz-ink-quiet)">
            {win.eachColor} of each colour: {setsTowardEach}/{win.eachColor}
        </div>
    </div>
</div>

<style>
    .tray {
        border-radius: 12px;
        background: linear-gradient(
            180deg,
            var(--zertz-tray-top) 0%,
            var(--zertz-tray-bottom) 100%
        );
        box-shadow:
            inset 0 0 0 1px var(--zertz-panel-edge),
            0 3px 8px rgb(0 0 0 / 0.35);
        color: var(--zertz-ink);
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--zertz-place),
            0 3px 8px rgb(0 0 0 / 0.35);
    }
</style>
