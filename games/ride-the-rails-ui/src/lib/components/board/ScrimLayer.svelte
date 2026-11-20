<script lang="ts">
    import type { BoardOffer } from '$lib/model/boardOffer.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SCRIM_FILL } from '$lib/utils/boardLook.js'
    import { scrimPath } from '$lib/utils/pickMarks.js'

    let { offer }: { offer: BoardOffer } = $props()

    const gameSession = getGameSession()
</script>

<!-- Contract, Pick conventions: a plain translucent fill with holes, never an opacity effect. A
     spotlit railroad fades the others' cubes instead (TrackLayer). -->
<g class="scrim" aria-hidden="true">
    {#if offer.scrim}
        <path
            d={scrimPath(gameSession.boardFrame, offer.scrim.holes)}
            fill={SCRIM_FILL}
            fill-rule="evenodd"
        ></path>
    {/if}
</g>
