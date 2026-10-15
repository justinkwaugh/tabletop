<script lang="ts">
    import { sameCoordinates } from '@tabletop/common'
    import { HexKind, PlacementKind, hexKey, type CompanyId } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    const gameSession = getGameSession()

    const DISC_RADIUS = 11
    const STACK_STEP = 6

    function staged(companyId: CompanyId, kind: PlacementKind, coords: { q: number; r: number }) {
        return gameSession.placements.some(
            (placement) =>
                placement.companyId === companyId &&
                placement.kind === kind &&
                sameCoordinates(placement.coords, coords)
        )
    }

    const pieces = $derived.by(() => {
        const state = gameSession.shownState
        return state.track.map((hex) => {
            const center = hexCenter(hex.coords)
            const site = state.edition.map.hex(hex.coords).kind !== HexKind.Countryside
            const baseY = site ? center.y + 5 + ((hex.discs.length - 1) * STACK_STEP) / 2 : center.y
            return {
                key: hexKey(hex.coords),
                discs: hex.discs.map((companyId, index) => ({
                    companyId,
                    x: center.x,
                    y: baseY - index * STACK_STEP,
                    ghost: staged(companyId, PlacementKind.Disc, hex.coords)
                })),
                cube: hex.cube
                    ? {
                          companyId: hex.cube,
                          x: center.x + 12,
                          y: center.y - 14,
                          ghost: staged(hex.cube, PlacementKind.Cube, hex.coords)
                      }
                    : undefined
            }
        })
    })
</script>

{#each pieces as hex (hex.key)}
    {#each hex.discs as disc, index (index)}
        {@const style = COMPANY_STYLE[disc.companyId]}
        <ellipse cx={disc.x} cy={disc.y + 3} rx={DISC_RADIUS} ry={DISC_RADIUS * 0.8} fill="rgba(0,0,0,0.35)" />
        <ellipse
            cx={disc.x}
            cy={disc.y}
            rx={DISC_RADIUS}
            ry={DISC_RADIUS * 0.8}
            fill={style.fill}
            stroke={disc.ghost ? '#fff6c8' : style.edge}
            stroke-width={disc.ghost ? 2.5 : 1.5}
            stroke-dasharray={disc.ghost ? '4 3' : undefined}
            opacity={disc.ghost ? 0.85 : 1}
        />
    {/each}
    {#if hex.cube}
        {@const style = COMPANY_STYLE[hex.cube.companyId]}
        <rect
            x={hex.cube.x - 7}
            y={hex.cube.y - 7}
            width="14"
            height="14"
            rx="2"
            fill={style.fill}
            stroke={hex.cube.ghost ? '#fff6c8' : style.edge}
            stroke-width={hex.cube.ghost ? 2.5 : 1.5}
            stroke-dasharray={hex.cube.ghost ? '4 3' : undefined}
        />
    {/if}
{/each}

<style>
    ellipse,
    rect {
        pointer-events: none;
    }
</style>
