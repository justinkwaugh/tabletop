<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const winningPlayerId = $derived.by(() => gameSession.gameState.winningPlayerIds[0])
    const winningPlayer = $derived.by(() => {
        if (!winningPlayerId) {
            return null
        }
        return gameSession.game.players.find((player) => player.id === winningPlayerId) ?? null
    })
    const winningPlayerBgColor = $derived.by(() => {
        if (!winningPlayer) {
            return ''
        }
        return gameSession.colors.getPlayerBgColor(winningPlayer.id)
    })
</script>

<div class="game-end-panel">
    <div class="game-end-card">
        {#if winningPlayer}
            <div class="game-end-title indonesia-font">Winner</div>
            <div class="game-end-winner-wrap">
                <svg
                    class="winner-name-ornament winner-name-ornament-left"
                    viewBox="0 0 64.8 23.43"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path
                        class="winner-name-ornament-fill"
                        d="M5.45,11.53C29.48,1.16,43.64,25.5,57.36,21c12.37-3.92,2.9-27.7-7.37-18.13,3.06-6.04,12.09-1.54,13.69,3.99,5.68,14.45-11.48,21.58-21.99,12.55-9.33-6.97-23.69-9.35-33.56-2.81-9.48,6.43-11.05.11-2.68-5.07Z"
                    ></path>
                    <path
                        class="winner-name-ornament-fill"
                        d="M48.78,13.23c-5.03-6.36,6.16-11.99,9.7-5.28,3.05,4.29.05,10.92-5.24,11.2-4,.32-7.46-2.76-10.44-4.41-10.48-6.13-21.47-9.45-32.85-7.56C32.18.27,49.54,23.21,56.49,16.35c4.71-3.38-1.35-12.5-5.23-7.34-.46.85.32,1.96,1.02,2.19.95.22,1.79-.89,2.51-1.25,3.51,2.4-3.23,7.18-6.01,3.28Z"
                    ></path>
                    <path
                        class="winner-name-ornament-fill"
                        d="M50.62,10.15c-1.29,3.2,3.76,5.14,4.96,1.91,1.29-3.2-3.76-5.14-4.96-1.91Z"
                    ></path>
                </svg>
                <div class="winner-name-wrap">
                    <span
                        class="winner-name-wash winner-name-wash-left {winningPlayerBgColor}"
                        aria-hidden="true"
                    ></span>
                    <span
                        class="winner-name-wash winner-name-wash-right {winningPlayerBgColor}"
                        aria-hidden="true"
                    ></span>
                    <div class="winner-name-text">
                        <span class="winner-name-core">{winningPlayer.name}</span>
                    </div>
                </div>
                <svg
                    class="winner-name-ornament winner-name-ornament-right"
                    viewBox="0 0 64.8 23.43"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path
                        class="winner-name-ornament-fill"
                        d="M5.45,11.53C29.48,1.16,43.64,25.5,57.36,21c12.37-3.92,2.9-27.7-7.37-18.13,3.06-6.04,12.09-1.54,13.69,3.99,5.68,14.45-11.48,21.58-21.99,12.55-9.33-6.97-23.69-9.35-33.56-2.81-9.48,6.43-11.05.11-2.68-5.07Z"
                    ></path>
                    <path
                        class="winner-name-ornament-fill"
                        d="M48.78,13.23c-5.03-6.36,6.16-11.99,9.7-5.28,3.05,4.29.05,10.92-5.24,11.2-4,.32-7.46-2.76-10.44-4.41-10.48-6.13-21.47-9.45-32.85-7.56C32.18.27,49.54,23.21,56.49,16.35c4.71-3.38-1.35-12.5-5.23-7.34-.46.85.32,1.96,1.02,2.19.95.22,1.79-.89,2.51-1.25,3.51,2.4-3.23,7.18-6.01,3.28Z"
                    ></path>
                    <path
                        class="winner-name-ornament-fill"
                        d="M50.62,10.15c-1.29,3.2,3.76,5.14,4.96,1.91,1.29-3.2-3.76-5.14-4.96-1.91Z"
                    ></path>
                </svg>
            </div>
        {:else}
            <div class="game-end-title indonesia-font">Draw</div>
        {/if}
    </div>
</div>

<style>
    .game-end-panel {
        background: #f7f3ef;
        border-bottom: 2px solid #7a5d3f;
        padding: 16px 16px 14px;
        color: #5e3f27;
    }

    .game-end-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 92px;
    }

    .game-end-title {
        font-size: 40px;
        line-height: 0.95;
        color: rgba(94, 63, 39, 0.95);
    }

    .game-end-winner-wrap {
        --game-end-bg-color: #f7f3ef;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
    }

    .winner-name-wrap {
        position: relative;
        text-align: center;
        padding: 3px 10px 2px;
        border-radius: 3px;
        overflow: hidden;
    }

    .winner-name-wash {
        position: absolute;
        top: 1px;
        bottom: 1px;
        opacity: 0.8;
        pointer-events: none;
    }

    .winner-name-wash-left {
        left: 4px;
        right: 4px;
        border-radius: 3px;
        -webkit-mask-image: linear-gradient(
            90deg,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0.32) 24%,
            rgba(0, 0, 0, 0.92) 58%,
            rgba(0, 0, 0, 1) 74%
        );
        mask-image: linear-gradient(
            90deg,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0.32) 24%,
            rgba(0, 0, 0, 0.92) 58%,
            rgba(0, 0, 0, 1) 74%
        );
    }

    .winner-name-wash-right {
        left: 4px;
        right: 4px;
        border-radius: 3px;
        -webkit-mask-image: linear-gradient(
            90deg,
            rgba(0, 0, 0, 1) 26%,
            rgba(0, 0, 0, 0.92) 42%,
            rgba(0, 0, 0, 0.32) 76%,
            rgba(0, 0, 0, 0) 100%
        );
        mask-image: linear-gradient(
            90deg,
            rgba(0, 0, 0, 1) 26%,
            rgba(0, 0, 0, 0.92) 42%,
            rgba(0, 0, 0, 0.32) 76%,
            rgba(0, 0, 0, 0) 100%
        );
    }

    .winner-name-text {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--game-end-bg-color);
    }

    .winner-name-core {
        font-size: 19px;
        line-height: 1;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .winner-name-ornament {
        width: 30px;
        height: 22.5px;
        flex: 0 0 auto;
        color: rgba(122, 93, 63, 0.5);
        transform: translateY(-0.5px);
    }

    .winner-name-ornament-right {
        transform: translateY(-0.5px) scaleX(-1);
    }

    .winner-name-ornament-fill {
        fill: currentColor;
    }
</style>
