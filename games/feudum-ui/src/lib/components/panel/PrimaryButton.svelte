<script lang="ts">
    import type { ActionBlock } from '$lib/model/actionPanel.js'

    /** The send, wherever it stands: the panel, or a phone's bench footer. */
    let { block }: { block: Extract<ActionBlock, { kind: 'primary' }> } = $props()
</script>

<button
    type="button"
    class="rounded-lg border border-feudum-primary-border bg-feudum-primary px-4 py-1 text-sm font-semibold text-feudum-primary-text max-sm:w-full max-sm:px-2 max-sm:text-xs
        {block.enabled ? 'hover:bg-feudum-primary-hover' : 'opacity-50'}"
    disabled={!block.enabled}
    data-primary
    onclick={() => void block.send()}>{block.label}</button
>
