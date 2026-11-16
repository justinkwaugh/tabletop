import { flushSync } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionType, MachineState, placeMarker, playMandateOffers } from '@tabletop/feudum'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import {
    blockOf,
    linesOf,
    primariesOf,
    primaryLabels,
    primaryNames,
    primaryNamed,
    pressRow,
    pressCard,
    rowLabels,
    rowNamed,
    rowsOf
} from '$lib/testing/actionPanelView.js'
import { askedToDefend, askedToStarve, stagedConquer } from '$lib/testing/askTable.js'
import {
    atCollecting,
    atNourishing,
    fillBarrel,
    holdFood,
    holdWrit,
    seatedAtCards,
    sealMarker,
    threePawns
} from '$lib/testing/followUpTable.js'
import { settled, type FeudumHost } from '$lib/testing/sessionHarness.js'
import { emptySpaces, giveGood, giveSeal, giveTile, returnGoods } from '$lib/testing/turnTable.js'
import { pawnTarget, spaceTarget, type BoardTarget } from './boardOffer.js'
import { tileName } from './tileName.js'
import type { FeudumGameSession } from './session.svelte.js'

let host: FeudumHost | undefined

function hold<T extends { host: FeudumHost }>(table: T): T {
    host = table.host
    return table
}

afterEach(() => {
    host?.close()
    host = undefined
})

function lastByUser(table: { host: FeudumHost }): GameAction | undefined {
    return table.host.actions.findLast(({ source }) => source === ActionSource.User)
}

async function send(session: FeudumGameSession, label: string | RegExp) {
    await primaryNamed(session.actionPanel, label).send()
    await settled(session)
    flushSync()
}

function noteLines(session: FeudumGameSession) {
    return linesOf(session.actionPanel, 'note')
}

function lit(row: { choice: { lights?: () => readonly BoardTarget[] } }) {
    return row.choice.lights?.() ?? []
}

