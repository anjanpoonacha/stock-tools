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
    - Use environment variables from .env for configuration. Refer the .env.example for the details
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

  <component_organization>
    - Extract components when file exceeds 200-300 lines
    - Break down complex JSX into smaller, focused components
    - Each component should have a single, clear responsibility
    - Co-locate related components in same directory when they share context
    - Prefer composition over large monolithic components
  </component_organization>

  <authentication>
    - Add loading states using isLoading from useAuth()
  </authentication>

  <build>
    - NEVER run build during development (breaks pnpm dev)
    - ALWAYS run build before committing
  </build>

  <documentation>
    - NEVER create documentation files unless explicitly requested by user
    - NEVER create status/completion markdown files (e.g., *_COMPLETE.md, *_INTEGRATION_COMPLETE.md)
    - NEVER create summary or results markdown files (e.g., *_SUMMARY.md, *_RESULTS.md)
    - Only create documentation when user specifically asks for it
  </documentation>
</project_rules>
