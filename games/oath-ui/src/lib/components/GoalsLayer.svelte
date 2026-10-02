<script lang="ts">
    import GoalRows from '$lib/components/GoalRows.svelte'
    import { goalBoard } from '$lib/model/goalBoard.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Mounted beside the open seat, outside the board's transform; it shows the displayed state.
    let gameSession = getGameSession()
    let goalsView = $derived(gameSession.goalsView)
    let viewportWidth = $state(1024)
    // A phone's sheet draws the same boxes a size smaller.
    let scale = $derived(viewportWidth < 640 ? 0.66 : 0.8)
</script>

<svelte:window bind:innerWidth={viewportWidth} />

{#if goalsView.open}
    <!-- Closed on the click, so the press that closes it reaches nothing under it (rule 7). -->
    <div
        class="goals-layer"
        role="presentation"
        onpointerdown={(event) => event.preventDefault()}
        onclick={() => goalsView.close()}
        onkeydown={(event) => {
            if (event.key === 'Enter') goalsView.close()
        }}
    >
        <div
            class="sheet"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            aria-label="Goals"
            onpointerdown={(e) => e.stopPropagation()}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <header class="head">
                <button
                    type="button"
                    class="close"
                    onclick={() => goalsView.close()}
                    aria-label="Close">×</button
                >
            </header>
            <GoalRows board={goalBoard(gameSession.gameState)} {scale} />
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
        background: var(--oath-surface-raised);
        border: 1px solid var(--oath-frame);
        color: var(--oath-text);
        padding: 12px 18px 18px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
    }
    .head {
        display: flex;
        align-items: baseline;
        margin-bottom: 4px;
    }
    .close {
        margin-left: auto;
        padding: 2px 8px;
        border: 0;
        background: none;
        color: var(--oath-text-muted);
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
    }
</style>
