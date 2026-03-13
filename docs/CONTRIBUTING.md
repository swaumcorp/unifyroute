# Contributing to UnifyRoute

Thanks for contributing.

## Before You Start

- Read `README.md` and docs in `docs/`.
- Search existing issues and pull requests.
- For large changes, open an issue first to align scope.

## Development Setup

```bash
cp sample.env .env
./unifyroute setup
./unifyroute start
```

Run tests:

```bash
./run-tests.sh
```

## Branches And Commits

- Create focused branches from `main`.
- Keep commit messages clear and action-oriented.
- Group related changes; avoid broad mixed commits.

## Pull Requests

Please include:

- Clear summary of what changed and why.
- Linked issue(s), if applicable.
- Test evidence (commands/results).
- Notes on config or migration impact.

## Coding Expectations

- Prefer readable, explicit code.
- Add tests for behavior changes.
- Update docs when commands/config/behavior change.
- Never commit secrets, tokens, or private keys.

## Security Reports

Do not open public issues for security vulnerabilities.
Use the process in `SECURITY.md`.

## Code Of Conduct

By participating, you agree to follow `CODE_OF_CONDUCT.md`.
