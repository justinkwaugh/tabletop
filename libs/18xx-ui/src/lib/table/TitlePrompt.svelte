<script lang="ts">
    import type { Snippet } from 'svelte'
    let {
        text,
        answer,
        children
    }: {
        text: string
        /** A single answer; a prompt with several gives them as its ``children``. */
        answer?: { label: string; onAct: () => void }
        children?: Snippet
    } = $props()
</script>

<header class="title-prompt">
    <span>{text}</span>
    {#if answer}
        <button class="action-button inline-action" onclick={answer.onAct}>{answer.label}</button>
    {/if}
    {@render children?.()}
</header>

<style>
    .title-prompt {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
    }
    .title-prompt :global(button) {
        margin: 0;
    }
</style>
