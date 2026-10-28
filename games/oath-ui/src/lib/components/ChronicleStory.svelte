<script lang="ts">
    import { gameNumberOf } from '$lib/model/chronicleHistory.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // The winner's own entry, written once as the chronicle's last step: plain text, capped in
    // code points as the engine counts them, the count shown only near the cap. "Write" appears
    // once there is text; "Skip" is always there. Nothing is editable once sent. The text lives on
    // the session's draft, so the panel drawn again (History, full screen) still holds it.
    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let gameNumber = $derived(gameNumberOf(gameSession.gameState))
    let draft = $derived(gameSession.chronicleStory)

    // `maxlength` counts UTF-16 units, so the cap is the draft's own, in code points.
    function oninput(event: Event & { currentTarget: HTMLTextAreaElement }) {
        const capped = draft.edit(event.currentTarget.value)
        if (capped !== event.currentTarget.value) event.currentTarget.value = capped
    }

    const PRIMARY =
        'rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold'
    const SECONDARY =
        'rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-3 py-1.5 text-sm font-semibold'
</script>

<label class="block text-sm" for="chronicle-story">The story of game {gameNumber}:</label>
<div class="story mt-2">
    <textarea
        id="chronicle-story"
        class="story__box w-full rounded-md border border-oath-frame bg-oath-surface-raised px-3 py-2 text-sm
               text-oath-text placeholder:text-oath-text-muted"
        placeholder="Tell your story in your own way."
        value={draft.text}
        disabled={busy}
        {oninput}
    ></textarea>
    {#if draft.countShown}
        <p class="text-right text-xs text-oath-text-muted" data-story-left>{draft.left} left</p>
    {/if}
</div>
<div class="buttons mt-2">
    {#if draft.writable}
        <button type="button" class={PRIMARY} disabled={busy} onclick={() => draft.write()}
            >Write</button
        >
    {/if}
    <button type="button" class={SECONDARY} disabled={busy} onclick={() => draft.skip()}
        >Skip</button
    >
</div>

<style>
    .story {
        max-width: 36rem;
    }
    /* A long story scrolls inside its box. */
    .story__box {
        height: 7.5rem;
        resize: none;
        overflow-y: auto;
    }
    .buttons {
        display: inline-grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        gap: 0.5rem;
    }
    @media (max-width: 639px) {
        .buttons button {
            min-height: 44px;
        }
    }
</style>
