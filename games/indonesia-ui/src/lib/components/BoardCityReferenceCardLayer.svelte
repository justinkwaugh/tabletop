<script lang="ts">
    import cityImage from '$lib/images/city.svg'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        BOARD_CITY_REFERENCE_CARD_CITY_ICON_SIZE,
        BOARD_CITY_REFERENCE_CARD_CITY_ICON_TOP_INSET,
        BOARD_CITY_REFERENCE_CARD_HEIGHT,
        BOARD_CITY_REFERENCE_CARD_LABEL_BOTTOM_INSET,
        BOARD_CITY_REFERENCE_CARD_LABEL_FONT_SIZE,
        BOARD_CITY_REFERENCE_CARD_RADIUS,
        BOARD_CITY_REFERENCE_CARD_SHADOW_OFFSET_X,
        BOARD_CITY_REFERENCE_CARD_SHADOW_OFFSET_Y,
        BOARD_CITY_REFERENCE_CARD_WIDTH,
        CITY_REFERENCE_CARD_LABEL_BY_ERA,
        CITY_REFERENCE_CARD_LEFT_X,
        CITY_REFERENCE_CARD_MIDDLE_X,
        CITY_REFERENCE_CARD_RIGHT_X,
        CITY_REFERENCE_CARD_TOP_Y,
        visibleBoardCityReferenceCardEras
    } from '$lib/definitions/cityReferenceCardGeometry.js'
    import { Era } from '@tabletop/indonesia'

    const gameSession = getGameSession()

    type CityReferenceCardEntry = {
        cardId: string
        era: Era
        label: (typeof CITY_REFERENCE_CARD_LABEL_BY_ERA)[Era]
        x: number
        y: number
    }

    const cityReferenceCards: CityReferenceCardEntry[] = $derived.by(() => {
        const playerState = gameSession.myPlayerState
        if (!playerState) {
            return []
        }

        return visibleBoardCityReferenceCardEras(
            gameSession.gameState.era,
            gameSession.gameState.machineState
        )
            .map((era, index) => {
                const card = playerState.cityCards[era][0]
                if (!card) {
                    return null
                }

                return {
                    cardId: card.id,
                    era,
                    label: CITY_REFERENCE_CARD_LABEL_BY_ERA[era],
                    x:
                        index === 0
                            ? CITY_REFERENCE_CARD_LEFT_X
                            : index === 1
                              ? CITY_REFERENCE_CARD_MIDDLE_X
                              : CITY_REFERENCE_CARD_RIGHT_X,
                    y: CITY_REFERENCE_CARD_TOP_Y
                } satisfies CityReferenceCardEntry
            })
            .filter((card): card is CityReferenceCardEntry => card !== null)
    })
</script>

<g>
    {#each cityReferenceCards as card (card.cardId)}
        {@const cityIconX = card.x + (BOARD_CITY_REFERENCE_CARD_WIDTH - BOARD_CITY_REFERENCE_CARD_CITY_ICON_SIZE) / 2}
        {@const cityIconY = card.y + BOARD_CITY_REFERENCE_CARD_CITY_ICON_TOP_INSET}
        {@const labelX = card.x + BOARD_CITY_REFERENCE_CARD_WIDTH / 2}
        {@const labelY = card.y + BOARD_CITY_REFERENCE_CARD_HEIGHT - BOARD_CITY_REFERENCE_CARD_LABEL_BOTTOM_INSET}
        <rect
            x={card.x + BOARD_CITY_REFERENCE_CARD_SHADOW_OFFSET_X}
            y={card.y + BOARD_CITY_REFERENCE_CARD_SHADOW_OFFSET_Y}
            width={BOARD_CITY_REFERENCE_CARD_WIDTH}
            height={BOARD_CITY_REFERENCE_CARD_HEIGHT}
            rx={BOARD_CITY_REFERENCE_CARD_RADIUS}
            fill="rgba(94, 63, 39, 0.16)"
            pointer-events="none"
        />
        <rect
            x={card.x}
            y={card.y}
            width={BOARD_CITY_REFERENCE_CARD_WIDTH}
            height={BOARD_CITY_REFERENCE_CARD_HEIGHT}
            rx={BOARD_CITY_REFERENCE_CARD_RADIUS}
            fill="var(--board-city-reference-card-fill, #e8ddd0)"
            stroke="rgba(94, 63, 39, 0.32)"
            stroke-width="1.5"
            pointer-events="none"
        />
        <image
            href={cityImage}
            x={cityIconX}
            y={cityIconY}
            width={BOARD_CITY_REFERENCE_CARD_CITY_ICON_SIZE}
            height={BOARD_CITY_REFERENCE_CARD_CITY_ICON_SIZE}
            preserveAspectRatio="xMidYMid meet"
            pointer-events="none"
        />
        <text
            x={labelX}
            y={labelY}
            text-anchor="middle"
            font-size={BOARD_CITY_REFERENCE_CARD_LABEL_FONT_SIZE}
            font-weight="300"
            letter-spacing="0.16em"
            fill="rgba(94, 63, 39, 0.8)"
            style="text-transform: uppercase;"
            pointer-events="none"
        >
            {card.label}
        </text>
        <rect
            x={card.x}
            y={card.y}
            width={BOARD_CITY_REFERENCE_CARD_WIDTH}
            height={BOARD_CITY_REFERENCE_CARD_HEIGHT}
            rx={BOARD_CITY_REFERENCE_CARD_RADIUS}
            fill="#ffffff"
            fill-opacity="0.001"
            role="button"
            tabindex="0"
            aria-label={`Preview city card ${card.label}`}
            cursor="pointer"
            onmouseenter={() => {
                gameSession.setHoveredPlayerCityReferenceCard(card.cardId)
            }}
            onmouseleave={() => {
                gameSession.setHoveredPlayerCityReferenceCard(undefined)
            }}
            onfocus={() => {
                gameSession.setHoveredPlayerCityReferenceCard(card.cardId)
            }}
            onblur={() => {
                gameSession.setHoveredPlayerCityReferenceCard(undefined)
            }}
        />
    {/each}
</g>
