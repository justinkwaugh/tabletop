<script lang="ts">
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import { WritReference } from '$lib/model/writReference.js'
    import { writName } from '$lib/model/writLabels.js'
    import Enlargeable from './Enlargeable.svelte'
    import Scrim from './Scrim.svelte'

    /** Contract, Supply: it reads no state, so every viewer sees the same. */
    let { onClose, sheet }: { onClose: () => void; sheet?: number } = $props()

    const WritWidth = 100
    const SheetWritWidth = 84
</script>

<Scrim label="the writ reference" layer="writs" {onClose} {sheet}>
    <div class="reference" class:on-sheet={sheet !== undefined} data-writ-reference>
        <h3 class="title">Writs</h3>
        {#each WritReference as { name, writs } (name)}
            <section role="group" aria-label={name}>
                <h4>{name}</h4>
                <ul>
                    {#each writs as writId (writId)}
                        <li data-reference-writ={writId}>
                            <Enlargeable
                                tag="div"
                                label={writName(writId)}
                                face={() => ({ kind: 'writ', faceShown: true, writId })}
                            >
                                <WritFace
                                    faceShown={true}
                                    {writId}
                                    width={sheet === undefined ? WritWidth : SheetWritWidth}
                                />
                            </Enlargeable>
                        </li>
                    {/each}
                </ul>
            </section>
        {/each}
    </div>
</Scrim>

<style>
    /* Contract, Spacing: the group gap between blocks; the faces keep their art's spacing. */
    .reference {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        box-sizing: border-box;
        width: max-content;
        max-width: calc(100vw - 32px);
        padding: 0.5rem 0.75rem 0.75rem;
        border-radius: 0.5rem;
        background: var(--feudum-surface-raised);
        color: var(--feudum-text);
    }

    .reference.on-sheet {
        width: 100%;
        max-width: none;
        gap: 0.25rem;
        padding-inline: 0.5rem;
        border-radius: 0;
    }

    .title {
        margin: 0;
        padding-right: 4.5rem;
        line-height: 2rem;
        font-family: var(--feudum-font-title);
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--feudum-accent);
    }

    h4 {
        margin: 0 0 0.25rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--feudum-text-muted);
    }

    ul {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    li {
        line-height: 0;
    }
</style>
