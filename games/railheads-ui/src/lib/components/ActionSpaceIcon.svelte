<script lang="ts">
    import { ActionSpaceId, CompanyId, HexKind, INDUSTRIES } from '@tabletop/railheads'
    import { hexPoints } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE, HEX_FILL, INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'
    import IndustryMark from './board/IndustryMark.svelte'

    let { space, size = 36 }: { space: ActionSpaceId; size?: number } = $props()

    type Piece = { x: number; y: number; companyId: CompanyId; cube?: boolean }

    const DISC_RX = 7
    const DISC_RY = 5
    const DISC_THICKNESS = 4
    const SHARE_STACK = [CompanyId.KPEV, CompanyId.KSSE, CompanyId.GBSE]
    const SLOTS = [
        { x: 16, y: 17 },
        { x: 32, y: 17 },
        { x: 16, y: 30 },
        { x: 32, y: 30 }
    ]

    const pieces: Piece[] = $derived(trackPieces(space))

    function trackPieces(space: ActionSpaceId): Piece[] {
        switch (space) {
            case ActionSpaceId.LayTrackII:
                return SLOTS.map((slot, index) => ({
                    ...slot,
                    companyId: index < 2 ? CompanyId.GBSE : CompanyId.KBSB
                }))
            case ActionSpaceId.LayTrackI:
                return SLOTS.map((slot, index) => ({
                    ...slot,
                    companyId: CompanyId.GBSE,
                    cube: index === SLOTS.length - 1
                }))
            default:
                return SLOTS.map((slot) => ({ ...slot, companyId: CompanyId.GBSE }))
        }
    }

    function discBody(x: number, y: number): string {
        return `M ${x - DISC_RX} ${y} L ${x - DISC_RX} ${y + DISC_THICKNESS} A ${DISC_RX} ${DISC_RY} 0 0 0 ${x + DISC_RX} ${y + DISC_THICKNESS} L ${x + DISC_RX} ${y} Z`
    }
</script>

<svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    {#if space === ActionSpaceId.IssueShare}
        {#each SHARE_STACK as companyId, index (companyId)}
            {@const style = COMPANY_STYLE[companyId]}
            <g transform="translate({4 + index * 4} {8 + index * 8})">
                <rect
                    width="32"
                    height="16"
                    rx="1.5"
                    fill={style.fill}
                    stroke="#1d140b"
                    stroke-width="1"
                />
                <rect
                    x="2"
                    y="2"
                    width="28"
                    height="12"
                    fill="none"
                    stroke="#ffffff"
                    stroke-opacity="0.65"
                    stroke-width="0.9"
                />
            </g>
        {/each}
        <path d="M17 29h14M19 33h10" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />
    {:else if space === ActionSpaceId.IndustryInvestment}
        {#each INDUSTRIES as industry, index (industry)}
            <g transform="translate({13 + (index % 2) * 22} {13 + Math.floor(index / 2) * 22})">
                <rect
                    x="-10"
                    y="-10"
                    width="20"
                    height="20"
                    rx="3"
                    fill="#ece6b8"
                    stroke={INDUSTRY_STYLE[industry].ring}
                    stroke-width="2.2"
                />
                <IndustryMark {industry} scale={0.55} />
            </g>
        {/each}
    {:else}
        <polygon
            points={hexPoints({ x: 24, y: 24 }, 23)}
            fill={HEX_FILL[HexKind.Countryside]}
            stroke="#1d1d1b"
            stroke-width="1.5"
        />
        {#each pieces as piece (`${piece.x},${piece.y}`)}
            {@const style = COMPANY_STYLE[piece.companyId]}
            {#if piece.cube}
                <rect
                    x={piece.x - 6}
                    y={piece.y - 4}
                    width="12"
                    height="12"
                    rx="1.5"
                    fill={style.fill}
                    stroke={style.edge}
                    stroke-width="1.2"
                />
            {:else}
                <g stroke={style.edge} stroke-width="1">
                    <path d={discBody(piece.x, piece.y)} fill={style.edge} />
                    <ellipse
                        cx={piece.x}
                        cy={piece.y}
                        rx={DISC_RX}
                        ry={DISC_RY}
                        fill={style.fill}
                    />
                </g>
            {/if}
        {/each}
    {/if}
</svg>

<style>
    svg {
        flex: none;
    }
</style>
