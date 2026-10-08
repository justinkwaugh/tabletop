<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { landMood } from '$lib/model/landMood.js'
    import { isFieldSquare } from '@tabletop/santiago'

    const session = getGameSession()
    const boardMood = $derived(landMood(session.gameState))

    let open = $state(false)

    function setOverride(enabled: boolean) {
        session.moodOverride = enabled ? { ...boardMood } : undefined
    }

    function setDial(dial: 'lush' | 'drought', value: number) {
        const current = session.moodOverride ?? boardMood
        session.moodOverride = { ...current, [dial]: value }
    }

    const percent = (value: number) => `${Math.round(value * 100)}%`

    function kickUpDust() {
        const living = session.gameState.board.squares.flatMap((column, col) =>
            column.flatMap((square, row) => (isFieldSquare(square) && !square.dried ? [{ col, row }] : []))
        )
        const squares = living.length > 0 ? living.slice(0, 4) : [{ col: 3, row: 2 }, { col: 4, row: 3 }]
        void session.droughtDust.preview(squares)
    }
</script>

<!-- Developer-harness only: previews the land's light on any board without changing the game. -->
<div class="mood-tuner">
    <button type="button" class="toggle" onclick={() => (open = !open)}>
        {open ? 'Hide mood tuner' : 'Mood tuner'}
    </button>
    {#if open}
        <div class="panel">
            <label class="row">
                <input
                    type="checkbox"
                    checked={session.moodOverride !== undefined}
                    onchange={(event) => setOverride(event.currentTarget.checked)}
                />
                Override the board's mood
            </label>
            {#each [['lush', 'Lushness'], ['drought', 'Drought']] as const as [dial, label] (dial)}
                <label class="slider">
                    <span>{label} {percent(session.landMood[dial])}</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={session.landMood[dial]}
                        disabled={session.moodOverride === undefined}
                        oninput={(event) => setDial(dial, Number(event.currentTarget.value))}
                    />
                </label>
            {/each}
            <button type="button" class="toggle" onclick={kickUpDust}>Kick up dust</button>
            <div class="note">
                Board says: lush {percent(boardMood.lush)}, drought {percent(boardMood.drought)}
            </div>
        </div>
    {/if}
</div>

<style>
    .mood-tuner {
        position: fixed;
        left: 12px;
        bottom: 12px;
        z-index: 40;
        font: 12px/1.3 ui-sans-serif, system-ui, sans-serif;
        color: #fef3c7;
    }
    .toggle {
        padding: 4px 10px;
        border-radius: 6px;
        background: rgba(28, 20, 16, 0.85);
        border: 1px solid rgba(251, 191, 36, 0.5);
    }
    .panel {
        margin-top: 6px;
        padding: 10px 12px;
        width: 220px;
        border-radius: 8px;
        background: rgba(28, 20, 16, 0.92);
        border: 1px solid rgba(251, 191, 36, 0.4);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .slider {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .note {
        opacity: 0.7;
    }
</style>
