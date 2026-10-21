import sql from '../packages/database/src/client.js';

import { comparePassword } from '../packages/core/src/utils/auth.js';

import { generateToken } from '../packages/core/src/utils/auth.js';
import { SubmissionService } from '../packages/core/src/services/SubmissionService.js';
import { PracticalService } from '../packages/core/src/modules/practicals/PracticalService.js';

async function main() {
  const testCases = await sql`
    SELECT tc.id, tc.practical_id, tc.label, tc.is_hidden, tc.input, tc.expected, p.title
    FROM practical_test_cases tc
    JOIN practicals p ON tc.practical_id = p.id
    ORDER BY tc.practical_id DESC, tc.order_index ASC LIMIT 20
  `;
  console.log('Sample test cases:', JSON.stringify(testCases, null, 2));

  // Count test cases per practical
  const counts = await sql`
    SELECT p.id, p.title, count(tc.id) as test_case_count
    FROM practicals p
    LEFT JOIN practical_test_cases tc ON tc.practical_id = p.id
    GROUP BY p.id, p.title
    ORDER BY p.id DESC
  `;
  console.log('Test case counts per practical:', JSON.stringify(counts, null, 2));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
