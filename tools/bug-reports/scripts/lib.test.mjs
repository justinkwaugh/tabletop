import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    MESSAGE_LIMIT,
    findTag,
    keyedTags,
    matchesStatus,
    messageContentIntent,
    parseLimit,
    postIdFromArgument,
    postStatus,
    reportFromMessage,
    reporterFromField,
    splitMessage,
    summarizeMessage,
    uniqueFilename,
    withStatus,
    withTags
} from '../src/lib.mjs'
import {
    checkForumInputs,
    checkStageInputs,
    forumRecord,
    reporterMessage
} from '../src/milestones.mjs'

const tags = keyedTags([
    { id: '7', name: 'investigating' },
    { id: '1', name: 'open' },
    { id: '2', name: 'reproduced' },
    { id: '3', name: 'fixed' },
    { id: '4', name: 'wont fix' },
    { id: '8', name: 'Not a Bug' },
    { id: '9', name: 'suggestion' },
    { id: '5', name: 'UI' },
    { id: '6', name: 'logic' }
])

test('findTag matches names regardless of case, hyphens and apostrophes', () => {
    assert.equal(findTag(tags, "Won't-Fix").id, '4')
    assert.equal(findTag(tags, 'not-a-bug').id, '8')
    assert.equal(findTag(tags, 'ui').id, '5')
    assert.throws(() => findTag(tags, 'blocked'), /no tag "blocked".*investigating, open/)
})

test('withStatus replaces the status tag and keeps area tags', () => {
    assert.deepEqual(withStatus(['1', '5'], tags, 'fixed'), ['5', '3'])
    assert.deepEqual(withStatus(['6'], tags, 'not a bug'), ['6', '8'])
    assert.throws(() => withStatus(['1'], tags, 'UI'), /not a status tag/)
})

test('withTags adds without duplicates and removes', () => {
    assert.deepEqual(withTags(['1', '5'], tags, { add: ['logic', 'UI'] }), ['1', '5', '6'])
    assert.deepEqual(withTags(['1', '5'], tags, { remove: ['ui'] }), ['1'])
})

test('postStatus and matchesStatus treat open, investigating, reproduced and untagged posts as unresolved', () => {
    assert.equal(postStatus(['5', '8'], tags), 'not a bug')
    assert.equal(postStatus(['5'], tags), undefined)
    assert.equal(postStatus(['9'], tags), 'suggestion')
    assert.equal(matchesStatus('investigating', 'unresolved'), true)
    assert.equal(matchesStatus(undefined, 'unresolved'), true)
    assert.equal(matchesStatus('fixed', 'unresolved'), false)
    assert.equal(matchesStatus('suggestion', 'unresolved'), false)
    assert.equal(matchesStatus('fixed', 'all'), true)
    assert.equal(matchesStatus('wont fix', "won't-fix"), true)
})

test('postIdFromArgument reads ids, post links and message links', () => {
    assert.equal(postIdFromArgument('1560030519620542515'), '1560030519620542515')
    assert.equal(
        postIdFromArgument('https://discord.com/channels/1272765028621353041/1560030519620542515'),
        '1560030519620542515'
    )
    assert.equal(
        postIdFromArgument(
            'https://discord.com/channels/1272765028621353041/1560030519620542515/1560030519620549999'
        ),
        '1560030519620542515'
    )
    assert.equal(postIdFromArgument('12'), undefined)
})

test('splitMessage keeps short text whole and splits long text on boundaries', () => {
    assert.deepEqual(splitMessage('  hello  '), ['hello'])
    const paragraph = 'word '.repeat(300).trim()
    assert.deepEqual(splitMessage(`${paragraph}\n\n${paragraph}`), [paragraph, paragraph])
    const unbroken = 'x'.repeat(MESSAGE_LIMIT + 10)
    assert.deepEqual(
        splitMessage(unbroken).map((part) => part.length),
        [MESSAGE_LIMIT, 10]
    )
    for (const part of splitMessage('a b '.repeat(2000))) assert.ok(part.length <= MESSAGE_LIMIT)
})

test('reportFromMessage reads the bot embed', () => {
    const report = reportFromMessage({
        embeds: [
            {
                title: 'Friday game',
                url: 'https://example.test/game/g1',
                description: 'Undo broke',
                timestamp: '2026-10-14T00:00:00.000Z',
                fields: [{ name: 'Versions', value: 'Logic 1 · UI 2 · Site 3' }]
            }
        ]
    })
    assert.equal(report.game, 'Friday game')
    assert.deepEqual(report.fields, { Versions: 'Logic 1 · UI 2 · Site 3' })
    assert.equal(reportFromMessage({ embeds: [] }), undefined)
})

test('reporterFromField reads the name and any Discord id', () => {
    assert.deepEqual(reporterFromField('second (<@683304076896763918>)'), {
        name: 'second',
        discordUserId: '683304076896763918'
    })
    assert.deepEqual(reporterFromField('plain user'), { name: 'plain user' })
    assert.equal(reporterFromField(undefined), undefined)
})

