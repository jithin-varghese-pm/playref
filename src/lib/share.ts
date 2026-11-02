import { verdictWord } from '../../shared/rules';
import type { Answer } from '../../shared/types';

export function shareText(a: Answer, url: string): string {
  return `Playref verdict: ${verdictWord(a).replace('\n', ' ')}\n"${a.question}"\n${a.line}\n${url}`;
}

/** Opens the phone's share sheet, or copies the verdict when sharing is not available. */
export async function shareVerdict(a: Answer): Promise<'shared' | 'copied' | 'failed'> {
  const url = window.location.origin;
  const text = shareText(a, url);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Playref verdict', text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
