import {
    ActionCardKinds,
    Charters,
    GuildIds,
    RoyalWrits,
    type ActionCardId,
    type CharterId,
    type GuildId,
    type KingdomCharter
} from '@tabletop/feudum'
import { spaceLabel } from './cardFlows.js'
import type { EnlargedFace } from './tableLayers.svelte.js'

/**
 * What stands beside an enlarged card, writ or guild area: a short reading of what it does, in this
 * game's own words, from the rules digest and the rulings. Nothing here is the rulebook's wording.
 */
export interface RulesNote {
    readonly title: string
    readonly lines: readonly RulesLine[]
}

export interface RulesLine {
    /** What the line is about: the regular action, a special ability, a guild function. */
    readonly term: string
    readonly text: string
}

export type GuildNoteId = `guild.${GuildId}`

const Repeatable: RulesLine = { term: 'Repeat', text: 'A Repeat card may play it again.' }
const NeverRepeated: RulesLine = {
    term: 'Repeat',
    text: 'Neither Repeat nor Déjà Vu may play it again.'
}

/** R-3.5 to R-3.16 */
const CardNotes: Readonly<Record<ActionCardId, RulesNote>> = {
    'card.action.migrate': {
        title: 'Migrate',
        lines: [
            {
                term: 'Action',
                text: 'Bring one of your pawns onto the board, or take one off. Coming on costs 1 food: the pawn takes any character and enters a space holding your pawn or influence marker, or a starting space if you have neither. Going off is free.'
            },
            {
                term: 'Distant Kin',
                text: 'With an Alchemist pawn on the board, the pawn may enter at any starting space.'
            }
        ]
    },
    'card.action.move': {
        title: 'Move',
        lines: [
            {
                term: 'Action',
                text: 'You have one step for each of your pawns on the board and each monster you control. Share them out freely, one space per step along routes the piece may use. Afterwards one piece that moved may pilfer a single resource where it stands.'
            },
            {
                term: 'Godspeed',
                text: 'With a Monk pawn on the board, one monk takes one extra step at the end.'
            },
            Repeatable
        ]
    },
    'card.action.influence': {
        title: 'Influence',
        lines: [
            {
                term: 'Action',
                text: 'Put one influence marker on every space where you have a pawn, one per space however many pawns stand there. Monsters add none.'
            },
            {
                term: 'Money is Influence',
                text: 'Where your Merchant pawn stands on a space an opponent rules with a single marker, pay 1 shilling: their marker drops to serf and yours rules on top.'
            },
            Repeatable
        ]
    },
    'card.action.improve': {
        title: 'Improve',
        lines: [
            {
                term: 'Action',
                text: 'Raise one location you rule a step: an outpost to a farm for a wood, a farm to a town for an iron, a town to a feudum for a king’s seal. Then take a region tile and score it.'
            },
            {
                term: 'Tend Landscape',
                text: 'Instead, for a wood, lay one of your region tiles landscape up where you are the serf and no landscape stands yet, and score 2 vp.'
            }
        ]
    },
    'card.action.explore': {
        title: 'Explore',
        lines: [
            {
                term: 'Action',
                text: 'If you rule an outpost, draw 2 Royal Writs, and one more for each further outpost or feudum you rule. Keep one; the rest go under the deck.'
            },
            {
                term: 'Shovels & Swords',
                text: 'Then, for an iron, draw 2 more and keep one more.'
            }
        ]
    },
    'card.action.harvest': {
        title: 'Harvest',
        lines: [
            {
                term: 'Action',
                text: 'If you rule a farm with fewer than 10 goods, fill it from the haversack and score 1 vp. You draw 5, plus one for each other farm or feudum you rule and the value of each bead you hold, 10 at most. Before drawing you may take favors: a share goes to your own supply instead, and your beads turn seal side up.'
            },
            {
                term: 'Inspect the Harvest',
                text: 'With a Farmer pawn on the board, draw first and pick your favors from what you see.'
            }
        ]
    },
    'card.action.tax': {
        title: 'Tax',
        lines: [
            {
                term: 'Action',
                text: 'If you rule a town, take 2 shillings, plus one for each other town or feudum you rule.'
            },
            {
                term: 'Reinforcements',
                text: 'With a Knight pawn on the board, also take back one of your influence markers.'
            }
        ]
    },
    'card.action.conquer': {
        title: 'Conquer',
        lines: [
            {
                term: 'Action',
                text: 'Attack an opponent’s pawn, monster or feudum on a space where you have a pawn or monster; outposts, farms and towns are never attacked. It may not be your last card of the round. A win scores 2 vp, or 4 vp for a feudum.'
            },
            {
                term: 'Starve the People',
                text: 'Instead, where your Noble pawn stands, remove an opponent’s subject or serf without a fight and without vp; you may then take military service. The beads on the Farmer Guild’s chickens go back to the supply.'
            },
            NeverRepeated
        ]
    },
    'card.action.defend': {
        title: 'Defend',
        lines: [
            {
                term: 'Action',
                text: 'Keep it for an attack on you: turn it over out of turn for +1 defence in that one fight, and score 1 vp. If no attack comes, playing it on your turn still scores 1 vp.'
            },
            {
                term: 'Royal Immunity',
                text: 'Instead, when your subject or serf is about to be starved, pay a food to stop it and slip a king’s seal under that marker. While the seal stays there, that marker cannot be starved.'
            },
            NeverRepeated
        ]
    },
    'card.action.repeat': {
        title: 'Repeat',
        lines: [
            {
                term: 'Action',
                text: 'Play again one card you have already played this round that carries the repeat sign. Once a round.'
            },
            {
                term: 'Déjà Vu',
                text: 'For a saltpeter, replay a card without the sign instead, but never Conquer or Defend.'
            }
        ]
    },
    'card.action.guild': {
        title: 'Guild',
        lines: [
            {
                term: 'Action',
                text: 'Use one function of one guild: its trade, open to anyone; its pull, if you are its journeyman; or its push, if you are its master. A second guild action in the same round must use another guild.'
            },
            {
                term: 'Feast',
                text: 'Instead, for a sulfur from your wine barrel, on a space with your pawn and an opponent’s pawn or feudum, perform that opponent’s own pull or push in the related guild and score it with 3 vp more.'
            },
            Repeatable
        ]
    }
}

