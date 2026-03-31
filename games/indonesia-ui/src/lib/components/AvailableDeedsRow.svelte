<script lang="ts">
    import CompanyDeed from '$lib/components/CompanyDeed.svelte'
    import { COMPANY_DEED_ASPECT_RATIO } from '$lib/definitions/companyDeedGeometry.js'
    import { availableDeedCardEntriesForState } from '$lib/utils/deedCardEntries.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    const gameSession = getGameSession()

    const ROW_CARD_HEIGHT = 80
    const ROW_CARD_WIDTH = ROW_CARD_HEIGHT * COMPANY_DEED_ASPECT_RATIO
    const ROW_CARD_FRAME_WIDTH = ROW_CARD_WIDTH + 8
    const ROW_CARD_FRAME_HEIGHT = ROW_CARD_HEIGHT + 8

    const DEED_ORDER_BY_KIND = {
        ship: 0,
        rice: 1,
        spice: 2,
        rubber: 3,
        oil: 4,
        siapsaji: 5
    } as const

    const hoveredAvailableDeedId = $derived(gameSession.hoveredAvailableDeedId)
    const selectedStartCompanyDeedId = $derived(gameSession.selectedStartCompanyDeedId)
    const startCompanySelectionEnabled = $derived(gameSession.startCompanySelectionEnabled)

    const availableDeedEntries = $derived.by(() => {
        return availableDeedCardEntriesForState(gameSession.gameState)
            .slice()
            .sort((a, b) => {
                const orderDifference =
                    DEED_ORDER_BY_KIND[a.cardKind] - DEED_ORDER_BY_KIND[b.cardKind]
                if (orderDifference !== 0) {
                    return orderDifference
                }

                const xDifference = a.cardX - b.cardX
                if (xDifference !== 0) {
                    return xDifference
                }

                const yDifference = a.cardY - b.cardY
                if (yDifference !== 0) {
                    return yDifference
                }

                return a.deedId.localeCompare(b.deedId)
            })
    })
</script>

{#if availableDeedEntries.length > 0}
    <section class="available-deeds-row" aria-label="Available deeds">
        <div class="available-deeds-row__label">Available Deeds</div>
        <div
            class="available-deeds-row__cards"
            onpointerleave={() => {
                gameSession.clearHoveredAvailableDeed()
            }}
        >
            {#each availableDeedEntries as deed (deed.deedId)}
                <div
                    class="available-deeds-row__card"
                    class:is-hovered={hoveredAvailableDeedId === deed.deedId}
                    class:is-selected={selectedStartCompanyDeedId === deed.deedId}
                    tabindex={startCompanySelectionEnabled ? 0 : -1}
                    role={startCompanySelectionEnabled ? 'button' : 'img'}
                    aria-label={`Available deed for ${deed.text}`}
                    aria-pressed={startCompanySelectionEnabled
                        ? selectedStartCompanyDeedId === deed.deedId
                        : undefined}
                    onpointerenter={() => {
                        gameSession.hoverAvailableDeed(deed.deedId)
                    }}
                    onpointerleave={() => {
                        if (hoveredAvailableDeedId === deed.deedId) {
                            gameSession.clearHoveredAvailableDeed()
                        }
                    }}
                    onfocus={() => {
                        gameSession.hoverAvailableDeed(deed.deedId)
                    }}
                    onblur={() => {
                        if (hoveredAvailableDeedId === deed.deedId) {
                            gameSession.clearHoveredAvailableDeed()
                        }
                    }}
                    onclick={() => {
                        if (!startCompanySelectionEnabled) {
                            return
                        }
                        gameSession.stageStartCompanyDeed(deed.deedId)
                    }}
                    onkeydown={(event) => {
                        if (!startCompanySelectionEnabled) {
                            return
                        }
                        if (event.key !== 'Enter' && event.key !== ' ') {
                            return
                        }
                        event.preventDefault()
                        gameSession.stageStartCompanyDeed(deed.deedId)
                    }}
                >
                    <svg
                        class="available-deeds-row__card-svg"
                        viewBox={`0 0 ${ROW_CARD_FRAME_WIDTH} ${ROW_CARD_FRAME_HEIGHT}`}
                        width={ROW_CARD_FRAME_WIDTH}
                        height={ROW_CARD_FRAME_HEIGHT}
                        aria-hidden="true"
                    >
                        <CompanyDeed
                            type={deed.cardKind}
                            x={ROW_CARD_FRAME_WIDTH / 2}
                            y={ROW_CARD_FRAME_HEIGHT / 2}
                            height={ROW_CARD_HEIGHT}
                            text={deed.text}
                            textLayout={deed.textLayout}
                            shippingSizes={deed.shippingSizes}
                        />
                    </svg>
                </div>
            {/each}
        </div>
    </section>
{/if}

<style>
    .available-deeds-row {
        width: 2646px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 6px 0 0;
    }

    .available-deeds-row__label {
        align-self: flex-start;
        margin-top: 12px;
        color: rgba(94, 63, 39, 0.92);
        font-family: 'Avenir Next', 'Helvetica Neue', sans-serif;
        font-size: 28px;
        font-weight: 300;
        line-height: 1;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .available-deeds-row__cards {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: flex-start;
        gap: 18px;
        min-height: 92px;
    }

    .available-deeds-row__card {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border-radius: 12px;
        outline: none;
        cursor: default;
        transition:
            transform 120ms ease,
            filter 120ms ease,
            box-shadow 120ms ease;
    }

    .available-deeds-row__card:hover,
    .available-deeds-row__card:focus-visible,
    .available-deeds-row__card.is-hovered {
        transform: translateY(-3px) scale(1.02);
        filter: saturate(1.05);
        box-shadow: 0 6px 18px rgba(79, 58, 37, 0.18);
    }

    .available-deeds-row__card.is-selected {
        box-shadow:
            0 0 0 4px rgba(255, 248, 215, 0.92),
            0 0 0 6px rgba(31, 41, 55, 0.88),
            0 6px 18px rgba(79, 58, 37, 0.12);
    }

    .available-deeds-row__card-svg {
        display: block;
        overflow: visible;
    }
</style>
