<script lang="ts">
    import { withArticle } from '$lib/utils/actionDescription.js'
    import ChoiceButton from './ChoiceButton.svelte'
    import { polypFaceUrl } from '$lib/utils/polypFaces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<p class="prompt reef-display">Feed one of your polyps to your parrotfish</p>
<p class="detail">No one else sees its colour until the game ends.</p>
<div class="choices">
    {#each gameSession.feedableColors as color (color)}
        <ChoiceButton
            label="Feed {withArticle(color)} polyp"
            onclick={() => gameSession.feedParrotfish(color)}
        >
            <img src={polypFaceUrl(color, 'choice')} alt="" width="44" height="44" />
        </ChoiceButton>
    {/each}
</div>

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
    }

    img {
        border-radius: 4px;
    }
</style>
