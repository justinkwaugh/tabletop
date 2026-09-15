<script lang="ts">
    import type { Snippet } from 'svelte'
    let {
        title,
        count,
        children,
        action
    }: { title: string; count?: number; children: Snippet; action?: Snippet } = $props()
    const id = $props.id()
</script>

<section aria-labelledby={id}>
    <header>
        <h2 {id}>{title}</h2>
        {#if count !== undefined}<span class="count">{count}</span>{/if}
        {#if action}<div class="section-action">{@render action()}</div>{/if}
    </header>
    {@render children()}
</section>

<style>
    section {
        min-width: 0;
    }
    header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
    }
    h2 {
        font-family: 'Inter', sans-serif;
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.025em;
        color: var(--color-gray-200);
    }
    .section-action {
        margin-left: auto;
    }
    .count {
        color: var(--color-gray-400);
        font-size: 13px;
    }
</style>