const Mandate: RulesLine = {
    term: 'Mandate',
    text: 'Play it on your own turn, while choosing hands or while nourishing; then it goes under the deck.'
}
const Weapon: RulesLine = { term: 'Weapon', text: 'It may also be played during your own attack.' }
const Charter: RulesLine = {
    term: 'Charter',
    text: 'It scores only if a king’s seal is laid on it at the end of the game.'
}

/** R-4.4.2, R-4.4-H1, R-4.4-H4, R-7 Read from each card's alternatives and rewards. */
const MandateNotes: Readonly<Record<string, RulesNote>> = {
    'writ.mandate.1': {
        title: 'Mandate 1',
        lines: [
            { term: 'Reward', text: '+1 attack, or +2 attack if you turn in a wood.' },
            Weapon,
            Mandate
        ]
    },
    'writ.mandate.2': {
        title: 'Mandate 2',
        lines: [
            {
                term: 'Reward',
                text: 'Turn in a food for a flying machine, or a wood for a ship, from the general supply.'
            },
            Mandate
        ]
    },
    'writ.mandate.3': {
        title: 'Mandate 3',
        lines: [
            { term: 'Reward', text: '+1 attack, or +2 attack if you turn in an iron.' },
            Weapon,
            Mandate
        ]
    },
    'writ.mandate.4': {
        title: 'Mandate 4',
        lines: [
            {
                term: 'Reward',
                text: 'Turn in a wood for a ship, or an iron for a submersible, from the general supply.'
            },
            Mandate
        ]
    },
    'writ.mandate.5': {
        title: 'Mandate 5',
        lines: [
            {
                term: 'Reward',
                text: 'Turn in a food for 3 shillings, or a wood and a food for 7.'
            },
            Mandate
        ]
    },
    'writ.mandate.6': {
        title: 'Mandate 6',
        lines: [
            {
                term: 'Reward',
                text: 'With 3 status stars in one of these guilds, take that guild’s reward: Farmer, 3 goods drawn from the haversack; Merchant, 3 shillings; Alchemist, a vessel you name. One reward per card.'
            },
            Mandate
        ]
    },
    'writ.mandate.7': {
        title: 'Mandate 7',
        lines: [
            {
                term: 'Reward',
                text: 'Turn in an iron, a wood and a food for 9 shillings, or those and a sulfur for 13.'
            },
            Mandate
        ]
    },
    'writ.mandate.8': {
        title: 'Mandate 8',
        lines: [
            {
                term: 'Reward',
                text: 'With 3 status stars in one of these guilds, take that guild’s reward: Knight, 3 influence markers; Noble, a king’s seal; Monk, a rosary bead. One reward per card.'
            },
            Mandate
        ]
    }
}

