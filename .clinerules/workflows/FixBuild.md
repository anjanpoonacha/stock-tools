### Agent Workflow: Iterative Build and Fix Cycle (v2)

**Goal:** To successfully execute the `pnpm run build` command by iteratively identifying, fixing, and re-validating until all build errors are resolved. Upon success, the changes must be documented in the memory bank.

### Phase 1: Execute and Diagnose

1.  **Execute Build Command:**
    *   Run the command: `pnpm run build`
    *   Capture all output (stdout and stderr) and the final exit code.

2.  **Analyze Exit Code:**
    *   **If the exit code is `0` (Success):** The build is successful. Proceed directly to **Phase 3: Completion**.
    *   **If the exit code is non-zero (Failure):** There is a build error. Proceed to **Phase 2: Resolution Loop**.

### Phase 2: Resolution Loop (Triggered by Failure)

1.  **Error Analysis:**
    *   Carefully read the captured stderr from the failed build command.
    *   Identify the specific error message(s), the file(s) implicated, and the line number(s).

2.  **Formulate a Fix:**
    *   Based on the error analysis, determine the root cause of the failure.
    *   Propose a specific code modification to address the identified cause.
    *   **Hard Constraint: Do Not Use Disable Comments.**
        *   **You are explicitly forbidden from using `// eslint-disable-next-line`, `@ts-ignore`, or any other comment-based mechanism to suppress or ignore linter or type-checker errors.**
        *   The fix must address the underlying problem directly (e.g., correct a type, refactor logic, add a missing dependency).

3.  **Apply the Fix:**
    *   Write the proposed code modifications to the relevant file(s).

4.  **Return to Start:**
    *   Go back to **Phase 1, Step 1** and re-run `pnpm run build` to validate the fix.
    *   Continue this loop until the build command succeeds.

### Phase 3: Completion (Triggered by Success)

1.  **Confirm Success:**
    *   State that `pnpm run build` has completed successfully.

2.  **MANDATORY MEMORY UPDATE:**
    *   This workflow is not complete until the memory bank is updated according to the `Strategic Memory Bank Maintenance` global rule.
    *   **a. Identify Context:** The context is "Build Fix" or related to the specific feature/component that was being worked on.
    *   **b. Locate/Create File:** Find the appropriate memory file (e.g., `/memory_bank/by-component/build_process.md`).
    *   **c. Append Formatted Entry:** Add a new entry to the file using the standard template.

    **Example Memory Entry:**
    ```markdown
    ---
    ### 2025-07-27 - Resolved Build Failure in User Profile Component
    *   **Task/Goal:** Successfully run `pnpm run build` to resolve blocking errors.
    *   **State Before:** The build was failing due to a TypeScript type mismatch in `src/components/UserProfile.tsx`. The component expected a `number` for `userId` but was receiving a `string`.
    *   **State After:** The type error is resolved by correctly parsing the prop. The `pnpm run build` command now completes successfully without using any disable comments.
    *   **Reasoning:** A parent component was passing the `userId` prop as a string instead of a number. The fix involved adding `parseInt()` at the point of prop passing to ensure type consistency, addressing the root cause.
    *   **Files Changed:**
        *   `src/components/UserProfile.tsx`
    *   **Open Questions/Future Work:** None. This resolves the immediate issue.
    ```

### Implementation Directives for the Agent

*   **Maximum Retries:** To prevent an infinite loop, if the build fails more than 5 times in a row on the *same error*, stop and ask for human guidance.
*   **Statefulness:** Keep a memory of the fixes you have already attempted within this loop to avoid re-applying a failed fix.