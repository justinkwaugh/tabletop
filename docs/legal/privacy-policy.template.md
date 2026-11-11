> **Template.** Fill every `{{placeholder}}`, check each statement against your own deployment (`docs/privacy/data-inventory.md` describes what the software does), and delete these notes. Not legal advice.

_Effective {{effectiveDate}}_

{{siteName}} ({{siteUrl}}) is run by {{operator}}, based in {{country}}. In this policy, "we" means {{operator}}. Questions and requests about your data go to **{{contact}}**.

> Name an EU or UK representative here if you have appointed one (GDPR Art. 27). Leave the sentence out if you haven't.

## What we collect and why

| Data                                                                  | Why                                           | Lawful basis (GDPR)  |
| --------------------------------------------------------------------- | --------------------------------------------- | -------------------- |
| Username, email address, password (stored only as a hash)             | Your account and signing in                   | Contract             |
| Linked Google or Discord account ID                                   | Signing in with that account                  | Contract             |
| Your browser's time zone and the reminder hours you choose            | Sending turn reminders at times that suit you | Contract             |
| Games you play: moves, results, scores, votes, and when they happened | Running the games                             | Contract             |
| Chat messages you send in games                                       | Game chat                                     | Contract             |
| League and tournament entries and results                             | Running competitions                          | Contract             |
| Notification settings: Discord link, browser push subscription        | Telling you when it's your turn               | Contract             |
| Bug reports you send, including screenshots and browser details       | Fixing problems you report                    | Legitimate interests |
| Server logs, including IP addresses                                   | Security, abuse prevention and fixing faults  | Legitimate interests |
| Counts of active players, stored as one-way hashes                    | Understanding how the site is used            | Legitimate interests |

> Add any optional features you run, such as time-difference sharing, with its basis (legitimate interests) and how to turn it off.

We don't sell your data, show advertising, or use analytics or tracking services.

## Who can see what

- **Other players** see your username, and your moves, results and chat in games you play. Signed-in users can see league and tournament standings.
- **Anyone with a game's link** can watch that game and read its chat.
- **{{operator}}**, as administrator, can see account details such as your email address when needed to run the site.

## Who processes it for us

| Service        | What for | Location |
| -------------- | -------- | -------- |
| {{processors}} |          |          |

> List each provider your deployment uses: hosting and database, cache, email, real-time messaging, push notification services, sign-in providers. Include any opt-in export such as BG Stats, which happens only when you choose it.

Your data is stored in {{hostingRegion}}.

## How long we keep it

| Data                  | Kept                          |
| --------------------- | ----------------------------- |
| Account               | Until you delete your account |
| Games and chat        | {{gameRetention}}             |
| Sign-in sessions      | Up to 180 days                |
| Email codes and links | 15 minutes                    |
| Game invitations      | 7 days                        |
| Server logs           | {{logRetention}}              |
| Backups               | {{backupRetention}}           |

## Cookies and browser storage

We set one cookie, which keeps you signed in. We also keep copies of your own account and game list in your browser's storage so the site starts quickly, and games you play on a single device stay in that browser. None of this is used for tracking. Google's sign-in page may set its own cookies when you choose to sign in with Google.

## Emails

We only send emails about your account and about games and competitions you take part in. We don't send marketing.

## Your rights

You can ask us to:

- give you a copy of your data;
- correct it;
- delete your account;
- stop using your data for something we do on the basis of legitimate interests.

Write to **{{contact}}**. We'll reply within a month. If you're in the EU or UK, you can also complain to your data protection authority.

## Children

You must be {{minimumAge}} or older to use {{siteName}}. If we learn that an account belongs to someone younger, we delete it.

## Do Not Track

{{siteName}} doesn't track you across sites, so it doesn't respond differently to browser Do Not Track signals.

## Changes

We'll post any change here with a new effective date, and tell you on the site before a significant change takes effect.