function kingdomTitle(charter: KingdomCharter): string {
    return `${charter.kingdom.charAt(0).toUpperCase()}${charter.kingdom.slice(1)} Kingdom`
}

/** R-6.2-H1 What a kingdom charter pays, read from its card's spaces and points. */
function kingdomNote(charter: KingdomCharter): RulesNote {
    const counts = charter.vpByLocationsRuled.map((_, index) => index + 1)
    const most = counts.length
    return {
        title: kingdomTitle(charter),
        lines: [
            {
                term: 'Scores',
                text: `${charter.vpByLocationsRuled.join(' / ')} vp at the end for ruling ${counts.join(' / ')}${most < charter.spaces.length ? ' or more' : ''} of its spaces: ${charter.spaces.map(spaceLabel).join(', ')}. A space may count for more than one charter.`
            },
            Charter
        ]
    }
}

/** R-4.4.3, R-6.2-H1, R-6.2-H2 */
const CharterNotes = Object.fromEntries(
    Charters.map((charter): [CharterId, RulesNote] => {
        switch (charter.kind) {
            case 'kingdom':
                return [charter.id, kingdomNote(charter)]
            case 'sulfur-barrel':
                return [
                    charter.id,
                    {
                        title: 'Sulfur charter',
                        lines: [
                            {
                                term: 'Scores',
                                text: `${charter.vpBySulfur.map(({ sulfur, vp }) => `${vp} vp with ${sulfur}`).join(', or ')} sulfur in your wine barrel at the end. Sulfur feeding a pawn has left the barrel.`
                            },
                            Charter
                        ]
                    }
                ]
            case 'monster-defeat':
                return [
                    charter.id,
                    {
                        title: 'Monster charter',
                        lines: [
                            {
                                term: 'Scores',
                                text: `${charter.vp} vp if at any time in the game you beat the behemoth or the sea serpent.`
                            },
                            Charter
                        ]
                    }
                ]
        }
    })
) as Readonly<Record<CharterId, RulesNote>>

const Pull = 'Pull (journeyman)'
const Push = 'Push (master)'
const Trade = 'Trade (anyone)'
const PullScore = 'Reaching it scores 3 vp and a Royal Writ (draw 2, keep 1).'
const PushScore = '1, 2 or 3 of them score 4, 5 or 6 vp.'

