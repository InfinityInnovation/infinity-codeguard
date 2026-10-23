# Repository guidance

- Keep TypeScript strict and do not suppress compiler or lint failures.
- Preserve organization boundaries at API, queue, database, cache, and object-storage layers.
- Never commit credentials, scanner output containing secrets, or private source code.
- Do not add Kubernetes or Helm assets; Docker Compose is the deployment target.
- A scanner or engine is not integrated until real execution, parsing, failure, and isolation tests pass.
- Update documentation and tests with behavior changes.
