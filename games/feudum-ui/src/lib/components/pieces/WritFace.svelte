<script lang="ts">
    import { RoyalWrits, type Charter, type WritId } from '@tabletop/feudum'
    import { WritBackAsset, assetUrl } from '$lib/art/assetMap.js'
    import { writName } from '$lib/model/writLabels.js'
    import { CardBox, wrapLines } from '$lib/utils/cardShape.js'
    import { CrownPath } from '$lib/utils/pieceShapes.js'
    import GoodToken from './GoodToken.svelte'
    import GuildIcon from './GuildIcon.svelte'
    import PieceFrame from './PieceFrame.svelte'

    /**
     * R-4.4.4 A royal writ. The perspective rule sets `faceShown`; a back is one crowned writ whichever
     * writ it is, and carries a wax seal when sealed. A sealed writ's face, shown to its holder, is
     * dimmed and says so. One component by width; R-7, R-4.4.3 a face lays out its data.
     */
    let {
        faceShown,
        writId,
        sealed = false,
        width = 120,
        x,
        y
    }: {
        faceShown: boolean
        writId?: WritId
        sealed?: boolean
        width?: number
        x?: number
        y?: number
    } = $props()

    let writ = $derived(faceShown ? RoyalWrits.find(({ id }) => id === writId) : undefined)
    let height = $derived((width * CardBox.height) / CardBox.width)
    let name = $derived(writ ? writName(writ.id) : 'writ')
    let label = $derived(`${writ ? name : 'Writ back'}${sealed ? ', sealed' : ''}`)
    let url = $derived(assetUrl(writ ? writ.id : WritBackAsset))
    const Left = 22

    /** R-4.4.3, R-6.2 What a charter scores, from its data. */
    function charterValues(charter: Charter): string {
        switch (charter.kind) {
            case 'kingdom':
                return `${charter.vpByLocationsRuled.join('/')} vp`
            case 'sulfur-barrel':
                return `${charter.vpBySulfur.map(({ vp }) => vp).join('/')} vp`
            case 'monster-defeat':
                return `${charter.vp} vp`
        }
    }
    let nameRows = $derived(wrapLines(writ && 'number' in writ ? name : name.split(':')[0], 18))
    let textTop = $derived(52 + nameRows.length * 28)
</script>

{#snippet rows(lines: string[], top: number)}
    <text fill="var(--feudum-ink)" font-size="18" style:font-family="var(--feudum-font-text)">
        {#each lines as line, index (index)}
            <tspan x={Left} y={top + index * 21}>{line}</tspan>
        {/each}
    </text>
{/snippet}

<PieceFrame
    {label}
    {url}
    {width}
    {height}
    viewBox="0 0 {CardBox.width} {CardBox.height}"
    opacity={faceShown && sealed ? 0.6 : undefined}
    {x}
    {y}
>
    <rect
        x="1"
        y="1"
        width={CardBox.width - 2}
        height={CardBox.height - 2}
        rx="12"
        fill="var(--feudum-parchment)"
        stroke="var(--feudum-parchment-shade)"
        stroke-width="3"
    ></rect>
    {#if !writ}
        <path
            d={CrownPath}
            transform="translate({CardBox.width / 2 - 48} {CardBox.height / 2 - 48}) scale(4)"
            fill="var(--feudum-ink)"
        ></path>
    {:else}
        <text
            x={Left}
            y="44"
            fill="var(--feudum-ink)"
            font-size="26"
            style:font-family="var(--feudum-font-title)"
        >
            {#each nameRows as row, index (index)}
                <tspan x={Left} y={44 + index * 28}>{row}</tspan>
            {/each}
        </text>
        {#if 'number' in writ && writ.kind === 'turn-in'}
            {#each writ.alternatives as alternative, row (row)}
                {@const top = textTop + row * 130}
                <text
                    x={Left}
                    y={top + 20}
                    font-size="22"
                    font-weight="700"
                    fill="var(--feudum-ink)">{row === 0 ? 'A' : 'B'}</text
                >
                {#each alternative.turnedIn as good, index (index)}
                    <GoodToken {good} size={26} x={Left + 28 + index * 30} y={top} />
                {/each}
                {@render rows(wrapLines(alternative.text, 24), top + 50)}
            {/each}
        {:else if 'number' in writ}
            {@render rows(wrapLines(writ.text, 24), textTop)}
            {#each writ.guildRewards as reward, index (reward.guild)}
                <GuildIcon
                    guild={reward.guild}
                    size={44}
                    x={Left + index * 70}
                    y={CardBox.height - 100}
                    ink="var(--feudum-ink)"
                />
            {/each}
        {:else}
            {@render rows(wrapLines(writ.text, 24), textTop)}
        {/if}
    {/if}
    {#snippet over()}
        {#if sealed}
            <circle
                cx={CardBox.width / 2}
                cy={CardBox.height - 58}
                r="30"
                fill="var(--feudum-seal)"
                stroke="var(--feudum-ink)"
            ></circle>
            <path
                d={CrownPath}
                transform="translate({CardBox.width / 2 - 20} {CardBox.height - 78}) scale(1.67)"
                fill="var(--feudum-parchment)"
            ></path>
            {#if faceShown}
                <text
                    x={CardBox.width / 2}
                    y={CardBox.height - 8}
                    text-anchor="middle"
                    font-size="18"
                    fill="var(--feudum-ink)">sealed</text
                >
            {/if}
        {/if}
    {/snippet}
</PieceFrame>
