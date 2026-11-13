/** Structured, evidence-based teaching feedback. Never claims to know the player's thoughts. */
export interface TeachingInput { correct: boolean; rule: string; steps?: string[]; alternative?: string; misconception?: string; nextPractice?: string }
export function buildTeachingFeedback({ correct, rule, steps = [], alternative = '', misconception = '', nextPractice = '' }: TeachingInput) {
  if (!rule || typeof rule !== 'string') throw new TypeError('A concrete rule explanation is required');
  return {
    result: correct ? 'correct' : 'incorrect',
    rule,
    steps: steps.filter((x) => typeof x === 'string' && x.trim()),
    alternative: alternative || null,
    observedIssue: correct ? null : (misconception || 'Review the rule and compare each step with the given information.'),
    nextPractice: nextPractice || null
  };
}

export interface LessonInput { title: string; objective: string; explanation: string; workedExample: string; checkQuestion: string; checkAnswer: string }
export function makeLesson(input: LessonInput): LessonInput {
  const { title, objective, explanation, workedExample, checkQuestion, checkAnswer } = input;
  for (const key of ['title', 'objective', 'explanation', 'workedExample', 'checkQuestion', 'checkAnswer'] as const) {
    if (lessonFieldMissing(input?.[key])) throw new TypeError(`Lesson requires ${key}`);
  }
  return { title, objective, explanation, workedExample, checkQuestion, checkAnswer };
}
function lessonFieldMissing(value: unknown): boolean { return value === undefined || value === null || value === ''; }
