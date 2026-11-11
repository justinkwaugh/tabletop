<script lang="ts">
    import { ActionCards, type ActionCardKind } from '@tabletop/feudum'
    import { assetUrl, cardAsset, cardBackAsset, printedCardAsset } from '$lib/art/assetMap.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { CardArt, CardBox, faceTier, shortName, wrapLines } from '$lib/utils/cardShape.js'
    import { CrownPath } from '$lib/utils/pieceShapes.js'
    import CardSymbolRow from './CardSymbolRow.svelte'
    import GoodToken from './GoodToken.svelte'
    import GuildIcon from './GuildIcon.svelte'
    import ShillingToken from './ShillingToken.svelte'

    /**
     * R-3.1 An action card. The perspective rule sets `faceShown`; a back draws from the seat alone,
     * so nothing of the card reaches the markup. While the seat shows a printed colour (`paint.printed`)
     * and the folder holds it, the card is the whole printed card in that colour, front or back.
     * Otherwise the back and the band round the art take the seat colour from the session (S71).
     * R-3.5 One component by width.
     */
    let {
        faceShown,
        kind,
        paint,
        number,
        width,
        x,
        y
    }: {
        faceShown: boolean
        kind?: ActionCardKind
        paint: SeatPaint
        number?: number
        width: number
        x?: number
        y?: number
    } = $props()

    let tier = $derived(faceTier(width))
    let height = $derived((width * CardBox.height) / CardBox.width)
    let viewBox = `0 0 ${CardBox.width} ${CardBox.height}`
    let card = $derived(faceShown ? ActionCards.find((one) => one.kind === kind) : undefined)
    let label = $derived(
        card ? `${card.printedName} card, ${paint.initial}` : `${paint.initial} card back`
    )
    let url = $derived(card ? assetUrl(cardAsset(card.kind)) : undefined)
    let printedUrl = $derived.by(() => {
        const printed = paint.printed
        if (!printed) {
            return undefined
        }
        return assetUrl(card ? printedCardAsset(card.kind, printed) : cardBackAsset(printed))
    })
    /**
     * Over the print: the number on the border's foot, and on a compact face its short name across
     * the foot, over the name line in the print's other languages, where the print's own name is too
     * small to read. A standard or full face leaves the name to the print, whose top symbols a plate
     * would cover; the accessible name carries it at every size.
     */
    const PrintedNumber = { x: 30, y: 352, r: 17 }
    const PrintedPlate = { x: 12, y: 310, width: 226, height: 60, font: 42, text: 145 } as const
    const Body = { x: CardArt.x + 10, right: CardArt.x + CardArt.width - 10 }
    let actionRows = $derived(card ? wrapLines(card.regularAction, 26) : [])
    let effectRows = $derived(card ? wrapLines(card.special.effect, 28) : [])
    let actionTop = 112
    let specialTop = $derived(actionTop + actionRows.length * 22 + 18)
</script>

