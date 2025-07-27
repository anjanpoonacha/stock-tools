# Purpose: A workflow to test a local API endpoint with curl, use its live response, and then adapt the Next.js UI code to match the data structure.

# Workflow: API-to-UI Integration

## 1. Identify Target and Construct Command
- When a test is required to bridge an API and UI, first identify the local API endpoint (e.g., `/api/products/{id}`).
- Construct the `curl` command to call this endpoint on the local Next.js development server (e.g., `http://localhost:3000`).

## 2. Prompt for Dynamic Variables (Interactive Step)
- Before executing the command, you **must** analyze it for any required variables (e.g., path parameters like an ID, query strings, or a request body for POST/PUT).
- **Pause and ask the user to provide a value for each variable.** Do not proceed without this input.
- Example prompt to user: "The `curl` command needs a `productId`. What value should I use?"

## 3. Execute, Capture, and Analyze
- Once you have the variables, execute the complete `curl` command.
- Capture the JSON response from the local API.
- Analyze the structure of the response (the keys, nesting, and data types) and present a summary to the user.
- Example summary: "Success! The API returned an object with: `id` (string), `productName` (string), and `inStock` (boolean)."

## 4. Adapt UI Code with Live Data
- With the confirmed data structure, locate the relevant Next.js page or component that needs to be updated.
- Modify the UI code to correctly handle the API response. This may include:
    - Updating TypeScript interfaces or types.
    - Changing data fetching logic.
    - Adjusting how data is accessed in the JSX (e.g., changing `data.name` to `data.productName`).
- Present a code diff of the UI changes for user review and approval. Your task is not complete until the user confirms the UI modification.