describe('R-3.14.1 S32 to S34 the ask to defend, as drawn', () => {
    it('S32 the attacker reads the chip and "may answer"; once sent, no Undo and the asked seat alone is active', async () => {
        const table = hold(await stagedConquer(['defend', 'tax']))
        const { session, asked, third } = table
        const name = session.getPlayerName(table.other)
        expect(primaryNames(session.actionPanel)[0]).toMatch(
            new RegExp(`${name} may answer · can't be undone$`)
        )
        expect(JSON.stringify([...session.boardOffer.targets.values()])).toMatch(/"\d+ vs \d+"/)
        await session.sendTurnCard()
        await settled(session)
        await settled(asked)
        await settled(third)
        expect(session.undoableAction).toBeUndefined()
        expect(session.gameState.activePlayerIds).toEqual([table.other])
        expect(asked.isMyTurn).toBe(true)
        expect(session.isMyTurn).toBe(false)
        expect(third.isMyTurn).toBe(false)
        expect(linesOf(session.actionPanel, 'waiting')[0]).toBe(`Waiting on ${name}.`)
    })

    it('S33 with Defend: the line first, both buttons, and the flip raises the shared tally', async () => {
        const table = hold(
            await askedToDefend(['defend', 'tax'], (state, seat) => {
                returnGoods(state, seat)
            })
        )
        const { asked, session, third } = table
        const ana = asked.getPlayerName(table.seat)
        const view = asked.actionPanel
        expect(view.blocks[0]).toMatchObject({ kind: 'line', role: 'flow' })
        expect(linesOf(view, 'flow')[0]).toMatch(
            new RegExp(`^${ana} conquers your knight at .+: attack \\d+, defence \\d+\\.$`)
        )
        expect(primaryLabels(view)).toEqual([
            "Flip Defend · +1 defence · +1 vp · can't be undone",
            "Let it stand · can't be undone"
        ])
        expect(noteLines(asked)).toEqual([])
        expect(lastByUser(table)?.type).toBe(ActionType.Conquer)
        const before = blockOf(third.actionPanel, 'tally')?.lines.at(-1)?.defence
        await send(asked, /^Flip Defend/)
        await settled(session)
        await settled(third)
        expect(lastByUser(table)).toMatchObject({
            type: ActionType.AnswerAttack,
            flipDefend: true,
            revealsInfo: true
        })
        // R-4.8-H5 The attacker can add nothing here, so the combat has resolved.
        expect(session.gameState.flow.combat).toBeUndefined()
        expect(before).toBeGreaterThan(0)
        // The card turned face up: every seat reads it among the seat's played cards.
        for (const seen of [asked, session, third]) {
            const played = seen.seatPanel(table.other).cards.played.map(({ kind }) => kind)
            expect(played).toContain('defend')
        }
    })

    it("S33 with something to add, the flip opens the commit and the flow's tally reads one more", async () => {
        const table = hold(
            await askedToDefend(['defend', 'tax'], (state, seat) => {
                giveGood(state, seat, 'saltpeter')
            })
        )
        const { asked, session, third } = table
        const defence = (seat: FeudumGameSession) =>
            blockOf(seat.actionPanel, 'tally')?.lines.at(-1)?.defence ?? 0
        const before = defence(third)
        expect(before).toBeGreaterThan(0)
        expect(defence(asked)).toBe(before)
        expect(defence(session)).toBe(before)
        await send(asked, /^Flip Defend/)
        await settled(session)
        await settled(third)
        expect(session.gameState.machineState).toBe(MachineState.CommittingAttack)
        expect(defence(third)).toBe(before + 1)
        expect(defence(asked)).toBe(before + 1)
        expect(defence(session)).toBe(before + 1)
        expect(rowLabels(session.actionPanel, 'saltpeter')).toContain('Add saltpeter')
    })

    it('S34 without Defend: the same line, "You hold no Defend.", one button; only its press answers', async () => {
        const table = hold(await askedToDefend(['tax', 'guild']))
        const { asked } = table
        expect(asked.isMyTurn).toBe(true)
        expect(noteLines(asked)).toEqual(['You hold no Defend.'])
        expect(primaryLabels(asked.actionPanel)).toEqual(["Let it stand · can't be undone"])
        expect(lastByUser(table)?.type).toBe(ActionType.Conquer)
        await settled(asked)
        expect(lastByUser(table)?.type).toBe(ActionType.Conquer)
        await send(asked, /^Let it stand/)
        expect(lastByUser(table)).toMatchObject({
            type: ActionType.AnswerAttack,
            flipDefend: false,
            revealsInfo: true
        })
    })
})

describe('R-3.14.2 S38 the ask to starve, as drawn', () => {
    it('S38 with Defend and a food: "Royal Immunity · 1 food", and the press cancels the starve', async () => {
        const table = hold(await askedToStarve(['defend', 'tax']))
        const { asked, session } = table
        const ana = asked.getPlayerName(table.seat)
        expect(asked.isMyTurn).toBe(true)
        expect(linesOf(asked.actionPanel, 'flow')[0]).toMatch(
            new RegExp(`^${ana} starves your serf at .+\\.$`)
        )
        expect(primaryLabels(asked.actionPanel)).toEqual([
            "Royal Immunity · 1 food · can't be undone",
            "Let it go · can't be undone"
        ])
        await send(asked, /^Royal Immunity/)
        await settled(session)
        expect(lastByUser(table)).toMatchObject({
            type: ActionType.AnswerStarve,
            royalImmunity: true,
            revealsInfo: true
        })
        expect(session.gameState.flow.starve).toBeUndefined()
        const space = session.gameState.spaces[table.spaceId]
        expect(JSON.stringify(space)).toMatch(/"(subject)?[iI]mmune":true/)
    })

    it('S38 without Defend: "You can\'t answer." and "Let it go"; nothing goes for the seat', async () => {
        const table = hold(await askedToStarve(['tax', 'guild']))
        const { asked } = table
        expect(asked.isMyTurn).toBe(true)
        expect(noteLines(asked)).toEqual(["You can't answer."])
        expect(primaryLabels(asked.actionPanel)).toEqual(["Let it go · can't be undone"])
        expect(lastByUser(table)?.type).toBe(ActionType.StarveThePeople)
        await send(asked, /^Let it go/)
        expect(lastByUser(table)).toMatchObject({
            type: ActionType.AnswerStarve,
            royalImmunity: false
        })
    })
})

