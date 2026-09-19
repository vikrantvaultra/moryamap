import { describe, expect, it } from 'vitest';
import { chantLines, pickChantVoice } from './chant';

const v = (name: string, lang: string) => ({ name, lang });

// What real devices list (names as they report them).
const MAC_CHROME = [
  v('Samantha', 'en-US'),
  v('Daniel', 'en-GB'),
  v('Rishi', 'en-IN'),
  v('Lekha', 'hi-IN'),
  v('Google US English', 'en-US'),
  v('Google हिन्दी', 'hi-IN'),
];
const ANDROID = [v('English United States', 'en_US'), v('Hindi India', 'hi_IN'), v('Marathi India', 'mr_IN')];
const IPHONE_NO_HINDI = [v('Samantha', 'en-US'), v('Rishi', 'en-IN')];
const NO_INDIAN = [v('Samantha', 'en-US'), v('Daniel', 'en-GB')];

describe('the chant voice', () => {
  it('prefers Google’s Indian voices where present', () => {
    expect(pickChantVoice(MAC_CHROME)?.voice.name).toBe('Google हिन्दी');
    expect(pickChantVoice([...MAC_CHROME, v('Google मराठी', 'mr-IN')])?.voice.name).toBe('Google मराठी');
  });

  it('reads Android’s underscore locales', () => {
    expect(pickChantVoice(ANDROID)).toMatchObject({ voice: { lang: 'hi_IN' }, script: 'hindi' });
  });

  it('falls back to Indian English with romanised words', () => {
    expect(pickChantVoice(IPHONE_NO_HINDI)).toMatchObject({ voice: { name: 'Rishi' }, script: 'latin' });
  });

  it('never uses a US or UK voice — silence instead', () => {
    expect(pickChantVoice(NO_INDIAN)).toBeNull();
    expect(pickChantVoice([])).toBeNull();
  });
});

describe('the chant', () => {
  it('is call and response, with the answer slower and higher', () => {
    const lines = chantLines('hindi');
    expect(lines.map((l) => l.text)).toEqual(['गणपति बप्पा', 'मोरया!', 'मंगलमूर्ति', 'मोरया!']);
    expect(lines[1].rate).toBeLessThan(lines[0].rate);
    expect(lines[1].pitch).toBeGreaterThan(lines[0].pitch);
  });

  it('is spelled for the voice that reads it', () => {
    expect(chantLines('marathi')[0].text).toBe('गणपती बाप्पा');
    expect(chantLines('latin')[1].text).toBe('Morya!');
  });
});
