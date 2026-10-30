export enum ActionType {
    Travel = 'travel',
    Muster = 'muster',
    Trade = 'trade',
    Search = 'search',
    SearchResolve = 'searchResolve',
    /** Great Spire — after the draw and before the discard (R-5.1.2, R-5.1.3). */
    SearchSwap = 'searchSwap',
    Recover = 'recover',
    Campaign = 'campaign',
    /** R-5.5.3 — after the Citizens asked to join the defence have answered. */
    CampaignAttackPlans = 'campaignAttackPlans',
    /** R-5.5.3, R-7.5.2 */
    CampaignDefend = 'campaignDefend',
    /** R-4.3.5, R-7.3.4 — once each. */
    UseRestPower = 'useRestPower',
    /** R-5.5.5 — from revision 7, after the roll. */
    CampaignSkullLosses = 'campaignSkullLosses',
    CampaignSacrifice = 'campaignSacrifice',
    /** R-5.5.6.a */
    CampaignDefeatKills = 'campaignDefeatKills',
    CampaignResolveVictory = 'campaignResolveVictory',

    /** R-6.1 — faceup, or discard it. */
    PlayFacedownAdviser = 'playFacedownAdviser',
    /** R-6.2 */
    UseActionPower = 'useActionPower',
    /** R-6.3 */
    Peek = 'peek',
    /** R-6.1, R-9.4, R-6.6.1 */
    LetPeek = 'letPeek',
    /** R-6.5, R-6.5.a, R-6.5.b */
    MoveWarbands = 'moveWarbands',
    /** R-6.6.1 */
    OfferCitizenship = 'offerCitizenship',
    /** R-6.6.2 */
    ResolveCitizenshipOffer = 'resolveCitizenshipOffer',
    /** R-6.5.a, R-6.5.b, R-5.5.2.a */
    AnswerConsent = 'answerConsent',
    AnswerQuestion = 'answerQuestion',
    /** R-6.7 */
    ExileCitizen = 'exileCitizen',
    /** R-6.8 */
    SelfExile = 'selfExile',
    /** R-7.6.3-H1 — a party to an open Tribunal deal asks the other to confirm it was kept. */
    ClaimDealKept = 'claimDealKept',
    /** R-7.6.3-H1 — a party to an open Tribunal deal closes it unconfirmed, asking no one. */
    LeaveDealUnconfirmed = 'leaveDealUnconfirmed',

    /** R-4.1 */
    ResolveWake = 'resolveWake',
    /** R-4.2 */
    EndActPhase = 'endActPhase',
    /** R-10.2 — a free action a power grants comes next or not at all. */
    ForgoFreeAction = 'forgoFreeAction',
    /** R-4.3 */
    CompleteRest = 'completeRest',
    /** R-3.3 */
    RollEndDie = 'rollEndDie',
    /** R-2.11.b — the outgoing holder chooses who takes the Oathkeeper title. */
    ResolveOathkeeper = 'resolveOathkeeper',
    /** R-2.11-H1 — the title changing hands, recorded as its own System Action. */
    TransferOathkeeper = 'transferOathkeeper',

    /** R-1.23.1–R-1.23.3 */
    SetupChoice = 'setupChoice',

    /** R-8.1 — the winner vows the next game's Oath. */
    ChooseOath = 'chooseOath',
    /** R-8.2 — an Exile winner's offers, made together. */
    OfferChronicleCitizenship = 'offerChronicleCitizenship',
    /** R-8.2, R-X.1 — each offered Exile's own answer. */
    AnswerChronicleCitizenship = 'answerChronicleCitizenship',
    /** R-8.3.1 */
    BuildOrRepairEdifice = 'buildOrRepairEdifice',
    /** R-8.4 — among the tied suits. */
    ChooseChronicleSuit = 'chooseChronicleSuit',
    /** R-8.4.a-H1 — among the tied Dispossessed stacks. */
    ChooseHealStack = 'chooseHealStack',
    /** The winner's story, written once into the record. */
    WriteChronicleStory = 'writeChronicleStory',
    SkipChronicleStory = 'skipChronicleStory',

    // R-8 — what the rules settle alone, each step a System Action of its own.
    /** The Chronicle begins: the winner and how they won. */
    ChronicleStart = 'chronicleStart',
    /** R-8.1 — a win with a Vision alone vows that Vision's Oath. */
    ChronicleForcedVow = 'chronicleForcedVow',
    /** R-8.2 — an Exile winner flips every Citizen board, the box's too. */
    ChronicleFlipCitizens = 'chronicleFlipCitizens',
    /** R-8.3.2 to R-8.3.5 */
    ChronicleMap = 'chronicleMap',
    /** R-8.4 — one suit leads the winner's advisers. */
    ChronicleSettleSuit = 'chronicleSettleSuit',
    /** R-8.4, R-8.4.a */
    ChronicleAddCards = 'chronicleAddCards',
    /** R-8.4.a-H1 — the draw from the stack the winner chose. */
    ChronicleHeal = 'chronicleHeal',
    /** R-8.5 */
    ChronicleDispossess = 'chronicleDispossess',
    /** R-8.6 */
    ChronicleRelics = 'chronicleRelics',
    /** R-8.7, R-8.8 */
    ChronicleRebuild = 'chronicleRebuild'
}