test('summarizeMessage flags user text hidden by a missing intent, Replies included', () => {
    const blank = { id: '9', type: 0, author: { username: 'p' }, content: '', embeds: [] }
    assert.equal(summarizeMessage(blank).hidden, true)
    assert.equal(summarizeMessage({ ...blank, type: 19 }).hidden, true)
    assert.equal(summarizeMessage({ ...blank, content: 'hi' }).hidden, undefined)
    assert.equal(summarizeMessage({ ...blank, author: { bot: true } }).hidden, undefined)
})

test('uniqueFilename numbers repeated names and makes them safe', () => {
    const used = new Set()
    assert.equal(uniqueFilename('image.png', used), 'image.png')
    assert.equal(uniqueFilename('image.png', used), 'image-2.png')
    assert.equal(uniqueFilename('image.png', used), 'image-3.png')
    assert.equal(uniqueFilename('my shot?.png', used), 'my_shot_.png')
})

test('parseLimit accepts positive whole numbers only', () => {
    assert.equal(parseLimit(undefined, 25), 25)
    assert.equal(parseLimit('5', 25), 5)
    assert.throws(() => parseLimit('abc', 25), /positive whole number/)
    assert.throws(() => parseLimit('0', 25), /positive whole number/)
})

test('messageContentIntent reads either intent flag', () => {
    assert.equal(messageContentIntent(27262976), false)
    assert.equal(messageContentIntent(1 << 18), true)
    assert.equal(messageContentIntent(1 << 19), true)
})

const report = {
    game: 'Sol Sweet Sol',
    gameUrl: 'https://boardtogether.games/game/g1',
    description: 'Accelerate ability impossible to trigger on mobile.\nMore detail',
    fields: { Game: 'Sol: Last Days of a Star', Reporter: 'second (<@683304076896763918>)' }
}

test('reporterMessage puts the heading, the opening, the note, the quote and the links in order', () => {
    const { subject, text } = reporterMessage(
        'fixed',
        report,
        'Long-press now opens it.',
        'https://discord.com/channels/1/2'
    )
    assert.equal(subject, 'Fixed! The bug you reported is gone')
    assert.equal(
        text,
        [
            'All fixed!',
            "The bug you found is squashed in our latest update. Reload the game and you're all set. Long-press now opens it. Thanks for helping make BoardTogether better!",
            'You wrote: "Accelerate ability impossible to trigger on mobile."',
            'Your game (Sol: Last Days of a Star · Sol Sweet Sol): https://boardtogether.games/game/g1',
            'Your report on our Discord: https://discord.com/channels/1/2 (not on the BoardTogether server yet? Join here: https://discord.gg/5ggK5VGGvA)'
        ].join('\n\n')
    )
})

test('reporterMessage calls a not-a-bug report a report', () => {
    const message = reporterMessage('not a bug', report, 'Tip', 'https://discord.com/channels/1/2')
    assert.equal(message.eyebrow, 'Your report')
    assert.equal(message.footer, 'You sent us this report on BoardTogether.')
    assert.equal(reporterMessage('fixed', report, undefined, '').eyebrow, 'Your bug report')
})

test('checkStageInputs asks fixed for a version and wont fix for a reason', () => {
    assert.throws(() => checkStageInputs('fixed', {}), /--version/)
    assert.throws(() => checkStageInputs('wont fix', {}), /--note/)
    assert.doesNotThrow(() => checkStageInputs('investigating', {}))
})

test('checkStageInputs holds not a bug until the user has approved it', () => {
    assert.throws(() => checkStageInputs('not a bug', { note: 'Tip' }), /--approved/)
    assert.doesNotThrow(() => checkStageInputs('not a bug', { note: 'Tip', approved: true }))
})

test('reporterMessage thanks a suggestion as a suggestion', () => {
    const message = reporterMessage('suggestion', report, undefined, '')
    assert.equal(message.eyebrow, 'Your suggestion')
    assert.equal(message.heading, 'Thanks for the idea!')
    assert.doesNotThrow(() => checkStageInputs('suggestion', {}))
})

test('checkForumInputs asks reproduced for a finding and keeps it off other milestones', () => {
    assert.throws(() => checkForumInputs('reproduced', {}), /--finding/)
    assert.doesNotThrow(() => checkForumInputs('reproduced', { finding: 'Undo leaves the ferry' }))
    assert.throws(() => checkForumInputs('fixed', { finding: 'x' }), /does not go with fixed/)
    assert.doesNotThrow(() => checkForumInputs('fixed', {}))
})

test('forumRecord names the status, with the version for a fix and the finding for a repro', () => {
    assert.equal(forumRecord('fixed', { version: 'Sol UI 6.4.2' }), '**Fixed in Sol UI 6.4.2.**')
    assert.equal(forumRecord('not a bug'), '**Not a bug.**')
    assert.equal(forumRecord('suggestion'), '**Suggestion.**')
    assert.equal(
        forumRecord('reproduced', { finding: ' Undo after a ferry move leaves the ferry. ' }),
        '**Reproduced.**\n\nUndo after a ferry move leaves the ferry.'
    )
})
