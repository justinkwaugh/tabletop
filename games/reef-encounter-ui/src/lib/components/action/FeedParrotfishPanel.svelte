<script lang="ts">
    import { withArticle } from '$lib/utils/actionDescription.js'
    import ChoiceButton from './ChoiceButton.svelte'
    import { polypFace } from '$lib/utils/polypFaces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<p class="prompt reef-display">Feed one of your polyps to your parrotfish</p>
<p class="detail">No one else sees its colour until the game ends.</p>
<div class="choices">
    {#each gameSession.feedableColors as color (color)}
        <ChoiceButton
            tile
            label="Feed {withArticle(color)} polyp"
            onclick={() => gameSession.feedParrotfish(color)}
        >
            {@const face = polypFace(color, 'choice')}
            <img src={face.url} class:mirrored={face.mirrored} alt="" width="52" height="52" />
        </ChoiceButton>
    {/each}
</div>

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
    }

    .mirrored {
        scale: -1 1;
    }

    img {
        display: block;
    }
</style>
