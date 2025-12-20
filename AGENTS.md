<core_principles>

<principle name="poc-first-development">
  <requirement>ALWAYS start with POC approach before integration</requirement>
  <reasoning>Direct integration causes testing issues and validation problems</reasoning>
  <workflow>
    - Test APIs with curl commands (request auth details when needed)
    - Document API response structures
    - Create shared abstractions usable in both POC and production
  </workflow>
  <security>
    - Use environment variables from .env for configuration
    - Fetch credentials from KV store dynamically
    - NEVER hardcode credentials or sessions in files
    - Load .env file using: node --env-file=.env script.js or tsx --env-file=.env script.ts
  </security>
</principle>

<principle name="dry-compliance">
  <requirement>STRICTLY check for existing code before implementing</requirement>
  <reasoning>Refactoring duplicated code is expensive overhead</reasoning>
  <action>Extract tightly coupled code for reusability</action>
</principle>

<principle name="software-engineering">
  <requirement>Design for future scope based on POC validation</requirement>
  <standards>Follow SOLID, YAGNI, and DRY principles</standards>
</principle>

</core_principles>

<project_rules>
  <ui>
    - Use shadcn UI components exclusively
    - Use theme variables only (bg-muted, text-foreground, border-border) - NO hardcoded colors
  </ui>

  <authentication>
    - Add loading states using isLoading from useAuth()
  </authentication>

  <build>
    - NEVER run build during development (breaks pnpm dev)
    - ALWAYS run build before committing
  </build>
</project_rules>