<svg {x} {y} {width} {height} {viewBox} role="img" aria-label={label}>
    <title>{label}</title>
    {#if printedUrl}
        <image
            href={printedUrl}
            x="0"
            y="0"
            width={CardBox.width}
            height={CardBox.height}
            preserveAspectRatio="none"
        ></image>
        {#if card}
            {#if tier === 'compact'}
                {@const plate = PrintedPlate}
                <rect
                    x={plate.x}
                    y={plate.y}
                    width={plate.width}
                    height={plate.height}
                    rx="8"
                    fill="var(--feudum-parchment)"
                    stroke="var(--feudum-parchment-shade)"
                    stroke-width="2"
                ></rect>
                <text
                    x={plate.text}
                    y={plate.y + plate.height / 2 + plate.font * 0.35}
                    text-anchor="middle"
                    font-size={plate.font}
                    fill="var(--feudum-ink)"
                    style:font-family="var(--feudum-font-title)">{shortName(card.printedName)}</text
                >
            {/if}
            <circle
                cx={PrintedNumber.x}
                cy={PrintedNumber.y}
                r={PrintedNumber.r}
                fill={paint.fill}
                stroke={paint.edge}
                stroke-width="2"
            ></circle>
            <text
                x={PrintedNumber.x}
                y={PrintedNumber.y + 7}
                text-anchor="middle"
                font-size="19"
                font-weight="700"
                fill={paint.ink}>{number}</text
            >
        {/if}
    {:else}
        <rect
            x="1"
            y="1"
            width={CardBox.width - 2}
            height={CardBox.height - 2}
            rx="14"
            fill={paint.fill}
            stroke={paint.edge}
            stroke-width="2"
        ></rect>
        {#if !card}
            <rect
                x={CardArt.x}
                y={CardArt.y}
                width={CardArt.width}
                height={CardArt.height}
                rx="10"
                fill="none"
                stroke="var(--feudum-parchment)"
                stroke-width="4"
            ></rect>
            <path
                d={CrownPath}
                transform="translate({CardBox.width / 2 - 60} {CardBox.height / 2 - 60}) scale(5)"
                fill="var(--feudum-parchment)"
            ></path>
        {:else}
            {#if url}
                <image
                    href={url}
                    x={CardArt.x}
                    y={CardArt.y}
                    width={CardArt.width}
                    height={CardArt.height}
                    preserveAspectRatio="xMidYMid meet"
                ></image>
            {:else}
                <rect
                    x={CardArt.x}
                    y={CardArt.y}
                    width={CardArt.width}
                    height={CardArt.height}
                    rx="10"
                    fill="var(--feudum-parchment)"
                    stroke="var(--feudum-parchment-shade)"
                    stroke-width="2"
                ></rect>
                <text
                    x={Body.x}
                    y="88"
                    font-size={tier === 'compact' ? 42 : 30}
                    fill="var(--feudum-ink)"
                    style:font-family="var(--feudum-font-title)"
                    >{tier === 'compact' ? shortName(card.printedName) : card.printedName}</text
                >
                <CardSymbolRow {card} right={Body.right} y={24} />
                {#if tier !== 'compact'}
                    <text
                        fill="var(--feudum-ink)"
                        font-size="19"
                        style:font-family="var(--feudum-font-text)"
                    >
                        {#each actionRows as row, index (index)}
                            <tspan x={Body.x} y={actionTop + index * 22}>{row}</tspan>
                        {/each}
                    </text>
                {/if}
                {#if tier === 'full'}
                    <line
                        x1={Body.x}
                        x2={Body.right}
                        y1={specialTop - 18}
                        y2={specialTop - 18}
                        stroke="var(--feudum-parchment-shade)"
                        stroke-width="2"
                    ></line>
                    <text
                        x={Body.x}
                        y={specialTop + 6}
                        font-size="22"
                        fill="var(--feudum-ink)"
                        style:font-family="var(--feudum-font-title)">{card.special.name}</text
                    >
                    {#each card.special.needs as need, index (index)}
                        {@const needX = Body.x + index * 34}
                        {@const needY = specialTop + 14}
                        {#if need.kind === 'good'}
                            <GoodToken good={need.good} size={28} x={needX} y={needY} />
                        {:else if need.kind === 'barrel-sulfur'}
                            <GoodToken good="sulfur" size={28} x={needX} y={needY} />
                        {:else if need.kind === 'shillings'}
                            <ShillingToken value={1} size={28} x={needX} y={needY} />
                        {:else}
                            <GuildIcon
                                guild={need.character}
                                size={28}
                                x={needX}
                                y={needY}
                                ink="var(--feudum-ink)"
                            />
                        {/if}
                    {/each}
                    <text
                        fill="var(--feudum-ink)"
                        font-size="17"
                        style:font-family="var(--feudum-font-text)"
                    >
                        {#each effectRows as row, index (index)}
                            <tspan x={Body.x} y={specialTop + 62 + index * 20}>{row}</tspan>
                        {/each}
                    </text>
                {/if}
            {/if}
            <circle cx="30" cy="30" r="20" fill={paint.fill} stroke={paint.edge} stroke-width="2"
            ></circle>
            <text
                x="30"
                y="38"
                text-anchor="middle"
                font-size="22"
                font-weight="700"
                fill={paint.ink}>{number}</text
            >
            {#if url && tier === 'compact'}
                <rect
                    x={CardArt.x}
                    y={CardBox.height - 90}
                    width={CardArt.width}
                    height="70"
                    fill="var(--feudum-parchment)"
                ></rect>
                <text
                    x={CardBox.width / 2}
                    y={CardBox.height - 40}
                    text-anchor="middle"
                    font-size="42"
                    fill="var(--feudum-ink)"
                    style:font-family="var(--feudum-font-title)">{shortName(card.printedName)}</text
                >
            {/if}
        {/if}
    {/if}
</svg>