describe('R-4.8 the commit, as drawn', () => {
    const committing = async () =>
        hold(
            await askedToDefend(['tax', 'guild'], (state, seat) => {
                giveGood(state, seat, 'saltpeter')
            })
        )

    it('S36 the attacker reads the tally, the saltpeter stepper and "Attack n vs m"; others the flow\'s tally', async () => {
        const table = await committing()
        const { asked, session, third } = table
        await send(asked, /^Let it stand/)
        await settled(session)
        await settled(third)
        expect(session.gameState.machineState).toBe(MachineState.CommittingAttack)
        const view = session.actionPanel
        expect(blockOf(view, 'tally')).toBeDefined()
        expect(rowLabels(view, 'saltpeter')).toEqual(['Add saltpeter', 'Take saltpeter off'])
        expect(primaryLabels(view)[0]).toMatch(/^Attack \d+ vs \d+: (fails|wins · \+\d+ vp)$/)
        const attackBefore = blockOf(view, 'tally')?.lines.at(-1)?.attack ?? 0
        await pressRow(rowNamed(view, 'Add saltpeter'))
        expect(blockOf(session.actionPanel, 'tally')?.lines.at(-1)?.attack).toBe(attackBefore + 1)
        // Others read the flow, not the attacker's draft.
        expect(blockOf(third.actionPanel, 'tally')?.lines.at(-1)?.attack).toBe(attackBefore)
        const ana = third.getPlayerName(table.seat)
        expect(linesOf(third.actionPanel, 'waiting')[0]).toContain(ana)
        await send(session, /^Attack/)
        expect(lastByUser(table)).toMatchObject({ type: ActionType.CommitAttack, saltpeter: 1 })
    })
})

