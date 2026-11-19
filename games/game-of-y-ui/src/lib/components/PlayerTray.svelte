<script lang="ts">
    import { Color } from '@tabletop/common'
    import type { HydratedYPlayerState } from '@tabletop/game-of-y'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { stoneBox, stoneLook } from '$lib/board/looks.js'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'

    let { playerState }: { playerState: HydratedYPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.includes(playerState.playerId)
    )
    const color = $derived(session.colorOf(playerState.playerId))
    const look = stoneBox()
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
        <svg
            class="stone"
            viewBox="{look.x} {look.y} {look.width} {look.height}"
            aria-hidden="true"
        >
            <image
                href={LOOK_URLS[stoneLook(color)]}
                x={look.x}
                y={look.y}
                width={look.width}
                height={look.height}
            ></image>
        </svg>
        <span class="caption">{color === Color.Black ? 'Black' : 'White'}</span>
    </div>
</div>

<style>
    .tray {
        border-radius: 12px;
        background: var(--y-panel);
        box-shadow:
            inset 0 0 0 1px var(--y-panel-edge),
            var(--y-panel-shadow);
        color: var(--y-ink);
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--y-target),
            var(--y-panel-shadow);
    }

    .body {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 12px;
    }

    .stone {
        width: 30px;
        height: 26px;
    }

    .caption {
        font-size: 14px;
        letter-spacing: 0.04em;
        color: var(--y-ink-quiet);
    }
</style>
