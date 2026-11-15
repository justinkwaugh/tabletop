<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session, prompt }: { session: EighteenXXSessionView; prompt: string } = $props()
    const modes = $derived(session.operatingMode)
</script>

<!-- A construction panel's prompt, with skip to end construction while it is open. -->
<header class="construction-prompt">
    {#if modes.constructionOpen}<span>{prompt} or</span>
        <button
            class="action-button inline-action"
            disabled={!modes.canFinish}
            onclick={() => modes.finish()}>skip</button
        >
    {:else}<span>{prompt}</span>{/if}
</header>

<style>
    .construction-prompt {
        display: flex;
        align-items: center;
        gap: 10px;
    }
</style>