describe('R-4.4 the at-will row, as drawn', () => {
    const atWill = (arrange: Parameters<typeof seatedAtCards>[1]) =>
        seatedAtCards(['tax', 'move', 'guild'], (state, table) => {
            returnGoods(state, table.seat)
            arrange?.(state, table)
        })

    it('S50 chips under the hand; Writs opens a face with "A: 1 food → 3s"; the press sends; a card hides it', async () => {
        const table = hold(
            await atWill((state, { seat }) => {
                holdFood(state, seat, 1)
                holdWrit(state, seat, 'writ.mandate.5')
            })
        )
        const { session } = table
        const kinds = session.actionPanel.blocks.map(({ kind }) => kind)
        expect(kinds.indexOf('rows')).toBeGreaterThan(kinds.indexOf('cards'))
        expect(rowLabels(session.actionPanel, 'at-will')).toEqual(['Writs 1'])
        await pressRow(rowNamed(session.actionPanel, 'Writs 1'))
        const offers = blockOf(session.actionPanel, 'writ-offers')?.offers
        expect(offers?.map(({ writId }) => writId)).toEqual(['writ.mandate.5'])
        const row = offers?.[0].rows.find(({ choice }) => choice.label === 'A: 1 food → 3s')
        assertExists(row, 'Mandate 5 offers A')
        await pressRow(row)
        await settled(session)
        expect(lastByUser(table)).toMatchObject({
            type: ActionType.PlayMandate,
            writId: 'writ.mandate.5'
        })
    })

    it('S50 picking a card hides the row and Undo brings it back', async () => {
        const table = hold(
            await atWill((state, { seat }) => {
                holdFood(state, seat, 1)
                holdWrit(state, seat, 'writ.mandate.5')
            })
        )
        const { session } = table
        expect(rowLabels(session.actionPanel, 'at-will')).toEqual(['Writs 1'])
        await pressCard(session.actionPanel, 'tax')
        expect(rowLabels(session.actionPanel, 'at-will')).toEqual([])
        await session.undo()
        flushSync()
        expect(rowLabels(session.actionPanel, 'at-will')).toEqual(['Writs 1'])
    })

    it('S51 R-4.4.3 a charter held with a seal is drawn with "Discard" alone, no seal', async () => {
        const table = hold(
            await atWill((state, { seat }) => {
                giveSeal(state, seat)
                holdWrit(state, seat, 'writ.charter.monster-defeat')
            })
        )
        const { session } = table
        await pressRow(rowNamed(session.actionPanel, 'Writs 1'))
        const offer = blockOf(session.actionPanel, 'writ-offers')?.offers[0]
        expect(offer?.rows.map(({ choice }) => choice.label)).toEqual(['Discard'])
    })

    it('R-4.3.3 Tiles: a tile row opens the goods with art; a good press sends', async () => {
        const table = hold(
            await atWill((state, { seat }) => {
                giveTile(state, seat)
                giveTile(state, seat)
            })
        )
        const { session } = table
        await pressRow(rowNamed(session.actionPanel, 'Tiles 2'))
        const tiles = session.atWillPanel?.tiles ?? []
        expect(tiles).toHaveLength(2)
        const { tileId } = tiles[0]
        const block = rowsOf(session.actionPanel, `tile:${tileId}`)
        // R-4.3 The tile's art stands where its name stood as text; the name stays the row's name.
        const heading = session.actionPanel.blocks.find(
            (one) => one.kind === 'rows' && one.name === `tile:${tileId}`
        )
        expect(heading).not.toHaveProperty('heading')
        const tile = block[0]
        assertExists(tile, 'The tile is listed')
        expect(tile.choice).toMatchObject({ label: `Spend ${tileName(tileId)}`, shown: 'Spend' })
        expect(tile.art).toMatchObject({
            kind: 'tile',
            name: tileName(tileId),
            landscape: session.gameState.tileLandscapes[tileId]
        })
        await pressRow(tile)
        const goods = rowsOf(session.actionPanel, 'goods')
        expect(goods.map(({ art }) => art?.kind)).toContain('good')
        const food = goods.find(({ choice }) => choice.label.startsWith('food'))
        assertExists(food, 'The haversack offers food')
        await pressRow(food)
        await settled(session)
        expect(lastByUser(table)).toMatchObject({ type: ActionType.SpendRegionTile })
    })

    it('R-4.2.2 Vessels: the chip and the vessel rows light the pawns they would offer', async () => {
        const table = hold(
            await atWill((state, { seat }) => {
                const player = state.getPlayerState(seat)
                state.supply.vessels.ship -= 1
                player.vessels.ship = 1
            })
        )
        const { session, seat } = table
        const pawn = session.gameState.getPlayerState(seat).pawns.find((row) => row.spaceId)
        assertExists(pawn, 'A pawn stands on the board')
        const chip = rowNamed(session.actionPanel, 'Vessels 1')
        expect(lit(chip)).toContain(pawnTarget(seat, pawn.n))
        await pressRow(chip)
        const vessel = rowsOf(session.actionPanel, 'vessels')[0]
        expect(lit(vessel)).toContain(pawnTarget(seat, pawn.n))
    })

    it('S39 the Immunity chip lights the marker; opened, it says what the press does', async () => {
        const table = hold(
            await seatedAtCards(['tax', 'move'], (state, { seat, other }) => {
                const space = emptySpaces(state, 'outpost')[0]
                placeMarker(state, other, space)
                placeMarker(state, seat, space)
                sealMarker(state, space, 'serf')
                state.recomputeRanks()
            })
        )
        const { session, seat } = table
        const chip = rowNamed(session.actionPanel, 'Immunity 1')
        expect(lit(chip).join()).toContain(seat)
        await pressRow(chip)
        expect(linesOf(session.actionPanel, 'flow')).toContain(
            'Take back the seal: the marker can be starved again'
        )
    })
})

