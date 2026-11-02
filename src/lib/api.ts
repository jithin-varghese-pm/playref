import type { Answer, AskResponse } from '../../shared/types';

export async function ask(question: string): Promise<AskResponse> {
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    return (await res.json()) as AskResponse;
  } catch {
    return { status: 'error', message: 'No connection. Try the common fights, they work offline.' };
  }
}

export async function sendFeedback(feedbackKey: string, answer: Answer, correct: boolean): Promise<void> {
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedbackKey, question: answer.question, answer, correct }),
    });
  } catch {
    // Feedback is best effort; never block the player.
  }
}
