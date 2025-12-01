<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import ExpansionCard from '$lib/images/expansionCard.png'
    import CondensationCard from '$lib/images/condensationCard.png'
    import OscillationCard from '$lib/images/oscillationCard.png'
    import RefractionCard from '$lib/images/refractionCard.png'
    import ReverberationCard from '$lib/images/reverberationCard.png'
    import SolarFlareCard from '$lib/images/solarFlareCard.png'
    import SubductionCard from '$lib/images/subductionCard.png'
    import { Suit } from '@tabletop/sol'

    let gameSession = getContext('gameSession') as SolGameSession

    const cardsBySuit = $derived.by(() => {
        const myPlayerState = gameSession.myPlayerState
        if (!myPlayerState || !myPlayerState.drawnCards) {
            return {}
        }

        const suits: Record<string, number> = {}
        for (const card of myPlayerState.drawnCards) {
            if (!suits[card.suit]) {
                suits[card.suit] = 0
            }
            suits[card.suit]++
        }
        return suits
    })

    function cardImageForSuit(suit: string) {
        switch (suit) {
            case Suit.Condensation:
                return `url(${CondensationCard})`
            case Suit.Oscillation:
                return `url(${OscillationCard})`
            case Suit.Refraction:
                return `url(${RefractionCard})`
            case Suit.Reverberation:
                return `url(${ReverberationCard})`
            case Suit.Expansion:
                return `url(${ExpansionCard})`
            case Suit.Subduction:
                return `url(${SubductionCard})`
            case Suit.Flare:
                return `url(${SolarFlareCard})`
            default:
                return ''
        }
    }
</script>

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2">
    {#each Object.entries(cardsBySuit) as [suit, count] (suit)}
        <div class="flex flex-col justify-center items-center">
            <div
                class="w-[69px] h-[100px] bg-white bg-cover border border-black rounded-lg flex justify-center items-center text-2xl font-bold"
                style="background-image: {cardImageForSuit(suit)}"
            ></div>
        </div>
    {/each}
</div>