describe('R-4.4.4 S52 the writ limit, as drawn', () => {
    async function overLimit() {
        const table = hold(
            await seatedAtCards(['tax', 'move'], (state, { seat }) => {
                holdFood(state, seat, 1)
                for (const writId of [
                    'writ.mandate.5',
                    'writ.mandate.2',
                    'writ.mandate.4',
                    'writ.mandate.7'
                ] as const) {
                    holdWrit(state, seat, writId)
                }
            })
        )
        const { session } = table
        await pressCard(session.actionPanel, 'tax')
        await session.forfeitTurnCard()
        await settled(session)
        flushSync()
        expect(session.gameState.machineState).toBe(MachineState.DiscardingWrits)
        return table
    }

    it('S52 the line, the faces, the primary "face down", and the at-will row stays open', async () => {
        const table = await overLimit()
        const { session } = table
        const view = session.actionPanel
        expect(linesOf(view, 'flow')[0]).toBe('Hold at most 3 writs: 4 now')
        expect(blockOf(view, 'writs')?.rows.length).toBe(4)
        // R-X.2 The send appears with the pick.
        expect(primaryLabels(view)).toEqual([])
        expect(rowLabels(view, 'at-will').join()).toContain('Writs')
        const first = blockOf(view, 'writs')?.rows[0]
        assertExists(first, 'A writ is offered')
        await first.press()
        flushSync()
        expect(primaryLabels(session.actionPanel)).toEqual([
            "Discard to the deck's bottom · face down"
        ])
        await send(session, /^Discard/)
        expect(lastByUser(table)).toMatchObject({ type: ActionType.DiscardWrit })
    })

    it('R-X.1 the others read who discards, and no faces', async () => {
        const table = await overLimit()
        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(linesOf(other.actionPanel, 'waiting')[0]).toContain(other.getPlayerName(table.seat))
        expect(blockOf(other.actionPanel, 'writs')).toBeUndefined()
    })
})

describe('R-4.10 S53 nourish, as drawn', () => {
    const scarce = () =>
        atNourishing((state, { seat }) => {
            threePawns(state, seat)
            holdFood(state, seat, 1)
            fillBarrel(state, seat, 1)
        })

    it('S53 the picker: a row per pawn as its cube, place and feeds lighting it, then the send', async () => {
        const table = hold(await scarce())
        const { session, seat } = table
        const view = session.actionPanel
        const picker = blockOf(view, 'nourish-picker')
        assertExists(picker, 'S53 The seat nourishing has the picker')
        expect(rowLabels(view).filter((label) => /^(Food|Wine|Unfed)$/.test(label))).toEqual([])
        expect(picker.pawns.length).toBe(3)
        const third = picker.pawns[2]
        expect(third).toMatchObject({ name: 'Farmer', unfed: true, character: 'farmer' })
        expect(third.paint.fill).toBeTruthy()
        expect(third.options.map(({ choice }) => choice.label)).toEqual(['Food', 'Wine', 'Unfed'])
        expect(third.options.every((row) => lit(row).includes(pawnTarget(seat, third.n)))).toBe(
            true
        )
        expect(picker).not.toHaveProperty('summary')
        expect(picker).not.toHaveProperty('rule')
        expect(primaryLabels(view)).toEqual(['Feed 2 · leave 1'])
        expect(picker.send?.tally).toEqual({ fed: 2, food: 1, wine: 1 })
        expect(lastByUser(table)?.type).not.toBe(ActionType.Nourish)
        await send(session, /^Feed/)
        expect(lastByUser(table)).toMatchObject({ type: ActionType.Nourish })
    })

    it('R-4.10.2 the asked seat keeps its at-will row', async () => {
        const table = hold(
            await atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 1)
                fillBarrel(state, seat, 1)
                giveTile(state, seat)
            })
        )
        expect(rowLabels(table.session.actionPanel, 'at-will').join()).toContain('Tiles')
    })

    it('R-4.3.3 short, with a tile: the picker says a tile feeds 1, beside the tile rows', async () => {
        const table = hold(
            await atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 1)
                giveTile(state, seat)
            })
        )
        const picker = blockOf(table.session.actionPanel, 'nourish-picker')
        expect(picker?.covers?.line).toBe('A tile feeds 1')
        // R-4.3.3 The tile brings food, or sulfur to the empty barrel as wine.
        expect(picker?.covers?.rows.map(({ choice }) => choice.shown)).toEqual([
            'for food',
            'for wine'
        ])
    })

    it('R-4.10.1 fed in full, the picker has no tile line', async () => {
        const table = hold(
            await atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 3)
                giveTile(state, seat)
            })
        )
        const picker = blockOf(table.session.actionPanel, 'nourish-picker')
        expect(picker?.covers).toBeUndefined()
        expect(primaryLabels(table.session.actionPanel)).toEqual(['Feed 3 · 3 food'])
    })
})

