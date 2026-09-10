/**
 * Single source of truth for Intent Taxonomy.
 * Derived empirically from Spotify customer support conversations on Twitter.
 */

export interface IntentDefinition {
  id: string;
  name: string;
  definition: string;
  guidelines: string;
  fewShotExamples: string[];
}

export const INTENTS: Record<string, IntentDefinition> = {
  playback_issue: {
    id: 'playback_issue',
    name: 'Playback Issue',
    definition: 'Problems with music playback controls, audio stopping, stuttering, tracks skipping, or unexpected shuffle/repeat behavior.',
    guidelines: 'Use when the user can access the app but songs will not play smoothly, pause automatically, won\'t repeat, or shuffle behaves erratically.',
    fewShotExamples: [
      'i’m pissed my shuffle and repeat button just don’t fucking work and i’m getting frustrated',
      'can you fix this bug on the app where my music automatically pauses every 0.2 seconds without me even touching it? thx',
      'My music keeps cutting out every 30 seconds when streaming over WiFi.',
    ],
  },
  offline_download: {
    id: 'offline_download',
    name: 'Offline & Downloads',
    definition: 'Issues downloading songs or playlists, downloaded tracks disappearing, or offline mode failing without internet.',
    guidelines: 'Use when the customer is specifically trying to download music or play downloaded content without a network connection.',
    fewShotExamples: [
      'Hi, I"m having trouble with my premium account. I don\'t have ads, but I can\'t download, change songs and listen offline',
      'All my downloaded playlists got deleted overnight on my SD card. How do I get them back?',
      'Songs won\'t download for offline listening, it just says "waiting to download" forever.',
    ],
  },
  content_availability: {
    id: 'content_availability',
    name: 'Content Availability & Catalog',
    definition: 'Inquiries about missing albums, greyed-out songs, regional music availability, or requests to add specific songs/artists.',
    guidelines: 'Use when a specific artist, track, album, or soundtrack cannot be found or is greyed out/disabled in the user\'s region.',
    fewShotExamples: [
      'why are Nena\'s releases between 2002 and 2012 all missing, yet everything else from 1982 - 2017 is there? #emptyplaylist',
      'Keep getting the message "song not available" for ALL songs in my playlists and also yours. Premium is paid. Whats wrong?',
      'can you upload the Solo version of "Umbrella" (a Rihanna song)?',
    ],
  },
  subscription_billing: {
    id: 'subscription_billing',
    name: 'Subscription & Billing',
    definition: 'Questions or problems regarding payment processing, card declines, student discount verification, family plan invites, or unexpected charges.',
    guidelines: 'Use for billing inquiries, price questions, subscription tiers (Free vs Premium vs Family vs Student), and unexpected charges.',
    fewShotExamples: [
      'My payment will not go through. Help. card keeps getting rejected but funds are there',
      'why am I getting hassled with stealth ads for apps when I have already paid for premium? Not happy',
      'I subscribe to your family subscription and when i invite my family and accept my invitation they cant accept it',
      'just trying to change my payment details, but keeps routing me to confirm student details. not a student anymore',
    ],
  },
  account_access: {
    id: 'account_access',
    name: 'Account Access & Security',
    definition: 'Inability to log in, password resets, compromised/hacked accounts, email changes, or Facebook linking/unlinking.',
    guidelines: 'Use when the user is locked out of their account, suspects fraud/unauthorized access, or needs credentials changed.',
    fewShotExamples: [
      'Someone has changed my email and hacked my Spotify, now I can’t get back in',
      'have just signed up but it says my FB account is linked to a different account. Definitely only just signed up. Can u unlink?',
      'I need help resetting my password. I think someone hacked my account and changed it',
    ],
  },
  app_bug_crash: {
    id: 'app_bug_crash',
    name: 'App Bug & Crash',
    definition: 'App crashing, freezing, failing to start, UI rendering glitches, or operating system compatibility bugs (iOS, Android, Desktop, Web).',
    guidelines: 'Use when the application software crashes on launch, freezes on a specific screen, or the web player fails to load completely.',
    fewShotExamples: [
      'clicking on the heart crashes the app on iPhone 6s on iOS11 every time',
      'what is happening with the web player? Same issue as two days ago. Help! #Spotify',
      'The Windows 10 app is a bugfest. It crashes whenever I open the Albums view.',
    ],
  },
  feature_request: {
    id: 'feature_request',
    name: 'Feature Request & Ideas',
    definition: 'Suggestions for new functionality, UI changes (sleep timer, playlist sorting, blacklisting artists), or launching Spotify in new countries.',
    guidelines: 'Use when the customer is proposing an idea, voting on a feature, or asking when Spotify will launch in an unsupported country.',
    fewShotExamples: [
      'I encourage Spotify to build a sleep timer into the App itself... Even more I challenge you!! Haha good night !',
      'please put Spotify in South Africa 🙏🏽🙏🏽😭',
      'Please have an option in the Spotify Web Player to sort the playlist... I am really missing that feature',
    ],
  },
  feedback_complaint: {
    id: 'feedback_complaint',
    name: 'Feedback & Complaint',
    definition: 'General compliments, positive user experiences, or venting non-technical frustration about business decisions, UI redesigns, or pricing.',
    guidelines: 'Use for praise, compliments, or general venting that does not report an actionable software bug or technical defect.',
    fewShotExamples: [
      'Very fast Response to discrepancy. glad to be a premium member',
      'Just had a really great customer experience with the service in Germany. These guys are fast! Thanks',
      'why did you remove sharing songs within your platform. I used it daily. you dropping features and not the price is a bit **** dont you think?',
    ],
  },
  human_escalation_required: {
    id: 'human_escalation_required',
    name: 'Human Escalation Required',
    definition: 'Explicit demands to speak to a human representative, telephone support requests, legal threats, or active security emergencies.',
    guidelines: 'Use when the customer explicitly refuses automated help, demands a phone agent, threatens legal/regulatory action, or reports identity theft.',
    fewShotExamples: [
      'what kind of company doesn\'t give a customer service phone number to call? Your ask the community trouble shooting is bullshit. I need a real human NOW',
      'I already messaged you guys 3 times and no human is replying. I am contacting my lawyer and filing a fraud report',
      'Give me a representative on the line immediately regarding unauthorized charges on my bank statement',
    ],
  },
};

export type IntentKey = keyof typeof INTENTS;

export const INTENT_KEYS = Object.keys(INTENTS) as IntentKey[];

export function formatTaxonomyForPrompt(): string {
  return Object.values(INTENTS)
    .map(
      intent => `### ${intent.id} (${intent.name})
Definition: ${intent.definition}
Guidelines: ${intent.guidelines}
Examples:
${intent.fewShotExamples.map(ex => `- "${ex}"`).join('\n')}`
    )
    .join('\n\n');
}
