import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { assertExists } from '@tabletop/common'
import { one, PowerChoiceKind } from '../util/powerChoice.js'
import { chosen, registerContinuous, registerEffect, type EffectContext } from './registry.js'
import {
    gainFavorFromBank,
    gainSecrets,
    takeFavorFromPlayer,
    denizensAtYourSite
} from './vocabulary.js'

function chosenSuit(ctx: EffectContext): Suit {
    const bank = chosen(ctx, PowerChoiceKind.FavorBank)[0]
    assertExists(bank, `${ctx.power.cardId} resolves only with a chosen favor bank`)
    return bank.suit
}

// R-7.6.4 — "You can only have two advisers."
for (const cardId of [
    'denizen.discord.assassin',
    'denizen.discord.insomnia',
    'denizen.discord.silver-tongue'
]) {
    registerContinuous(cardId, powerIndexOf(cardId, PowerTiming.Continuous), { adviserLimit: 2 })
}

// "You cannot gain favor from Trade. / Rest: If you have no favor, take two
// favor from any one favor bank."
registerContinuous(
    'denizen.beast.vow-of-poverty',
    powerIndexOf('denizen.beast.vow-of-poverty', PowerTiming.Continuous),
    {
        cannotGainFavorFromTrade: true
    }
)
registerEffect(
    'denizen.beast.vow-of-poverty',
    powerIndexOf('denizen.beast.vow-of-poverty', PowerTiming.Rest),
    {
        choices: [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })],
        reasonCannotResolve: (ctx) =>
            ctx.state.getPlayerState(ctx.playerId).favor > 0
                ? 'you have favor, so Vow of Poverty has nothing to take'
                : undefined,
        resolve: (ctx) => {
            const suit = chosenSuit(ctx)
            const gained = gainFavorFromBank(ctx.state, ctx.playerId, suit, 2)
            return { summary: `Vow of Poverty: took ${gained} favor from the ${suit} bank` }
        }
    }
)

// "You cannot play Visions faceup. / Rest: Take favor from any one favor bank."
registerContinuous(
    'denizen.order.vow-of-obedience',
    powerIndexOf('denizen.order.vow-of-obedience', PowerTiming.Continuous),
    {
        cannotPlayVisionsFaceup: true
    }
)
registerEffect(
    'denizen.order.vow-of-obedience',
    powerIndexOf('denizen.order.vow-of-obedience', PowerTiming.Rest),
    {
        choices: [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })],
        resolve: (ctx) => {
            const suit = chosenSuit(ctx)
            const gained = gainFavorFromBank(ctx.state, ctx.playerId, suit, 1)
            return { summary: `Vow of Obedience: took ${gained} favor from the ${suit} bank` }
        }
    }
)

// "Rest: Gain a secret."
registerEffect(
    'denizen.discord.insomnia',
    powerIndexOf('denizen.discord.insomnia', PowerTiming.Rest),
    {
        choices: [],
        resolve: (ctx) => ({
            summary: `Insomnia: gained ${gainSecrets(ctx.state, ctx.playerId, 1)} secret`
        })
    }
)

// "Rest: Take favor from a favor bank matching a card at your site."
registerEffect(
    'denizen.discord.silver-tongue',
    powerIndexOf('denizen.discord.silver-tongue', PowerTiming.Rest),
    {
        choices: [
            one(PowerChoiceKind.FavorBank, {
                what: 'a favor bank matching a card at your site',
                domain: (state, playerId) => {
                    const here = denizensAtYourSite(state, playerId)
                    const suits = new Set(
                        here.map((id) => suitOf(id)).filter((s): s is Suit => s !== undefined)
                    )
                    return [...suits]
                        .filter((suit) => state.favorBank[suit] > 0)
                        .map((suit) => ({ kind: PowerChoiceKind.FavorBank, suit }))
                }
            })
        ],
        resolve: (ctx) => {
            const suit = chosenSuit(ctx)
            const gained = gainFavorFromBank(ctx.state, ctx.playerId, suit, 1)
            return { summary: `Silver Tongue: took ${gained} favor from the ${suit} bank` }
        }
    }
)

// "Rest: If any Exile is the Oathkeeper or Usurper, take favor from the
// Chancellor."
registerEffect(
    'denizen.discord.naysayers',
    powerIndexOf('denizen.discord.naysayers', PowerTiming.Rest),
    {
        choices: [],
        reasonCannotResolve: (ctx) => {
            const holder = ctx.state.oathkeeperPlayerId
                ? ctx.state.getPlayerState(ctx.state.oathkeeperPlayerId)
                : undefined
            return holder?.status === PlayerStatus.Exile
                ? undefined
                : 'no Exile holds the Oathkeeper title'
        },
        resolve: (ctx) => {
            const taken = takeFavorFromPlayer(ctx.state, ctx.playerId, ctx.state.chancellorId(), 1)
            return { summary: `Naysayers: took ${taken} favor from the Chancellor` }
        }
    }
)
