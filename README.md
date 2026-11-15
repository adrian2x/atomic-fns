# atomic-fns

A utility library with no runtime dependencies that fills the gaps the platform leaves: collection helpers and data structures, object paths, deep equality and cloning, exact decimal arithmetic, array operations, function and async helpers, strings, numbers, ids, hashing and encoding.

Install from npm with `npm install atomic-fns`, or from JSR with `deno add jsr:@atomic-stack/atomic-fns`.

## Import

```ts
import { Decimal, keys, Heap } from 'atomic-fns'
import { SortedMap } from 'atomic-fns/collections'
```

Every export is available from the root and its area subpath. [docs/design.md](https://github.com/adrian2x/atomic-fns/blob/main/docs/design.md) describes the API and its rules.

Supports Node `^24.22.3 || >=26.13.1`, Deno, Bun, browsers at Baseline and workers. Published types support TypeScript 6.0 and later.

The 1.x line lives on the [`1.x` branch](https://github.com/adrian2x/atomic-fns/tree/1.x).

## Development

```sh
npm install
npm run check
```

`check` runs Biome, the type check, the tests, the build, and a JSR dry run.

## License

[Apache License 2.0](https://github.com/adrian2x/atomic-fns/blob/main/LICENSE)
