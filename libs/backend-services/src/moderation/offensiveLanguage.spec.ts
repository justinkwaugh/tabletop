import { describe, expect, it } from 'vitest'
import { isOffensiveGameName, isOffensiveUsername } from './offensiveLanguage.js'

describe('isOffensiveUsername', () => {
    it.each([
        'nigger',
        'NiggerMan',
        'n1gg3r',
        'n_i_g_g_e_r',
        'n i g g e r',
        'nig-ger',
        'n​igger',
        'nìgger',
        'ｎｉｇｇｅｒ',
        'faggot',
        'kike',
        'wetback',
        'coon',
        'k.k.k',
        'AdolfHitler',
        'fuckface',
        'shit_head',
        'zipperhead',
        'naziboy',
        'nazi_boy',
        'nazi88',
        'fagboy',
        'f4gboy',
        'fag69',
        'kikeboy',
        'spicboy',
        'coonhunter',
        'pedobear',
        'kkkboy',
        'bigdick',
        'dickking',
        'thefag',
        'killjews',
        '1488',
        'hitler1488'
    ])('refuses %s', (username) => {
        expect(isOffensiveUsername(username)).toBe(true)
    })

    it.each([
        'KingGamer',
        'PlayingGames',
        'MustangGaming',
        'FK Austria',
        'Dickson',
        'Dickinson',
        'Burdick',
        'Cummings',
        'Fagan',
        'Annalise',
        'Fukuda',
        'Hooker',
        'Hancock',
        'Scunthorpe',
        'Raccoon',
        'Tycoon',
        'Nigel',
        'Nigeria',
        'Montenegro',
        'Pakistan',
        'Spicy',
        'Nazir',
        'Therapist',
        'Assassin',
        'Whittler',
        'Kevin',
        'Pussycat',
        'Mishit',
        'RaccoonKing',
        'TycoonBoy',
        'Coonrod',
        'Dickman',
        'Spicer',
        'Homer',
        'TheAnalyst',
        'BigAnalog'
    ])('allows %s', (username) => {
        expect(isOffensiveUsername(username)).toBe(false)
    })
})

describe('isOffensiveGameName', () => {
    it.each([
        'Fuck this game',
        'F*ck this',
        'f**k this',
        'f*** this',
        'What the sh*t',
        's**t game',
        'f u c k you',
        'f u c k1',
        's h 1 t',
        'n.i.g.g.e.r night',
        'fu-ck',
        'fu.ck',
        'sh-it',
        'n-igger',
        'hit-ler',
        'Sh1t game',
        'Nazi night',
        'nazi88 night',
        'nazi-88 night',
        'The KKK',
        'k k k',
        '14 88',
        '14/88',
        'white power',
        'White  Power rally',
        'wh1te p0wer',
        'white-power',
        'sieg heil',
        'kill the jews',
        'kill jews',
        'hate jews',
        'towel head',
        'rag head',
        'wet back',
        'zipper head',
        'porch monkey',
        'she male'
    ])('rejects %s', (name) => {
        expect(isOffensiveGameName(name)).toBe(true)
    })

    it.each([
        'Is this it?',
        "Bob's hit list",
        'Pen is mightier',
        'Bass hit',
        'Analysis paralysis',
        'Assassins of Essex',
        'Team A vs B',
        'Plan B a go',
        '1889 Friday game',
        '1846 / 1889',
        'Game 14 of 88',
        'Woot Woot!',
        "Let's play",
        'Drag head'
    ])('allows %s, which only spells a word across its spaces', (name) => {
        expect(isOffensiveGameName(name)).toBe(false)
    })

    it.each([
        'Moby Dick',
        'Cum Laude',
        'Homo Sapiens',
        'Spic and Span',
        'Tit for Tat',
        'Cock and Bull',
        'Bastard Sword',
        'Pissarro',
        'Rio Negro'
    ])('allows the innocent %s', (name) => {
        expect(isOffensiveGameName(name)).toBe(false)
    })

    it('still rejects a slur beside an innocent term', () => {
        expect(isOffensiveGameName('Moby Dick nigger')).toBe(true)
    })
})
