<script lang="ts">
    import type { Snippet } from 'svelte'

    /**
     * A layer over the table: its backdrop closes it, its close button too, and it pads by the
     * screen's safe areas (contract: Open seat, Card preview).
     */
    let {
        label,
        layer,
        onClose,
        children
    }: { label: string; layer: string; onClose: () => void; children: Snippet } = $props()
</script>

<div
    class="scrim fixed inset-0 flex items-center justify-center"
    role="dialog"
    aria-modal="true"
    aria-label={label}
    data-table-layer={layer}
>
    <button
        type="button"
        class="absolute inset-0 cursor-default bg-(--feudum-dim)"
        aria-label="Close {label}"
        data-backdrop
        onclick={onClose}
    ></button>
    <div class="relative max-h-full overflow-auto">
        <button
            type="button"
            class="absolute right-1 top-1 z-10 rounded-full bg-feudum-control hover:bg-feudum-control-hover px-3 py-1 text-sm text-feudum-text"
            data-close
            onclick={onClose}>Close</button
        >
        {@render children()}
    </div>
</div>

<style>
    .scrim {
        z-index: 60;
        padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
            max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    }
</style>
