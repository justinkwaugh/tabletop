<script lang="ts">
    import GoalRows from '$lib/components/GoalRows.svelte'
    import { goalBoard } from '$lib/model/goalBoard.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Mounted beside the open seat, outside the board's transform; it shows the displayed state.
    let gameSession = getGameSession()
    let goalsView = $derived(gameSession.goalsView)
</script>

<svelte:window
    onkeydown={(e) => {
        if (e.key === 'Escape' && goalsView.open) goalsView.close()
    }}
/>

{#if goalsView.open}
    <div class="goals-layer" role="presentation" onpointerdown={() => goalsView.close()}>
        <div
            class="sheet"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            aria-label="Goals"
            onpointerdown={(e) => e.stopPropagation()}
        >
            <header class="head">
                <h2>Goals</h2>
                <button
                    type="button"
                    class="close"
                    onclick={() => goalsView.close()}
                    aria-label="Close">×</button
                >
            </header>
            <GoalRows board={goalBoard(gameSession.gameState)} scale={1.15} />
        </div>
    </div>
{/if}

<style>
    .goals-layer {
        position: fixed;
        inset: 0;
        z-index: 55;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.45);
        padding: calc(12px + env(safe-area-inset-top, 0px))
            calc(12px + env(safe-area-inset-right, 0px))
            calc(12px + env(safe-area-inset-bottom, 0px))
            calc(12px + env(safe-area-inset-left, 0px));
    }
    .sheet {
        max-width: 640px;
        max-height: calc(
            100dvh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
        );
        overflow: auto;
        overscroll-behavior: contain;
        width: 100%;
        border-radius: 12px;
        background: rgba(20, 17, 15, 0.97);
        border: 1px solid rgba(251, 191, 36, 0.45);
        color: #e7e5e4;
        padding: 12px 18px 18px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
    }
    .head {
        display: flex;
        align-items: baseline;
        margin-bottom: 12px;
    }
    .head h2 {
        margin: 0;
        color: rgba(253, 230, 138, 0.85);
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
    }
    .close {
        margin-left: auto;
        padding: 2px 8px;
        border: 0;
        background: none;
        color: #a8a29e;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
    }
</style>
