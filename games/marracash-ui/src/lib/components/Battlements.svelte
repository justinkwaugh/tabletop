<script lang="ts">
    import { MerlonColor, type BattlementPaths } from '$lib/utils/cityWall.js'

    const ShadowColor = '#3b1a0b'

    let { paths }: { paths: BattlementPaths } = $props()
</script>

<path d={paths.penumbra} fill={ShadowColor} opacity="0.22"></path>
<path d={paths.shadow} fill={ShadowColor} opacity="0.42"></path>
<path d={paths.body} fill={MerlonColor}></path>
<path d={paths.light} fill="none" stroke="#f6c9a6" stroke-opacity="0.5" stroke-width="1"></path>
<path d={paths.shade} fill="none" stroke="#6e3820" stroke-opacity="0.75" stroke-width="1.4"></path>
