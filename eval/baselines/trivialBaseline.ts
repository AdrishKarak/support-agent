import { INTENT_KEYS, IntentKey } from '../../src/taxonomy/intents';

export interface TrivialBaselineOutput {
  intent: IntentKey;
  confidence: number;
  reply: string;
  escalate: boolean;
  escalationReason: string;
}

const CANNED_REPLIES: Record<IntentKey, string> = {
  playback_issue:
    'Hi there! Please try restarting your device and Spotify app, and check your internet connection: [LINK]',
  offline_download:
    'Hey! To fix offline issues, check that your device has enough storage and toggle offline mode off and on: [LINK]',
  content_availability:
    'Thanks for reaching out! Music availability varies by region and licensing agreements. Check out our music catalog FAQ: [LINK]',
  subscription_billing:
    'Hi! For billing questions, check your account page to verify your subscription tier and payment method: [LINK]',
  account_access:
    'Hello! If you have trouble logging in, please use our password reset page or send us a DM with your account email: [LINK]',
  app_bug_crash:
    'Hey there! Please try performing a clean reinstall of the Spotify app on your device: [LINK]',
  feature_request:
    'Thanks for the suggestion! We have shared this idea with our product team. You can also vote on features at [LINK]',
  feedback_complaint:
    'Thanks for sharing your feedback with us! We appreciate your patience and will pass this on to the team.',
  human_escalation_required:
    'Please send us a Direct Message with your account email address and details so a human support specialist can investigate: [LINK]',
};

export function runTrivialBaseline(message: string): TrivialBaselineOutput {
  const lower = message.toLowerCase();

  // Keyword-based intent classification
  let intent: IntentKey = 'feedback_complaint';

  if (lower.includes('lawyer') || lower.includes('phone') || lower.includes('real human') || lower.includes('real person') || lower.includes('speak to')) {
    intent = 'human_escalation_required';
  } else if (lower.includes('hacked') || lower.includes('password') || lower.includes('login') || lower.includes('account')) {
    intent = 'account_access';
  } else if (lower.includes('pay') || lower.includes('bill') || lower.includes('card') || lower.includes('charge') || lower.includes('student') || lower.includes('family')) {
    intent = 'subscription_billing';
  } else if (lower.includes('download') || lower.includes('offline')) {
    intent = 'offline_download';
  } else if (lower.includes('missing') || lower.includes('song not available') || lower.includes('album') || lower.includes('track') || lower.includes('artist')) {
    intent = 'content_availability';
  } else if (lower.includes('crash') || lower.includes('freeze') || lower.includes('web player')) {
    intent = 'app_bug_crash';
  } else if (lower.includes('feature') || lower.includes('sleep timer') || lower.includes('please add') || lower.includes('wish')) {
    intent = 'feature_request';
  } else if (lower.includes('shuffle') || lower.includes('repeat') || lower.includes('pause') || lower.includes('skip') || lower.includes('play')) {
    intent = 'playback_issue';
  }

  // Trivial escalation rule
  const shouldEscalate =
    intent === 'human_escalation_required' ||
    lower.includes('lawyer') ||
    lower.includes('sue') ||
    lower.includes('fraud') ||
    lower.includes('hacked');

  const escalationReason = shouldEscalate
    ? 'Keyword trigger matched human escalation or critical security pattern'
    : 'Auto-handled with canned keyword reply';

  return {
    intent,
    confidence: 0.50, // fixed heuristic confidence
    reply: CANNED_REPLIES[intent],
    escalate: shouldEscalate,
    escalationReason,
  };
}
