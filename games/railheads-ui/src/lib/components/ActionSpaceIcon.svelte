<script lang="ts">
    import { ActionSpaceId, HexKind, INDUSTRIES, type CompanyId } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE, INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'
    import { cubeFaces, type CubeSize } from '$lib/utils/cubeFaces.js'
    import { editionStyle } from '$lib/utils/editionStyle.js'
    import IndustryMark from './board/IndustryMark.svelte'

    let { space, size = 36 }: { space: ActionSpaceId; size?: number } = $props()

    type Piece = { x: number; y: number; companyId: CompanyId; cube?: boolean }

    const DISC_RX = 7
    const DISC_RY = 5
    const DISC_THICKNESS = 4
    const CUBE: CubeSize = { halfWidth: 6, halfDepth: 4.3, height: 5 }
    const gameSession = getGameSession()

    const editionId = $derived(gameSession.gameState.editionId)
    const style = $derived(editionStyle(editionId))
    const layout = $derived(boardLayout(editionId))
    const SLOTS = [
        { x: 16, y: 17 },
        { x: 32, y: 17 },
        { x: 16, y: 30 },
        { x: 32, y: 30 }
    ]

    const pieces: Piece[] = $derived(trackPieces(space, style.trackIconCompanies))

    function trackPieces(
        space: ActionSpaceId,
        [first, second]: readonly [CompanyId, CompanyId]
    ): Piece[] {
        switch (space) {
            case ActionSpaceId.LayTrackII:
                return SLOTS.map((slot, index) => ({
                    ...slot,
                    companyId: index < 2 ? first : second
                }))
            case ActionSpaceId.LayTrackI:
                return SLOTS.map((slot, index) => ({
                    ...slot,
                    companyId: first,
                    cube: index === SLOTS.length - 1
                }))
            default:
                return SLOTS.map((slot) => ({ ...slot, companyId: first }))
        }
    }

    function discBody(x: number, y: number): string {
        return `M ${x - DISC_RX} ${y} L ${x - DISC_RX} ${y + DISC_THICKNESS} A ${DISC_RX} ${DISC_RY} 0 0 0 ${x + DISC_RX} ${y + DISC_THICKNESS} L ${x + DISC_RX} ${y} Z`
    }
</script>

<svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    {#if space === ActionSpaceId.IssueShare}
        {#each style.shareIconCompanies as companyId, index (companyId)}
            {@const company = COMPANY_STYLE[companyId]}
            <g transform="translate({4 + index * 4} {8 + index * 8})">
                <rect
                    width="32"
                    height="16"
                    rx="1.5"
                    fill={company.fill}
                    stroke="#1d140b"
                    stroke-width="1"
                ></rect>
                <rect
                    x="2"
                    y="2"
                    width="28"
                    height="12"
                    fill="none"
                    stroke="#ffffff"
                    stroke-opacity="0.65"
                    stroke-width="0.9"
                ></rect>
            </g>
        {/each}
        <path d="M17 29h14M19 33h10" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"
        ></path>
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
                ></rect>
                <IndustryMark {industry} scale={0.55} />
            </g>
        {/each}
    {:else}
        <polygon
            points={layout.hexPoints({ x: 24, y: 24 }, 23)}
            fill={style.hexFill[HexKind.Countryside]}
            stroke="#1d1d1b"
            stroke-width="1.5"
        ></polygon>
        {#each pieces as piece (`${piece.x},${piece.y}`)}
            {@const company = COMPANY_STYLE[piece.companyId]}
            {#if piece.cube}
                {@const faces = cubeFaces({ x: piece.x, y: piece.y - 1 }, CUBE)}
                <g stroke={company.edge} stroke-width="1" stroke-linejoin="round">
                    <path d={faces.left} fill={company.edge}></path>
                    <path d={faces.right} fill={company.edge}></path>
                    <path d={faces.right} fill="rgba(0,0,0,0.25)" stroke="none"></path>
                    <path d={faces.top} fill={company.fill}></path>
                </g>
            {:else}
                <g stroke={company.edge} stroke-width="1">
                    <path d={discBody(piece.x, piece.y)} fill={company.edge}></path>
                    <ellipse cx={piece.x} cy={piece.y} rx={DISC_RX} ry={DISC_RY} fill={company.fill}
                    ></ellipse>
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
