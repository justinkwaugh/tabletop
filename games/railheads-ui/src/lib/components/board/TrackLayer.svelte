<script lang="ts">
    import { sameCoordinates } from '@tabletop/common'
    import { HexKind, PlacementKind, hexKey, type CompanyId } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    const gameSession = getGameSession()

    const DISC_RADIUS = 11
    const STACK_STEP = 6
    const FAN_OFFSET = 4
    const DISC_THICKNESS = 7
    const HALO = '#fbf8e6'
    const HALO_WIDTH = 4
    const SITE_STACK_BASE = -3

    function discBody(x: number, y: number, ry: number): string {
        return `M ${x - DISC_RADIUS} ${y} L ${x - DISC_RADIUS} ${y + DISC_THICKNESS} A ${DISC_RADIUS} ${ry} 0 0 0 ${x + DISC_RADIUS} ${y + DISC_THICKNESS} L ${x + DISC_RADIUS} ${y} Z`
    }

    function fanOffset(index: number, count: number): number {
        if (count === 1) {
            return 0
        }
        return index % 2 === 0 ? -FAN_OFFSET : FAN_OFFSET
    }

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
            const baseY = site ? center.y + SITE_STACK_BASE : center.y
            return {
                key: hexKey(hex.coords),
                discs: hex.discs.map((companyId, index) => ({
                    companyId,
                    x: center.x + fanOffset(index, hex.discs.length),
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
        {@const edge = disc.ghost ? '#fff6c8' : style.edge}
        {@const ry = DISC_RADIUS * 0.8}
        {@const body = discBody(disc.x, disc.y, ry)}
        <ellipse
            cx={disc.x}
            cy={disc.y + DISC_THICKNESS + 3}
            rx={DISC_RADIUS + 1}
            ry={ry + 1}
            fill="rgba(0,0,0,0.5)"
        />
        <g fill={HALO} stroke={HALO} stroke-width={HALO_WIDTH} stroke-linejoin="round">
            <path d={body} />
            <ellipse cx={disc.x} cy={disc.y} rx={DISC_RADIUS} {ry} />
        </g>
        <g
            opacity={disc.ghost ? 0.85 : 1}
            stroke={edge}
            stroke-width={disc.ghost ? 2.5 : 1.5}
            stroke-dasharray={disc.ghost ? '4 3' : undefined}
        >
            <path d={body} fill={style.edge} />
            <ellipse cx={disc.x} cy={disc.y} rx={DISC_RADIUS} {ry} fill={style.fill} />
        </g>
    {/each}
    {#if hex.cube}
        {@const style = COMPANY_STYLE[hex.cube.companyId]}
        <rect
            x={hex.cube.x - 7}
            y={hex.cube.y - 7}
            width="14"
            height="14"
            rx="2"
            fill={HALO}
            stroke={HALO}
            stroke-width={HALO_WIDTH}
        />
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
    path,
    rect {
        pointer-events: none;
    }
</style>
