import { sanitizeText } from '../data/scripts/cleanAndThread';
import { decideEscalationCore } from '../src/server/trpc/routers/escalate';
import { computeClassificationMetrics, computeBinaryMetrics } from '../eval/metricsHelper';
import { INTENT_KEYS, INTENTS } from '../src/taxonomy/intents';

describe('Data Pipeline & PII Sanitization', () => {
  it('masks Twitter user handles and normalizes brand handles', () => {
    const raw = '@SpotifyCares @115887 my app crashed on iOS!';
    const sanitized = sanitizeText(raw);
    expect(sanitized).toContain('@support');
    expect(sanitized).toContain('@user');
    expect(sanitized).not.toContain('@SpotifyCares');
    expect(sanitized).not.toContain('@115887');
  });

  it('masks emails and phone numbers', () => {
    const raw = 'My email is test.user@gmail.com and phone is 555-123-4567';
    const sanitized = sanitizeText(raw);
    expect(sanitized).toContain('[EMAIL]');
    expect(sanitized).toContain('[PHONE]');
    expect(sanitized).not.toContain('test.user@gmail.com');
    expect(sanitized).not.toContain('555-123-4567');
  });

  it('normalizes t.co short links', () => {
    const raw = 'Check this out https://t.co/XyZ12345';
    const sanitized = sanitizeText(raw);
    expect(sanitized).toContain('[LINK]');
    expect(sanitized).not.toContain('https://t.co/XyZ12345');
  });
});

describe('Intent Taxonomy Integrity', () => {
  it('has exactly 9 defined intent categories', () => {
    expect(INTENT_KEYS.length).toBe(9);
  });

  it('every intent has non-empty definitions, guidelines, and fewShotExamples', () => {
    for (const key of INTENT_KEYS) {
      const intent = INTENTS[key];
      expect(intent.name.length).toBeGreaterThan(0);
      expect(intent.definition.length).toBeGreaterThan(10);
      expect(intent.guidelines.length).toBeGreaterThan(10);
      expect(intent.fewShotExamples.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Escalation Decision Logic (Heuristics & Rule Signals)', () => {
  it('escalates on legal threats with a stated reason', async () => {
    const res = await decideEscalationCore(
      'I am contacting my lawyer and will sue Spotify for fraud',
      'subscription_billing',
      0.95,
      0.85,
      'We understand your frustration.'
    );
    expect(res.escalate).toBe(true);
    expect(res.escalationReason).toContain('legal or regulatory action');
    expect(res.priority).toBe('urgent');
    expect(res.targetTeam).toBe('legal');
  });

  it('escalates on compromised or hacked accounts with specific reason', async () => {
    const res = await decideEscalationCore(
      'Someone changed my email and hacked into my Spotify account!',
      'account_access',
      0.92,
      0.80,
      'Please send us a DM.'
    );
    expect(res.escalate).toBe(true);
    expect(res.escalationReason).toContain('compromise');
    expect(res.targetTeam).toBe('security_fraud');
  });

  it('escalates when classifier confidence is below 0.65 threshold', async () => {
    const res = await decideEscalationCore(
      'idk it is doing weird stuff maybe',
      'playback_issue',
      0.45, // low confidence
      0.75,
      'Try restarting.'
    );
    expect(res.escalate).toBe(true);
    expect(res.escalationReason).toContain('below the required 0.65 threshold');
  });

  it('escalates when knowledge base similarity is below 0.50 threshold', async () => {
    const res = await decideEscalationCore(
      'My specialized esoteric device has a rare hardware driver error',
      'app_bug_crash',
      0.90,
      0.35, // low similarity
      'Try reinstalling.'
    );
    expect(res.escalate).toBe(true);
    expect(res.escalationReason).toContain('No sufficiently similar resolved case found in knowledge base');
  });

  it('auto-handles standard issues with high confidence and solid retrieval match', async () => {
    const res = await decideEscalationCore(
      'How do I clear the cache on my iPhone?',
      'app_bug_crash',
      0.95,
      0.88,
      'Go to Settings > Storage > Delete Cache.'
    );
    expect(res.escalate).toBe(false);
    expect(res.escalationReason).toContain('Auto-handled');
  });
});

describe('Evaluation Metrics Helpers', () => {
  it('computes classification accuracy and macro F1 accurately', () => {
    const truth = ['playback_issue', 'playback_issue', 'offline_download', 'app_bug_crash'];
    const pred = ['playback_issue', 'playback_issue', 'offline_download', 'playback_issue'];

    const metrics = computeClassificationMetrics(truth, pred);
    expect(metrics.accuracy).toBe(0.75);
    expect(metrics.macroF1).toBeGreaterThan(0);
    expect(metrics.perClass['playback_issue'].precision).toBeCloseTo(2 / 3, 3);
    expect(metrics.perClass['playback_issue'].recall).toBe(1.0);
  });

  it('computes binary escalation precision, recall, and F1 accurately', () => {
    const truth = [true, true, false, false];
    const pred = [true, false, false, true];

    const metrics = computeBinaryMetrics(truth, pred);
    expect(metrics.truePositives).toBe(1);
    expect(metrics.falsePositives).toBe(1);
    expect(metrics.trueNegatives).toBe(1);
    expect(metrics.falseNegatives).toBe(1);
    expect(metrics.accuracy).toBe(0.5);
    expect(metrics.precision).toBe(0.5);
    expect(metrics.recall).toBe(0.5);
    expect(metrics.f1).toBe(0.5);
  });
});
