<script lang="ts">
    import { T } from '@threlte/core'
    import { interactivity, OrbitControls, TrackballControls } from '@threlte/extras'
    import Map from './Map.svelte'
    import { Company, PieceType } from '@tabletop/estates'
    import { ColumnOffsets, RowOffsets } from '$lib/utils/boardOffsets.js'
    import { Site as SiteData } from '@tabletop/estates'
    import Site from './Site.svelte'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    interactivity()

    const siteOne: SiteData = {
        single: false,
        cubes: [
            { pieceType: PieceType.Cube, company: Company.Heather, value: 4 },
            { pieceType: PieceType.Cube, company: Company.Emerald, value: 2 },
            { pieceType: PieceType.Cube, company: Company.Heather, value: 1 }
        ],
        roof: { pieceType: PieceType.Roof, value: 5 }
    }

    const siteTwo: SiteData = {
        single: false,
        cubes: [
            { pieceType: PieceType.Cube, company: Company.Sienna, value: 2 },
            { pieceType: PieceType.Cube, company: Company.Collar, value: 1 }
        ],
        roof: { pieceType: PieceType.Roof, value: 3 }
    }
    const emptySite: SiteData = { single: false, cubes: [], roof: undefined }
</script>

<T.PerspectiveCamera
    makeDefault
    position={[0, 10, 10]}
    oncreate={(ref) => {
        ref.lookAt(0, 0, 0)
    }}><OrbitControls maxPolarAngle={1.25} enablePan={false} /></T.PerspectiveCamera
>
<T.AmbientLight intensity={1.5} />
<T.DirectionalLight position={[5, 5, 10]} castShadow />

<Map />
{#each gameSession.gameState.board.rows as row, i}
    {#each row.sites as site, j}
        <Site {site} coords={{ row: i, col: j }} x={ColumnOffsets[j]} z={RowOffsets[i]} />
    {/each}
{/each}
