<script lang="ts">
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'

    /** The corner of a card or writ in a panel: it enlarges the piece and picks nothing. */
    let { label, face }: { label: string; face: () => EnlargedFace } = $props()
</script>

<div class="corner absolute right-0.5 bottom-0.5">
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

<style>
    /*
     * Contract, Phone layout: 44 px targets. The foot of a phone's card is the magnifier, reaching
     * into the gap beneath, and what stands above it is the pick.
     */
    @media (width < 40rem), (max-height: 520px) and (orientation: landscape) {
        .corner {
            top: max(44px, calc(100% - 44px));
            right: 0;
            bottom: -12px;
            left: 0;
        }

        .corner::before {
            position: absolute;
            inset: 0 0 12px;
            border-radius: 0 0 6px 6px;
            background-color: var(--feudum-surface-raised);
            content: '';
            opacity: 0.45;
            pointer-events: none;
        }

        .corner :global([data-enlarge]) {
            position: relative;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            height: 100%;
            padding-bottom: 14px;
        }
    }
</style>
