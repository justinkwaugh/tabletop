<script lang="ts">
    import { T } from '@threlte/core'
    import { interactivity, OrbitControls, TrackballControls } from '@threlte/extras'
    import Map from './Map.svelte'
    import Cube from './Cube.svelte'
    import Roof from './Roof.svelte'
    import { Company, PieceType } from '@tabletop/estates'
    import { ColumnOffsets, RowOffsets } from '$lib/utils/boardOffsets.js'
    import { Site as SiteData } from '@tabletop/estates'
    import Site from './Site.svelte'
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
</script>

<T.PerspectiveCamera
    makeDefault
    position={[10, 10, 10]}
    oncreate={(ref) => {
        ref.lookAt(0, 1, 0)
    }}><OrbitControls /></T.PerspectiveCamera
>
<T.AmbientLight intensity={1.5} />
<T.DirectionalLight position={[5, 5, 10]} castShadow />

<Map />
<Site site={siteOne} x={ColumnOffsets[6]} z={RowOffsets[2]} />
<Site site={siteTwo} x={ColumnOffsets[6]} z={RowOffsets[0]} />
<Cube
    cube={{ pieceType: PieceType.Cube, company: Company.Collar, value: 4 }}
    x={ColumnOffsets[9]}
    z={RowOffsets[2]}
/>
<Cube cube={{ pieceType: PieceType.Cube, company: Company.Skyline, value: 5 }} x={3.5} />
<Cube cube={{ pieceType: PieceType.Cube, company: Company.Heather, value: 4 }} x={3.45} z={2.5} />
<Roof x={3.45} z={2.5} y={0.75} />
<Cube cube={{ pieceType: PieceType.Cube, company: Company.Emerald, value: 2 }} x={3.5} y={1} />
<Cube cube={{ pieceType: PieceType.Cube, company: Company.Heather, value: 1 }} x={3.5} y={2} />
<Cube cube={{ pieceType: PieceType.Cube, company: Company.Golden, value: 6 }} x={5.4} />
<Cube cube={{ pieceType: PieceType.Cube, company: Company.Sienna, value: 4 }} x={5.4} y={1} />
