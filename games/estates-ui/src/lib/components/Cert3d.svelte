<script lang="ts">
    import { T } from '@threlte/core'
    import { useTexture } from '@threlte/extras'
    import collarImg from '$lib/images/collar.jpg'
    import emeraldImg from '$lib/images/emerald.jpg'
    import goldenImg from '$lib/images/golden.jpg'
    import siennaImg from '$lib/images/sienna.jpg'
    import skylineImg from '$lib/images/skyline.jpg'
    import heatherImg from '$lib/images/heather.jpg'
    import { Company } from '@tabletop/estates'

    let { company, ...others }: { company: Company } = $props()
    const texture = useTexture(
        company === Company.Collar
            ? collarImg
            : company === Company.Emerald
              ? emeraldImg
              : company === Company.Golden
                ? goldenImg
                : company === Company.Sienna
                  ? siennaImg
                  : company === Company.Skyline
                    ? skylineImg
                    : heatherImg
    )
</script>

{#await texture then textureValue}
    <T.Mesh rotation.x={-Math.PI / 2} receiveShadow {...others}>
        <T.PlaneGeometry args={[1.75, 1]} />
        <T.MeshStandardMaterial map={textureValue} />
    </T.Mesh>
{/await}
