import type { VisionRecord } from './visions.js'

export default [
    {
        id: 'vision.conquest',
        name: 'Vision of Conquest',
        cardNumber: null,
        reminderText:
            '_If drawn from world deck, increase Visions Drawn._\n**Exiles** _can play this face up on their Revealed Vision space._',
        goalText:
            'Wake: You win if you rule the most sites and at least three visions have been drawn from the deck.',
        timing: 'wake',
        isConspiracy: false,
        powerText: ''
    },
    {
        id: 'vision.rebellion',
        name: 'Vision of Rebellion',
        cardNumber: null,
        reminderText:
            '_If drawn from world deck, increase Visions Drawn._\n**Exiles** _can play this face up on their Revealed Vision space._',
        goalText:
            "Wake: You win if you hold the People's Favor and at least three visions have been drawn from the deck.",
        timing: 'wake',
        isConspiracy: false,
        powerText: ''
    },
    {
        id: 'vision.sanctuary',
        name: 'Vision of Sanctuary',
        cardNumber: null,
        reminderText:
            '_If drawn from world deck, increase Visions Drawn._\n**Exiles** _can play this face up on their Revealed Vision space._',
        goalText:
            'Wake: You win if you hold the most relics and banners, and at least three visions have been drawn from the deck.',
        timing: 'wake',
        isConspiracy: false,
        powerText: ''
    },
    {
        id: 'vision.faith',
        name: 'Vision of Faith',
        cardNumber: null,
        reminderText:
            '_If drawn from world deck, increase Visions Drawn._\n**Exiles** _can play this face up on their Revealed Vision space._',
        goalText:
            'Wake: You win if you hold the Darkest Secret and at least three visions have been drawn from the deck.',
        timing: 'wake',
        isConspiracy: false,
        powerText: ''
    },
    {
        id: 'vision.conspiracy',
        name: 'Conspiracy',
        cardNumber: null,
        reminderText:
            '_If drawn from world deck, increase Visions Drawn._\n**Anyone** _can play this face up._',
        goalText: '',
        timing: 'whenPlayed',
        isConspiracy: true,
        powerText:
            "When Played: You may burn [secret] to take one relic or banner from a player whose pawn is at your site. If it's a banner, it burns [favor][favor]/[secret][secret].\nTo do so, you **must** have at least two advisers whose suits match any of their advisers.\nReturn this card to the box."
    }
] satisfies readonly VisionRecord[]
