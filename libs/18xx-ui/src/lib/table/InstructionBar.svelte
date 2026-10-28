<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import StandingInstruction from '../stock/StandingInstruction.svelte'
    import RunInstructions from '../routes/RunInstructions.svelte'
    let { session }: { session: EighteenXXSessionView } = $props()
</script>

{#if session.instructions.shown || session.runInstructions.shown}
    <footer class="instruction-bar" aria-label="Standing instructions">
        <StandingInstruction {session} />
        <RunInstructions {session} />
    </footer>
{/if}

<style>
    .instruction-bar {
        container: instruction-bar / inline-size;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 6px 16px;
        margin-top: auto;
        padding: 8px 4px 0;
        border-top: 1px solid var(--rail-border, #485666);
        font-size: 12px;
        color: var(--rail-text, #e3e9ef);
    }
</style>
