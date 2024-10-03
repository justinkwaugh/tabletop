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
    import AuctioningHud from './AuctioningHud.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    const viewport = useViewport()
    let ready = $state(false)

    function onFlyDone() {
        ready = true
        console.log('fly done')
    }
</script>

<T.OrthographicCamera makeDefault zoom={80} position={[0, 0, 10]} />
<T.AmbientLight intensity={Math.PI / 2} />
<T.PointLight position={[10, 10, 10]} decay={0} intensity={Math.PI * 1.5} />

{#if gameSession.gameState.machineState === MachineState.Auctioning}
    <AuctioningHud />
{/if}
