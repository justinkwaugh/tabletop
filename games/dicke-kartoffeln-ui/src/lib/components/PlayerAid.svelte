<script lang="ts">
    import { MAX_WORMS, VARIETIES, yieldChartRow } from '@tabletop/dicke-kartoffeln'
    import type { Attachment } from 'svelte/attachments'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { compactTable } from '$lib/utils/tableLayout.svelte.js'

    const gameSession = getGameSession()
    const wormCounts = Array.from({ length: MAX_WORMS + 1 }, (_, worms) => worms)

    const PRICE_CHANGES = [
        ['0', '0'],
        ['1', '1'],
        ['2–3', '2'],
        ['4 and more', '3']
    ]

    const holdFocus: Attachment<HTMLElement> = (aid) => {
        const opener = document.activeElement
        aid.focus()
        return () => {
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
        }
    }

    function closeOnEscape(event: KeyboardEvent) {
        if (event.key !== 'Escape') return
        event.preventDefault()
        gameSession.closePlayerAid()
    }
</script>

<svelte:window onkeydown={closeOnEscape} />

{#snippet heading(number: string, title: string)}
    <h3><span class="number">{number}</span>{title}</h3>
{/snippet}

<div
    class="backdrop"
    class:compact={compactTable.current}
    role="presentation"
    onclick={() => gameSession.closePlayerAid()}
>
    <div
        class="aid"
        class:compact={compactTable.current}
        role="dialog"
        aria-label="Player aid"
        tabindex="-1"
        {@attach holdFocus}
        onclick={(event) => event.stopPropagation()}
        onkeydown={closeOnEscape}
    >
        <button
            type="button"
            class="close"
            aria-label="Close the player aid"
            onclick={() => gameSession.closePlayerAid()}>×</button
        >
        <article class="page">
            <h2>Annual Review</h2>

            <section>
                {@render heading('0.', 'Game preparation')}
                <p>Per player: 1 farm, 800 marks starting capital, 1 profit form.</p>
                <p>
                    Per field: 3 rain worms, 1 sunflower. The banker receives the potato money and
                    loans. The chemist receives the fertilizer, poison and skull and crossbones. The
                    dealer manages the seeds. The biologist takes the worms and sunflowers. The
                    stock-market expert receives the messages and prepares the potato market.
                </p>
            </section>

            <section>
                {@render heading('1.', 'Taking compost')}
                <p>
                    From the fields, an optional number of worms are to be placed on the compost
                    field No. 1.
                </p>
                <p>Costs: 100 marks per field, from which at least 1 worm is to be taken.</p>
            </section>

            <section>
                {@render heading('2.1', 'Cultivating')}
                <p>
                    Cultivation of the fields is carried out by purchasing and placing furrows.
                    Existing worms, sunflowers and skull and crossbones are to be placed in the
                    furrows.
                </p>
                <p>Costs: 40 marks per furrow.</p>
            </section>

            <section>
                {@render heading('2.2', 'Ordering fields')}
                <p>Purchase of seeds and placing them on the fields.</p>
                <p>Costs: Depending on the type and trend for NORM on the potato market.</p>
            </section>

            <section>
                {@render heading('3.1', 'Fertilizing')}
                <p>
                    1 sack of fertilizer for healthy fields, 2 sacks per field with skull and
                    crossbones.
                </p>
                <p>Costs: 100 marks per sack of fertilizer.</p>
            </section>

            <section>
                {@render heading('3.2', 'Spraying poison')}
                <p>
                    Purchase and placing of insecticides (poisonous clouds), maximum of 1 cloud per
                    field.
                </p>
                <p>Costs: 100 marks per poisonous cloud.</p>
            </section>

            <section>
                {@render heading('4.', 'Sunflowers')}
                <ul>
                    <li>
                        Fields without fertilizer, poison or skull and crossbones, receive 1
                        sunflower.
                    </li>
                    <li>Fields with fertilizer or poison, lose all sunflowers.</li>
                    <li>Fields without worms also lose all sunflowers.</li>
                </ul>
                <p>ATTENTION: Never more than 3 sunflowers per field!</p>
            </section>

            <section>
                {@render heading('5.', 'Messages')}
                <p>
                    Throw the dice once: The message card on the corresponding message field takes
                    effect — activity according to the instructions on the card.
                </p>
            </section>

            <div class="beside">
                <div>
                    <section>
                        {@render heading('6.1', 'Harvest')}
                        <p>
                            Calculate the profits per field according to type, worms, fertilizer,
                            and any possible messages using the following profit table. Enter this
                            into the profit form.
                        </p>
                    </section>
                    <section>
                        {@render heading('6.2', 'Registering a sale')}
                        <p>
                            Enter sales desires, divided according to BIO and NORM. BIO-sales are
                            only possible with fields with 3 sunflowers.
                        </p>
                        <p>Costs: 100 marks per field from which sales are being carried out.</p>
                    </section>
                </div>
                <figure class="yields">
                    <figcaption>Yields <small>(in sacks)</small></figcaption>
                    <table>
                        <thead>
                            <tr>
                                <th colspan="2" class="caption">Number of worms</th>
                                {#each wormCounts as worms (worms)}
                                    <th class="count">{worms}</th>
                                {/each}
                            </tr>
                        </thead>
                        {#each VARIETIES as variety (variety)}
                            <tbody>
                                {#each [true, false] as fertilized (fertilized)}
                                    <tr>
                                        {#if fertilized}
                                            <th rowspan="2" class="variety">{variety}</th>
                                        {/if}
                                        <th class="treatment"
                                            >{fertilized ? 'fertilized' : 'unfertilized'}</th
                                        >
                                        {#each yieldChartRow(variety, fertilized) as sacks, worms (worms)}
                                            <td>{sacks}</td>
                                        {/each}
                                    </tr>
                                {/each}
                            </tbody>
                        {/each}
                    </table>
                </figure>
            </div>

            <section>
                {@render heading('7.', 'New calculation of price and demand')}
                <div class="beside">
                    <div>
                        <p>
                            Single calculations of each type according to BIO and NORM: Addition of
                            all offers of one type — change of the demand — correction of the price
                            on the market.
                        </p>
                        <p>
                            ATTENTION! Also carry out calculations if there is no offer. Then the
                            demand is zero and the price is according to the difference.
                        </p>
                    </div>
                    <table class="boxed prices">
                        <tbody>
                            {#each PRICE_CHANGES as [difference, change] (difference)}
                                <tr>
                                    <td>Difference = {difference}</td>
                                    <td>Price change = {change}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </section>
        </article>

        <article class="page">
            <section>
                {@render heading('8.', 'Sales')}
                <p>
                    Individual profit calculation according to the new prices and payment of the
                    money by the banker.
                </p>
            </section>

            <section>
                {@render heading('9.', 'Reaction of the soil')}
                <ul>
                    <li>
                        Fields with fertilizer and/or poison receive one skull and crossbones (as
                        long as one is not already on hand).
                    </li>
                    <li>
                        Fields with skull and crossbones but without poison and fertilizer lose the
                        skull and crossbones.
                    </li>
                    <li>
                        Fields lying fallow (without seeds) with at least 1 worm receive an
                        additional worm (up to maximum of 5 worms).
                    </li>
                    <li>
                        For the seeds, the poisonous cloud and each sack of fertilizer, one worm
                        respectively is taken away from the field in question.
                    </li>
                    <li>
                        All game figures (also furrows) except for skull and crossbones, sunflowers
                        and remaining worms, are to be taken away from the fields.
                    </li>
                </ul>
            </section>

            <section>
                {@render heading('10.', 'Using compost')}
                <p>Two-year old compost piles have to be fully used up:</p>
                <ul>
                    <li>Sell to the bank — fixed price of 60 marks per worm.</li>
                    <li>Sell to another player — price to be negotiated.</li>
                    <li>
                        Move to another own field — Costs: 100 marks per field that contains worms.
                    </li>
                </ul>
                <p>
                    A field may never have more than 5 worms! A direct moving of compost No. 2 to
                    compost No. 1 is not possible!
                </p>
            </section>

            <section>
                {@render heading('11.', 'Moving compost')}
                <p>
                    All worms from compost pile No. 1 are shifted to No. 2 — with this, the worms
                    are doubled.
                </p>
            </section>

            <section>
                {@render heading('12.', 'End of the year')}
                <p>
                    Debts must be paid off. If this is not possible, 20 % interest (100 marks per
                    loan) is to be paid to the bank.
                </p>
                <p>
                    The game can end after the 12th round has been completed. Determine the winner
                    according to the following tables:
                </p>
            </section>

            <div class="scoring">
                <h4>The „economy“ winner</h4>
                <div class="box">
                    <dl>
                        <dt>Take</dt>
                        <dd>the cash</dd>
                        <dt>subtract</dt>
                        <dd>the debts</dd>
                        <dt>add</dt>
                        <dd>40 times the „good fields“ (with at least 3 worms and 2 sunflowers)</dd>
                        <dt>add</dt>
                        <dd>50 times the total number of worms</dd>
                    </dl>
                    <p>The economic winner is the player with the highest profit.</p>
                </div>

                <h4>The „ecology“ winner</h4>
                <div class="box">
                    <dl>
                        <dt>Take</dt>
                        <dd>3 times the number of worms on the fields</dd>
                        <dt>add</dt>
                        <dd>2 times the number of worms on the compost piles</dd>
                        <dt>add</dt>
                        <dd>2 times the number of sunflowers</dd>
                        <dt>add</dt>
                        <dd>
                            5 times the number of „good fields“ (with at least 3 worms and 2
                            sunflowers)
                        </dd>
                        <dt>subtract</dt>
                        <dd>10 times the number of „bad fields“ (without worms)</dd>
                    </dl>
                    <p>
                        The „ecology“ winner is the player with the highest value. Possibly subtract
                        55 points (the biological value of the country at the beginning of the
                        game). With a negative result, biological cultivation was completely
                        unsuccessful.
                    </p>
                </div>

                <h4>The overall winner</h4>
                <div class="box">
                    <p>Add the winning points in the branches of economy and ecology</p>
                    <div class="places">
                        <div>
                            <b>Economy</b>
                            <span>1st place — 6 points</span>
                            <span>2nd place — 4 points</span>
                            <span>3rd place — 3 points</span>
                            <span>4th place — 2 points</span>
                            <span>5th place — 1 point</span>
                        </div>
                        <div>
                            <b>Ecology</b>
                            <span>1st place — 4 points</span>
                            <span>2nd place — 3 points</span>
                            <span>3rd place — 2 points</span>
                            <span>4th place — 1 point</span>
                        </div>
                    </div>
                    <dl>
                        <dt>ATTENTION:</dt>
                        <dd>
                            With negative values in the branch of ecology there are no winning
                            points.
                        </dd>
                    </dl>
                    <p>The player with the most winning points wins the game.</p>
                </div>
            </div>
        </article>
    </div>
</div>

<style>
    .backdrop {
        position: absolute;
        inset: 0;
        z-index: 40;
        overflow: auto;
        background: rgba(46, 27, 12, 0.55);
        padding: 12px;
    }

    /* Two pages side by side, the same height; the right page drops below on narrow windows. */
    .aid {
        position: relative;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(540px, 100%), 1fr));
        gap: 16px;
        max-width: 1500px;
        margin: 0 auto;
        outline: none;
        color: #1b1b1b;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 17px;
        line-height: 1.35;
    }

    .close {
        position: absolute;
        z-index: 1;
        top: 8px;
        right: 8px;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: #6e3b1c;
        color: #fff6dc;
        font-size: 24px;
        line-height: 1;
    }

    .page {
        border-radius: 3px;
        background: #fbfaf6;
        padding: 24px 30px 28px;
        box-shadow: 0 4px 14px rgba(40, 30, 10, 0.4);
    }

    h2 {
        margin-bottom: 8px;
        font-size: 38px;
        font-weight: 800;
        letter-spacing: 0.24em;
        line-height: 1;
        text-transform: uppercase;
    }

    section {
        margin-top: 10px;
    }

    h3 {
        display: flex;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.15;
    }

    .number {
        flex: none;
        width: 44px;
    }

    p,
    ul {
        margin-left: 44px;
    }

    li {
        padding-left: 1.3em;
        text-indent: -1.3em;
    }

    li::before {
        content: '— ';
    }

    .beside {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: start;
        gap: 18px;
    }

    .yields {
        margin-top: 10px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
    }

    figcaption {
        font-size: 26px;
        line-height: 1;
        text-align: center;
        text-transform: uppercase;
    }

    figcaption small {
        font-size: 16px;
    }

    table {
        border-collapse: collapse;
    }

    .yields table {
        border: 3px double #1b1b1b;
    }

    .yields tbody {
        border-top: 3px double #1b1b1b;
    }

    .yields th,
    .yields td {
        border: 1.5px solid #1b1b1b;
        padding: 1px 6px;
        text-align: center;
    }

    .yields th {
        font-weight: 400;
    }

    .yields .caption,
    .yields .treatment {
        font-size: 13px;
        text-align: right;
        text-transform: uppercase;
    }

    .yields .variety {
        border-right: none;
        font-size: 24px;
        text-transform: uppercase;
    }

    .yields .treatment {
        border-left: none;
    }

    .yields .count,
    .yields td {
        width: 34px;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 20px;
        font-weight: 700;
    }

    .boxed {
        border: 2px solid #1b1b1b;
    }

    .prices {
        margin-top: 4px;
    }

    .prices td {
        padding: 4px 16px;
        white-space: nowrap;
    }

    .prices td + td {
        border-left: 2px solid #1b1b1b;
    }

    .scoring {
        display: grid;
        grid-template-columns: 170px 1fr;
        gap: 14px 12px;
        margin-top: 12px;
    }

    h4 {
        padding-left: 6px;
        font-weight: 700;
    }

    .box {
        border: 2px solid #1b1b1b;
        padding: 6px 14px 8px;
    }

    .box p {
        margin-left: 0;
    }

    dl {
        display: grid;
        grid-template-columns: 110px 1fr;
    }

    .places {
        display: grid;
        grid-template-columns: 1fr 1fr;
        margin: 2px 0 4px 110px;
    }

    .places div {
        display: flex;
        flex-direction: column;
    }

    .places b {
        font-weight: 400;
    }

    /* A phone reads the aid as one scrolling page: no indents, smaller type, tables at text width. */
    .backdrop.compact {
        padding: 6px;
    }

    .aid.compact {
        display: block;
        border-radius: 3px;
        background: #fbfaf6;
        box-shadow: 0 4px 14px rgba(40, 30, 10, 0.4);
        font-size: 15px;
        line-height: 1.45;
    }

    .compact .close {
        position: sticky;
        float: right;
        top: 8px;
        margin: 8px 8px -34px 0;
    }

    .compact .page {
        border-radius: 0;
        box-shadow: none;
        padding: 14px 16px;
    }

    .compact .page + .page {
        padding-top: 0;
    }

    .compact h2 {
        margin-right: 40px;
        font-size: 24px;
        letter-spacing: 0.12em;
    }

    .compact section {
        margin-top: 14px;
    }

    .compact h3 {
        display: block;
        margin-bottom: 2px;
        font-size: 16px;
    }

    .compact .number {
        width: auto;
        margin-right: 0.4em;
    }

    .compact p,
    .compact ul {
        margin-left: 0;
    }

    .compact li {
        padding-left: 0;
        text-indent: 0;
    }

    .compact .beside {
        display: block;
    }

    .compact .yields {
        margin-top: 14px;
    }

    .compact figcaption {
        font-size: 20px;
    }

    .compact figcaption small {
        font-size: 13px;
    }

    .compact table {
        width: 100%;
    }

    .compact .yields th,
    .compact .yields td {
        padding: 1px 3px;
    }

    .compact .yields .caption,
    .compact .yields .treatment {
        font-size: 10px;
    }

    .compact .yields .variety {
        font-size: 15px;
    }

    .compact .yields .count,
    .compact .yields td {
        width: auto;
        font-size: 15px;
    }

    .compact .prices {
        margin-top: 8px;
    }

    .compact .prices td {
        padding: 3px 6px;
        font-size: 13px;
        white-space: normal;
    }

    .compact .scoring {
        display: block;
    }

    .compact h4 {
        margin: 14px 0 4px;
        padding-left: 0;
    }

    .compact .box {
        padding: 6px 10px 8px;
    }

    .compact dl {
        grid-template-columns: 72px 1fr;
    }

    .compact .places {
        margin-left: 0;
    }
</style>
