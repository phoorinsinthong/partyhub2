/**
 * Math Race — Dynamic question generator
 * Generates arithmetic questions with guaranteed integer answers.
 */

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateQuestion(difficulty) {
  switch (difficulty) {
    case 'easy': {
      const op = pickRandom(['+', '-']);
      let a, b;
      if (op === '+') {
        a = randInt(1, 50);
        b = randInt(1, 50);
        return { question: `${a} + ${b} = ?`, answer: a + b, difficulty };
      } else {
        a = randInt(2, 50);
        b = randInt(1, a); // ensure non-negative result
        return { question: `${a} - ${b} = ?`, answer: a - b, difficulty };
      }
    }

    case 'medium': {
      const type = pickRandom(['add', 'sub', 'mul']);
      if (type === 'add') {
        const a = randInt(10, 200);
        const b = randInt(10, 200);
        return { question: `${a} + ${b} = ?`, answer: a + b, difficulty };
      } else if (type === 'sub') {
        const a = randInt(50, 200);
        const b = randInt(10, a);
        return { question: `${a} - ${b} = ?`, answer: a - b, difficulty };
      } else {
        const a = randInt(2, 12);
        const b = randInt(2, 12);
        return { question: `${a} × ${b} = ?`, answer: a * b, difficulty };
      }
    }

    case 'hard': {
      const type = pickRandom(['mul', 'div', 'multi']);
      if (type === 'mul') {
        const a = randInt(5, 25);
        const b = randInt(3, 15);
        return { question: `${a} × ${b} = ?`, answer: a * b, difficulty };
      } else if (type === 'div') {
        // Ensure clean division
        const b = randInt(2, 12);
        const answer = randInt(3, 20);
        const a = b * answer;
        return { question: `${a} ÷ ${b} = ?`, answer, difficulty };
      } else {
        // Multi-step: (a + b) × c or (a - b) × c
        const op = pickRandom(['+', '-']);
        const c = randInt(2, 6);
        let a, b;
        if (op === '+') {
          a = randInt(2, 15);
          b = randInt(2, 15);
          return { question: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c, difficulty };
        } else {
          a = randInt(5, 20);
          b = randInt(1, a - 1);
          return { question: `(${a} - ${b}) × ${c} = ?`, answer: (a - b) * c, difficulty };
        }
      }
    }

    default:
      return generateQuestion('easy');
  }
}

export function generateRound(difficulty, count = 10) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    questions.push(generateQuestion(difficulty));
  }
  return questions;
}
