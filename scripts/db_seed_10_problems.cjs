const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

// We require static problems from problems.js
// Since Next.js uses ESM imports, we will define STATIC_PROBLEMS directly here
const STATIC_PROBLEMS = {
  '1': { id: 1, slug: 'two-sum', title: '1. Two Sum', difficulty: 'Easy', desc: 'Given an array of integers...', entry: '{"type": "class-method", "className": "Solution", "methodName": "twoSum"}', constraints: '["2 <= nums.length <= 10^4"]' },
  '2': { id: 2, slug: 'reverse-string', title: '2. Reverse String', difficulty: 'Easy', desc: 'Write a function that reverses...', entry: '{"type": "class-method", "className": "Solution", "methodName": "reverseString"}', constraints: '["1 <= s.length <= 10^5"]' },
  '3': { id: 3, slug: 'palindrome-number', title: '3. Palindrome Number', difficulty: 'Easy', desc: 'Given an integer...', entry: '{"type": "class-method", "className": "Solution", "methodName": "isPalindrome"}', constraints: '["-2^31 <= x <= 2^31 - 1"]' },
  '4': { id: 4, slug: 'fizz-buzz', title: '4. Fizz Buzz', difficulty: 'Easy', desc: 'Given an integer...', entry: '{"type": "class-method", "className": "Solution", "methodName": "fizzBuzz"}', constraints: '["1 <= n <= 10^4"]' },
  '5': { id: 5, slug: 'single-number', title: '5. Single Number', difficulty: 'Easy', desc: 'Given a non-empty array...', entry: '{"type": "class-method", "className": "Solution", "methodName": "singleNumber"}', constraints: '["1 <= nums.length <= 3 * 10^4"]' },
  '6': { id: 6, slug: 'contains-duplicate', title: '6. Contains Duplicate', difficulty: 'Easy', desc: 'Given an integer array...', entry: '{"type": "class-method", "className": "Solution", "methodName": "containsDuplicate"}', constraints: '["1 <= nums.length <= 10^5"]' },
  '7': { id: 7, slug: 'fibonacci-number', title: '7. Fibonacci Number', difficulty: 'Easy', desc: 'The Fibonacci numbers...', entry: '{"type": "class-method", "className": "Solution", "methodName": "fib"}', constraints: '["0 <= n <= 30"]' },
  '8': { id: 8, slug: 'valid-anagram', title: '8. Valid Anagram', difficulty: 'Easy', desc: 'Given two strings...', entry: '{"type": "class-method", "className": "Solution", "methodName": "isAnagram"}', constraints: '["1 <= s.length, t.length <= 5 * 10^4"]' },
  '9': { id: 9, slug: 'length-of-last-word', title: '9. Length of Last Word', difficulty: 'Easy', desc: 'Given a string...', entry: '{"type": "class-method", "className": "Solution", "methodName": "lengthOfLastWord"}', constraints: '["1 <= s.length <= 10^4"]' },
  '10': { id: 10, slug: 'add-digits', title: '10. Add Digits', difficulty: 'Easy', desc: 'Given an integer...', entry: '{"type": "class-method", "className": "Solution", "methodName": "addDigits"}', constraints: '["0 <= num <= 2^31 - 1"]' }
};

async function seed() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not defined in .env.local');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('--- Seeding 10 Problems into Database ---');

    for (const [key, p] of Object.entries(STATIC_PROBLEMS)) {
      console.log(`Seeding problem ${p.id}: ${p.title}...`);
      await sql`
        INSERT INTO problems (id, slug, title, difficulty, description, entry, constraints)
        VALUES (${p.id}, ${p.slug}, ${p.title}, ${p.difficulty}, ${p.desc}, ${p.entry}::jsonb, ${p.constraints}::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET slug = EXCLUDED.slug,
            title = EXCLUDED.title,
            difficulty = EXCLUDED.difficulty,
            description = EXCLUDED.description,
            entry = EXCLUDED.entry,
            constraints = EXCLUDED.constraints
      `;
      // Also sync serial sequence if we insert IDs manually
      await sql`SELECT setval('problems_id_seq', COALESCE((SELECT MAX(id)+1 FROM problems), 1), false)`;
    }

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding 10 problems failed:', err.message);
    process.exit(1);
  }
}

seed();
