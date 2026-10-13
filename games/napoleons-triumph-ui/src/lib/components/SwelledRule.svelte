<script lang="ts">
    import type { Snippet } from 'svelte'

    /** Words to set in the middle of the rule, in place of its lozenge. */
    let { children }: { children?: Snippet } = $props()
</script>

<div class="nt-swelled-rule" aria-hidden={children ? undefined : true}>
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"
        ><path d="M0 2 L100 0.4 V3.6 Z"></path></svg
    >
    {#if children}
        <span class="nt-swelled-rule-words">{@render children()}</span>
    {:else}
        <svg class="nt-swelled-rule-lozenge" viewBox="0 0 10 10"
            ><path d="M5 0 L10 5 L5 10 L0 5 Z"></path></svg
        >
    {/if}
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"
        ><path d="M100 2 L0 0.4 V3.6 Z"></path></svg
    >
</div>

<style>
    .nt-swelled-rule {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    svg {
        flex: 1;
        min-width: 0;
        height: 4px;
        fill: currentColor;
        opacity: 0.78;
    }

    .nt-swelled-rule-lozenge {
        flex: none;
        width: 8px;
        height: 8px;
    }

    .nt-swelled-rule-words {
        flex: none;
    }
</style>