/** R-4.6 Each guild's three functions. */
const GuildNotes: Readonly<Record<GuildNoteId, RulesNote>> = {
    'guild.farmer': {
        title: 'Farmer Guild',
        lines: [
            {
                term: Trade,
                text: 'Ship every good from one farm you rule into the barn, and take a food or a shilling for each 2 goods shipped.'
            },
            {
                term: Pull,
                text: `Take the rosary’s highest and lowest beads; an opponent hides one in each hand, and the one you pick goes on an empty chicken. The goal is chickens totalling 5 or more. ${PullScore}`
            },
            {
                term: Push,
                text: `Move 5 goods from the barn into the Merchant market; score the rows or columns you complete. ${PushScore} Then share the farmer’s purse with the journeyman.`
            }
        ]
    },
    'guild.merchant': {
        title: 'Merchant Guild',
        lines: [
            {
                term: Trade,
                text: 'Buy up to 3 goods at the prices marked, always the cheapest of a good first.'
            },
            {
                term: Pull,
                text: `Move 3 goods from the Farmer barn into the market. The goal is a row or column completed. ${PullScore}`
            },
            {
                term: Push,
                text: `Move 4 goods from the market into the Alchemist carts and piles; score the ones you complete. ${PushScore}`
            }
        ]
    },
    'guild.alchemist': {
        title: 'Alchemist Guild',
        lines: [
            { term: Trade, text: 'Buy a vessel for 3 shillings.' },
            {
                term: Pull,
                text: `Move 2 goods from the Merchant market into the carts and piles. The goal is one of them completed. ${PullScore}`
            },
            {
                term: Push,
                text: `Make 1 to 3 inventions from the carts: vessels for the vessel space, or krud barrels that fill the Knight rows. ${PushScore}`
            }
        ]
    },
    'guild.knight': {
        title: 'Knight Guild',
        lines: [
            {
                term: Trade,
                text: 'Pay 3 shillings to take back every marker in your row. With 3 or more you may give 3 of them up to tame a monster and send it out at once.'
            },
            {
                term: Pull,
                text: `Invent a krud barrel or a vessel from the Alchemist carts; this always reaches the goal. ${PullScore}`
            },
            {
                term: Push,
                text: `Clear 1 to 3 markers of different colours from the rows, each replaced by a seal on the Noble scrolls; score the rows or columns you complete. ${PushScore}`
            }
        ]
    },
    'guild.noble': {
        title: 'Noble Guild',
        lines: [
            { term: Trade, text: 'Buy one king’s seal for 3 shillings, or two for 6.' },
            {
                term: Pull,
                text: `Clear 2 markers of different colours from the Knight rows and lay 2 seals on the scrolls. The goal is a row or column completed. ${PullScore}`
            },
            {
                term: Push,
                text: `Turn 2 seals from the scrolls onto the Monk rosary as beads; score as its total reaches 5, 11 and 17. ${PushScore}`
            }
        ]
    },
    'guild.monk': {
        title: 'Monk Guild',
        lines: [
            {
                term: Trade,
                text: 'Pay 3 shillings for the rosary’s highest and lowest beads; an opponent hides one in each hand, and you keep the one you pick.'
            },
            {
                term: Pull,
                text: `Turn one seal from the Noble scrolls onto the rosary. The goal is a rosary total of 11 or more. ${PullScore}`
            },
            {
                term: Push,
                text: `As the Farmer pull, a bead onto an empty chicken; score as the chickens reach 3, 6 and 9. ${PushScore} Then share the church coffer with the journeyman.`
            }
        ]
    }
}

/** Every note, keyed by the id of what it reads. */
export const RulesNotes: Readonly<Record<string, RulesNote>> = {
    ...CardNotes,
    ...MandateNotes,
    ...CharterNotes,
    ...GuildNotes
}

/** Every id that the enlarged view shows face up and so must read. */
export const NotedIds: readonly string[] = [
    ...ActionCardKinds.map((kind): ActionCardId => `card.action.${kind}`),
    ...RoyalWrits.map(({ id }) => id),
    ...GuildIds.map((guild): GuildNoteId => `guild.${guild}`)
]

/** The note beside an enlarged piece: a face, never a back; a tile or bead has none. */
export function rulesNoteOf(face: EnlargedFace): RulesNote | undefined {
    switch (face.kind) {
        case 'card':
            return face.faceShown && face.card ? RulesNotes[`card.action.${face.card}`] : undefined
        case 'writ':
            return face.faceShown && face.writId ? RulesNotes[face.writId] : undefined
        case 'guild':
            return RulesNotes[`guild.${face.guild}`]
        default:
            return undefined
    }
}
