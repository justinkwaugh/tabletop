<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import StandingInstruction from '../stock/StandingInstruction.svelte'
    import RunInstructions from '../routes/RunInstructions.svelte'
    let { session }: { session: EighteenXXSessionView } = $props()
</script>

{#if session.instructions.shown || session.runInstructions.shown}
    <div class="instruction-slot">
        <footer class="instruction-bar" aria-label="Standing instructions">
            <StandingInstruction {session} />
            <RunInstructions {session} />
        </footer>
    </div>
{/if}

<style>
    /* At the foot of a panel that fills its pane, and always clear of what is above it. */
    .instruction-slot {
        margin-top: auto;
        padding-top: 12px;
    }
    .instruction-bar {
        container: instruction-bar / inline-size;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 6px 16px;
        padding: 8px 4px 0;
        border-top: 1px solid var(--rail-border, #485666);
        font-size: 12px;
        color: var(--rail-text, #e3e9ef);
    }
</style>
