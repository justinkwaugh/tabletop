<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { ActionBlock } from '$lib/model/actionPanel.js'

    /**
     * The send, wherever it stands: the panel, or a phone's bench footer. `children` draws it in
     * place of its label, which stays its accessible name.
     */
    let {
        block,
        children
    }: { block: Extract<ActionBlock, { kind: 'primary' }>; children?: Snippet } = $props()

    /** A second line's parts: a phone keeps the last, "can't be undone". */
    let noteParts = $derived(block.note?.split(' · ') ?? [])
</script>

<button
    type="button"
    class="rounded-lg border border-feudum-primary-border bg-feudum-primary px-4 py-1 text-sm font-semibold text-feudum-primary-text max-sm:w-full max-sm:px-2 max-sm:text-xs
        {block.enabled ? 'hover:bg-feudum-primary-hover' : 'opacity-50'}"
    disabled={!block.enabled}
    aria-label={children ? block.label : block.note ? `${block.label} · ${block.note}` : undefined}
    data-primary
    onclick={() => void block.send()}
    >{#if children}{@render children()}{:else if block.note}<span class="block" data-primary-label
            >{block.label}</span
        ><span class="block text-xs font-normal" data-primary-note
            >{#each noteParts as part, at (at)}<span
                    class={at < noteParts.length - 1 ? 'max-sm:hidden' : ''}
                    >{part}{at < noteParts.length - 1 ? ' · ' : ''}</span
                >{/each}</span
        >{:else}{block.label}{/if}</button
>
