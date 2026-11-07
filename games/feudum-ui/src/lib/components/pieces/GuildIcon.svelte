<script lang="ts">
    import type { GuildId } from '@tabletop/feudum'
    import { GuildIconPaths } from '$lib/utils/pieceShapes.js'

    /** A guild's one icon, on medallions, keeps, card needs and in text. Takes the ink it stands in. */
    let {
        guild,
        size = 24,
        x,
        y,
        ink = 'currentColor'
    }: { guild: GuildId; size?: number; x?: number; y?: number; ink?: string } = $props()
</script>

<svg {x} {y} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={guild}>
    <title>{guild}</title>
    <path d={GuildIconPaths[guild]} fill={ink} fill-rule="evenodd"></path>
</svg>
