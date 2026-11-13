/** Structured, evidence-based teaching feedback. Never claims to know the player's thoughts. */
export function buildTeachingFeedback({ correct, rule, steps = [], alternative = '', misconception = '', nextPractice = '' }) {
  if (!rule || typeof rule !== 'string') throw new TypeError('A concrete rule explanation is required');
  return {
    result: correct ? 'correct' : 'incorrect',
    rule,
    steps: steps.filter(x => typeof x === 'string' && x.trim()),
    alternative: alternative || null,
    observedIssue: correct ? null : (misconception || 'Review the rule and compare each step with the given information.'),
    nextPractice: nextPractice || null
  };
}

export function makeLesson({ title, objective, explanation, workedExample, checkQuestion, checkAnswer }) {
  for (const key of ['title','objective','explanation','workedExample','checkQuestion','checkAnswer']) {
    if (lessonFieldMissing(arguments[0]?.[key])) throw new TypeError(`Lesson requires ${key}`);
  }
  return { title, objective, explanation, workedExample, checkQuestion, checkAnswer };
}
function lessonFieldMissing(value) { return value === undefined || value === null || value === ''; }
