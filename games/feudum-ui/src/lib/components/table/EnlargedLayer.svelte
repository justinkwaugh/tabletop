<script lang="ts">
    import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'
    import EnlargedFaceView from './EnlargedFaceView.svelte'
    import Scrim from './Scrim.svelte'

    /**
     * Contract, Card preview: the enlarged piece over everything. A press on the piece closes it, as
     * a press beside it or Escape does; no close button stands over it.
     */
    let { face, width, onClose }: { face: EnlargedFace; width: number; onClose: () => void } =
        $props()
</script>

<Scrim label="the enlarged piece" layer="enlarged" {onClose} closeButton={false}>
    <button
        type="button"
        class="block cursor-zoom-out"
        aria-label="Close"
        data-close
        data-enlarged={face.kind}
        onclick={onClose}
    >
        <EnlargedFaceView {face} {width} />
    </button>
</Scrim>
