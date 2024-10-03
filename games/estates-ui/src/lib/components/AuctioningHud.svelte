<script lang="ts">
    import { T, useTask } from '@threlte/core'
    import { interactivity, useCursor, useViewport } from '@threlte/extras'
    import Cube3d from './Cube3d.svelte'
    import { Company, MachineState, PieceType } from '@tabletop/estates'
    import AuctionPreview from './AuctionPreview.svelte'
    import HighBid from './HighBid.svelte'
    import BidControls from './BidControls.svelte'
    import BidButtons from './BidButtons.svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { getContext } from 'svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    const viewport = useViewport()
    let ready = $state(false)

    function onFlyDone() {
        ready = true
        console.log('fly done')
    }
</script>

<HighBid {ready} position={[-1.5, $viewport.height / 2 - 0.5, 0]} />
<AuctionPreview flyDone={onFlyDone} position={[0, $viewport.height / 2 - 0.5, 0]} />

{#if gameSession.isMyTurn}
    <BidControls {ready} position={[1.5, $viewport.height / 2 - 0.5, 0]} />
    <BidButtons {ready} position={[0, $viewport.height / 2 - 1.5, 0]} />
{/if}
