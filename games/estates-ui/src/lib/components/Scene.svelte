<script lang="ts">
    import { T } from '@threlte/core'
    import { interactivity, OrbitControls } from '@threlte/extras'
    import Map from './Map.svelte'
    import { ColumnOffsets, RowOffsets } from '$lib/utils/boardOffsets.js'
    import Site from './Site.svelte'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Offer3d from './Offer3d.svelte'
    import AuctionPreview from './AuctionPreview.svelte'
    import HighBid from './HighBid.svelte'
    import BidControls from './BidControls.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    interactivity()
</script>

<T.PerspectiveCamera
    makeDefault
    position={[0, 10, 25]}
    oncreate={(ref) => {
        ref.lookAt(0, 1, 0)
    }}
    ><OrbitControls
        maxPolarAngle={1.15}
        maxAzimuthAngle={Math.PI / 3}
        minAzimuthAngle={-(Math.PI / 3)}
        enablePan={true}
        zoomToCursor={false}
    />
    <HighBid />
    <AuctionPreview />
    <BidControls />
</T.PerspectiveCamera>
<T.AmbientLight intensity={1.5} />
<T.DirectionalLight position={[5, 5, 10]} castShadow />

<Map />
{#each gameSession.gameState.board.rows as row, i}
    {#each row.sites as site, j}
        <Site {site} coords={{ row: i, col: j }} x={ColumnOffsets[j]} z={RowOffsets[i]} />
    {/each}
    {#if row.mayor}
        <TopHat scale={0.5} position.y={0.35} position.x={10.2} position.z={RowOffsets[i]} />
    {/if}
{/each}
<Offer3d position.x={-8} position.z={6} />
