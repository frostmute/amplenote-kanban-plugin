# Document 4: Verify Test Coverage

## Context

- **Playbook**: Code Review
- **Agent**: Amplenote Kanban
- **Project**: /Users/thewytchhaus/Documents/GitHub/amplenote-kanban-plugin
- **Date**: 2026-06-27
- **Working Folder**: /Users/thewytchhaus/Documents/GitHub/amplenote-kanban-plugin/.maestro/playbooks/2026-06-26-Amplenote-Kanban-Plugin

## Purpose

Evaluate test coverage for the changed code and assess test quality.

## Prerequisites

- `/Users/thewytchhaus/Documents/GitHub/amplenote-kanban-plugin/.maestro/playbooks/2026-06-26-Amplenote-Kanban-Plugin/REVIEW_SCOPE.md` exists from Document 1

## Tasks

### Task 1: Load Context

- [x] **Read scope**: Load `/Users/thewytchhaus/Documents/GitHub/amplenote-kanban-plugin/.maestro/playbooks/2026-06-26-Amplenote-Kanban-Plugin/REVIEW_SCOPE.md` to identify changed source files.

### Task 2: Identify Test Files

- [x] **Find related tests**: For each changed source file, locate corresponding test files:
  - Look for `*.test.*`, `*.spec.*` files
  - Check `__tests__/` directories
  - Check `test/` or `tests/` directories
  - Match by filename or module name

- [x] **Check for new tests**: Verify if new tests were added for new functionality.

### Task 3: Assess Test Coverage

- [x] **New code coverage**: For each new function/method:
  - Is there at least one test?
  - Are happy path cases covered?
  - Are error cases covered?
  - Are edge cases covered?

- [x] **Modified code coverage**: For modified code:
  - Do existing tests still pass? (conceptually)
  - Were tests updated to reflect changes?
  - Is new behavior tested?

- [x] **Coverage gaps**: Identify untested:
  - New public functions/methods
  - New branches/conditions
  - Error handling paths
  - Integration points

### Task 4: Evaluate Test Quality

- [x] **Test structure**: Check tests for:
  - Clear test names describing behavior
  - Proper setup/teardown
  - Single assertion focus (where appropriate)
  - No test interdependencies

- [x] **Mocking**: Verify:
  - External dependencies are mocked
  - Mocks are realistic
  - No over-mocking (testing implementation, not behavior)

- [x] **Assertions**: Check:
  - Meaningful assertions (not just "no error")
  - Correct expected values
  - Appropriate assertion types

- [x] **Test maintainability**: Look for:
  - Magic numbers without explanation
  - Overly complex test setup
  - Brittle tests (likely to break with minor changes)
  - Test data duplication

### Task 5: Run Tests (if possible)

- [x] **Execute test suite**: If test runner is available:
  ```bash
  npm test  # or equivalent
  ```
  Note any failures or warnings.

### Task 6: Document Test Gaps

- [x] **Create TEST_GAPS.md**: Write findings to `/Users/thewytchhaus/Documents/GitHub/amplenote-kanban-plugin/.maestro/playbooks/2026-06-26-Amplenote-Kanban-Plugin/TEST_GAPS.md`:

```markdown
# Test Coverage Review

## Missing Tests
[New code without test coverage]

## Inadequate Tests
[Tests that don't fully cover the functionality]

## Test Quality Issues
[Problems with existing tests]

## Test Improvements
[Suggestions for better testing]

## Well-Tested Areas
[Positive observations about test coverage]

## Test Execution Results
[If tests were run, note results here]
```

For each gap include:
- Source file and function/method
- What's missing or inadequate
- Suggested test cases
- Priority: High / Medium / Low

## Success Criteria

- ✅ Test files identified for changed code
- ✅ Coverage gaps documented
- ✅ Test quality assessed
- ✅ TEST_GAPS.md created

## Status

Mark complete when test review document is created.

---

**Next**: Document 5 will compile all findings into a summary.
