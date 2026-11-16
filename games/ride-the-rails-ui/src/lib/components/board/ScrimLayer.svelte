<script lang="ts">
    import type { BoardOffer } from '$lib/model/boardOffer.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { scrimPath } from '$lib/utils/pickMarks.js'

    let { offer }: { offer: BoardOffer } = $props()
</script>

<!-- Contract, Pick conventions: a plain translucent fill with holes, never an opacity effect. A
     spotlit railroad fades the others' cubes instead (TrackLayer). -->
<g class="scrim" aria-hidden="true">
    {#if offer.scrim}
        <path
            d={scrimPath(offer.scrim.holes)}
            fill={BOARD_LOOK.litHex === 'deep-scrim' ? 'var(--rtr-scrim-deep)' : 'var(--rtr-scrim)'}
            fill-rule="evenodd"
        ></path>
    {/if}
</g>
