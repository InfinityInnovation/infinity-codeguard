# Contributing

Read [the architecture guide](docs/architecture/overview.md) before changing a domain boundary.

## Development workflow

1. Put the change in the application or package that owns the responsibility.
2. Update shared contracts before their producers and consumers.
3. Add focused tests next to the affected application.
4. Update documentation when behavior or configuration changes.
5. Run `pnpm typecheck`, `pnpm lint` and `pnpm test`.

Keep commits focused. Never add real credentials, private source code, raw secrets or scanner findings containing secret values. Scanner integrations require real execution, parsing, malformed-output, timeout and isolation tests.

Avoid monolithic feature files. Web features are divided into `components`, `model`, `views` and `hooks`; API behavior stays inside its Nest domain module; external systems are hidden behind infrastructure adapters.
