<script lang="ts">
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'

    /** The corner of a card or writ in a panel: it enlarges the piece and picks nothing. */
    let { label, face }: { label: string; face: () => EnlargedFace } = $props()
</script>

<div class="absolute right-0.5 bottom-0.5">
    <Enlargeable tag="div" {label} {face}>
        <span
            class="flex h-5 w-5 items-center justify-center rounded-full border border-feudum-frame bg-feudum-surface-raised text-feudum-text"
        >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"
                ></circle>
                <line x1="10.4" y1="10.4" x2="14" y2="14" stroke="currentColor" stroke-width="1.6"
                ></line>
            </svg>
        </span>
    </Enlargeable>
</div>
