<script lang="ts">
    import { rulesNoteOf } from '$lib/model/rulesText.js'
    import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'
    import EnlargedFaceView from './EnlargedFaceView.svelte'
    import Scrim from './Scrim.svelte'
    import { setTableLayers } from './tableLayersContext.js'

    /** Contract, Shared visual state: the piece is one close press, so no part takes the pointer. */
    let { face, width, onClose }: { face: EnlargedFace; width: number; onClose: () => void } =
        $props()

    setTableLayers(undefined)

    let note = $derived(rulesNoteOf(face))
</script>

<Scrim label="the enlarged piece" layer="enlarged" {onClose} closeButton={false}>
    <div class="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <button
            type="button"
            class="block shrink-0 cursor-zoom-out"
            aria-label="Close"
            data-close
            data-enlarged={face.kind}
            onclick={onClose}
        >
            <span class="art block" data-enlarged-art>
                <EnlargedFaceView {face} {width} />
            </span>
        </button>
        {#if note}
            <aside
                class="w-full rounded-lg bg-feudum-surface-raised p-4 text-sm text-feudum-text sm:w-80"
                style:max-width="{width}px"
                aria-label="Rules: {note.title}"
                data-rules-note
            >
                <h2 class="mb-2 text-base font-semibold">{note.title}</h2>
                <dl class="flex flex-col gap-2">
                    {#each note.lines as { term, text } (term)}
                        <div>
                            <dt class="inline font-semibold">{term}.</dt>
                            <dd class="inline">{text}</dd>
                        </div>
                    {/each}
                </dl>
            </aside>
        {/if}
    </div>
</Scrim>

<style>
    .art :global(*) {
        pointer-events: none;
    }
</style>
