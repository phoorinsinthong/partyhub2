# Matt Pocock's Skills for Real Engineers

This project follows the engineering standards and workflows defined in Matt Pocock's "Skills for Real Engineers".

## Core Engineering Workflows

### 1. `diagnose`
Use this for hard bugs, performance regressions, or flaky tests.
**Process**: `reproduce` → `minimise` → `hypothesise` → `instrument` → `fix` → `regression-test`.
- **Feedback Loop**: Spend time creating a fast, deterministic pass/fail signal.
- **Hypotheses**: Generate 3-5 falsifiable hypotheses before testing any.
- **Verification**: Only proceed to fix once the cause is understood and verified by instrumentation.

### 2. `tdd`
Follow vertical-slice Test-Driven Development.
- **Red**: Write a failing test for a specific behavior (integration/E2E level preferred).
- **Green**: Implement the minimum code to pass the test.
- **Refactor**: Improve the code while keeping tests passing.
- **Note**: Implementation should be through public interfaces, not horizontal internal layers.

### 3. `grill-with-docs`
Challenge every design or plan against the project's documentation.
- Use `CONTEXT.md` to ensure "ubiquitous language" (domain terminology).
- Check `docs/adr/` for existing architectural decisions.
- Proactively update `CONTEXT.md` or create new ADRs when making significant changes.

### 4. `improve-codebase-architecture`
Periodically review the codebase for "ball of mud" patterns.
- Deepen modules by hiding internal complexity.
- Align logic with the domain model in `CONTEXT.md`.

## Productivity & Planning

### 1. `to-prd`
Synthesize conversations into a Product Requirements Document (PRD).
- Define goals, non-goals, user stories, and technical constraints.

### 2. `to-issues`
Break down a plan or PRD into "independently-grabbable" tasks.
- Prioritize vertical slices (end-to-end features).
- Format as GitHub issues or local markdown tasks.

### 3. `caveman`
If requested, use ultra-compressed communication to save context and speed up interaction.
- Drop filler words, keep technical accuracy.

### 4. `zoom-out`
Provide high-level architectural perspectives on the system or specific features.
- Explain "how it fits together" rather than just "how it works".

## Documentation
- **`CONTEXT.md`**: The source of truth for domain language and system architecture.
- **`docs/adr/`**: Records of significant architectural decisions.
