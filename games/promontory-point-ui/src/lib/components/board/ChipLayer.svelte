<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { SpaceId } from '@tabletop/promontory-point'
    import { ChipKind, type EffectChip } from '$lib/model/boardOffer.js'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HEX } from '$lib/utils/boardGeometry.js'
    import { ChipPlacement, chipPlacement, spaceCentre } from '$lib/utils/boardLayout.js'

    type Chip = { spaceId: SpaceId; text: string; cost: boolean }

    const gameSession = getGameSession()
    const HEIGHT = 56

    const offer = $derived(gameSession.boardOffer)

    // O-3: the deciding seat's payout or bill; R-4.3: the Repairs town being decided is named.
    const chips: Chip[] = $derived(
        [...offer.hexes].flatMap(([spaceId, hex]): Chip[] => {
            if (hex.beingDecided !== undefined) {
                return [
                    { spaceId, text: `Repairs · ${RAILROAD_TAGS[hex.beingDecided]}`, cost: true }
                ]
            }
            return hex.chip === undefined ? [] : [{ spaceId, ...effectChip(hex.chip) }]
        })
    )

    function effectChip(chip: EffectChip): Omit<Chip, 'spaceId'> {
        return chip.kind === ChipKind.Dividend
            ? { text: `you +$${chip.dollars}`, cost: false }
            : { text: `you pay $${chip.dollars}`, cost: true }
    }

    function anchor(spaceId: SpaceId): Point {
        const centre = spaceCentre(spaceId)
        const offset = HEX.yRadius + HEIGHT / 2 - 4
        switch (chipPlacement(spaceId, offer.lit)) {
            case ChipPlacement.Above:
                return { x: centre.x, y: centre.y - offset }
            case ChipPlacement.Below:
                return { x: centre.x, y: centre.y + offset }
            case ChipPlacement.Inside:
                return { x: centre.x, y: centre.y + HEX.yRadius * 0.45 }
        }
    }
</script>

<!-- Chips sit over the hit targets but never take a press, so an overhang never steals one. -->
<g class="pointer-events-none">
    {#each chips as { spaceId, text, cost } (spaceId)}
        {@const at = anchor(spaceId)}
        {@const width = text.length * 21 + 36}
        <g transform="translate({at.x} {at.y})" data-chip={spaceId}>
            <rect
                x={-width / 2}
                y={-HEIGHT / 2}
                {width}
                height={HEIGHT}
                rx={HEIGHT / 2}
                fill={cost ? 'var(--pp-cost)' : 'var(--pp-gain)'}
                stroke="var(--pp-halo)"
                stroke-width="7"
            ></rect>
            <text
                class="chip-text"
                font-size="36"
                fill={cost ? 'var(--pp-cost-ink)' : 'var(--pp-ink)'}>{text}</text
            >
        </g>
    {/each}
</g>

<style>
    .chip-text {
        text-anchor: middle;
        dominant-baseline: central;
        font-family: Oswald, sans-serif;
        font-weight: 600;
    }
</style>
