<script lang="ts">
    import { Color } from '@tabletop/common'
    import { EDGES_OF, Edge, type HydratedHexPlayerState } from '@tabletop/hex'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { playerState }: { playerState: HydratedHexPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.includes(playerState.playerId)
    )
    const color = $derived(session.colorOf(playerState.playerId))

    // A small board with the player's two edges in their colour, turned as the board is.
    const SIDES: Record<Edge, string> = {
        [Edge.Top]: 'M2 2 L22 2',
        [Edge.Right]: 'M22 2 L32 18',
        [Edge.Bottom]: 'M32 18 L12 18',
        [Edge.Left]: 'M12 18 L2 2'
    }
</script>

<div class="tray" class:active={isActive}>
    <div class="hex-side {color} flex items-center gap-2 rounded-t-[10px] px-3 py-1 font-semibold">
        <span class="truncate text-[17px]">{session.getPlayerName(playerState.playerId)}</span>
        <span class="ms-auto text-[13px] tracking-[0.12em] whitespace-nowrap uppercase">
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    <div class="body">
        <svg
            class="edges"
            viewBox={session.upright ? '-1 -33 20 34' : '-1 -1 34 20'}
            aria-hidden="true"
        >
            <g transform={session.upright ? 'rotate(-90)' : ''}>
                <path d="M2 2 L22 2 L32 18 L12 18 Z" class="ground"></path>
                {#each Object.values(Edge) as edge (edge)}
                    {#if EDGES_OF[color].includes(edge)}
                        <path d={SIDES[edge]} class="side-outline" class:blue={color === Color.Blue}
                        ></path>
                    {/if}
                    <path
                        d={SIDES[edge]}
                        class="side"
                        class:own={EDGES_OF[color].includes(edge)}
                        class:blue={color === Color.Blue}
                    ></path>
                {/each}
            </g>
        </svg>
        <span class="caption capitalize">{session.colorName(color)}</span>
    </div>
</div>

<style>
    .tray {
        border-radius: 12px;
        background: var(--hex-panel);
        box-shadow:
            inset 0 0 0 1px var(--hex-panel-edge),
            var(--hex-panel-shadow);
        color: var(--hex-ink);
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--hex-target),
            var(--hex-panel-shadow);
    }

    .body {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 12px;
    }

    .edges {
        height: 26px;
        width: auto;
        overflow: visible;
    }

    .ground {
        fill: var(--hex-cell);
        stroke: var(--hex-line);
        stroke-width: 0.8;
        stroke-linejoin: round;
    }

    .side {
        fill: none;
        stroke: none;
        stroke-linecap: round;
    }

    .side.own {
        stroke: var(--hex-red);
        stroke-width: 3.2;
    }

    .side.own.blue {
        stroke: var(--hex-blue);
    }

    /* Under an edge that would vanish against the card, such as white in black and white. */
    .side-outline {
        fill: none;
        stroke: none;
        stroke-width: 5.4;
        stroke-linecap: round;
    }

    .side-outline.blue {
        stroke: var(--hex-blue-outline);
    }

    .caption {
        font-size: 14px;
        letter-spacing: 0.04em;
        color: var(--hex-ink-quiet);
    }
</style>