describe('S55 landscapes, as drawn', () => {
    it('S55 each filled landscape reads "collect n · 1 to the ruler" and lights; the primary counts them', async () => {
        const table = hold(await atCollecting())
        const { session, spaces } = table
        const view = session.actionPanel
        expect(primaryLabels(view)).toEqual(['Leave all'])
        const first = rowsOf(view, `landscape:${spaces[0]}`)[0]
        expect(first.choice.label).toMatch(/^collect \d+ · 1 to the ruler$/)
        expect(lit(first)).toEqual([spaceTarget(spaces[0])])
        await pressRow(first)
        expect(primaryLabels(session.actionPanel)).toEqual(['Collect 1'])
        await send(session, 'Collect 1')
        expect(lastByUser(table)).toMatchObject({ type: ActionType.CollectLandscapes })
    })
})

describe('R-X.2 "can\'t be undone" on what is drawn', () => {
    it("R-3.14-H1 each ask's buttons say so and the Action reveals", async () => {
        const defend = hold(await askedToDefend(['defend', 'tax']))
        for (const { label } of primariesOf(defend.asked.actionPanel)) {
            expect(label).toMatch(/can't be undone$/)
        }
        defend.host.close()
        const starve = hold(await askedToStarve(['defend', 'tax']))
        for (const { label } of primariesOf(starve.asked.actionPanel)) {
            expect(label).toMatch(/can't be undone$/)
        }
    })

    it('R-X.2 a mandate that draws goods stages with the label on the drawn row', async () => {
        const table = hold(
            await seatedAtCards(['tax', 'move', 'guild'], (state, { seat }) => {
                returnGoods(state, seat)
                holdWrit(state, seat, 'writ.mandate.6')
                threePawns(state, seat)
                for (const pawn of state.getPlayerState(seat).pawns) {
                    pawn.character = 'farmer'
                }
                state.recomputeRanks()
            })
        )
        const { session, seat } = table
        const revealing = playMandateOffers(session.gameState, seat).find(
            (offer) => offer.revealsInfo && !offer.refused
        )
        assertExists(revealing, 'R-4.4-H4 Goods from the supply show what they are')
        await pressRow(rowNamed(session.actionPanel, /^Writs/))
        const offer = blockOf(session.actionPanel, 'writ-offers')?.offers.find(
            ({ writId }) => writId === revealing.writId
        )
        const row = offer?.rows[revealing.alternative]
        assertExists(row, 'The mandate lists the alternative')
        const count = table.host.actions.length
        await pressRow(row)
        expect(table.host.actions).toHaveLength(count)
        expect(primaryLabels(session.actionPanel).join()).toMatch(/can't be undone$/)
    })
})
