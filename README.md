# atomic-fns

## Like Lodash, but for ESNext and with types.

Stop shipping code built for browsers from 2015. Really though, look at the [issues](https://github.com/lodash/lodash/issues/2930#issuecomment-370295020).

* **Modular**: Pick what you need. Works with all bundlers and also supports tree-shaking.
* **Native**: Uses newer data structures and control flow techniques.
* **Lazy**: Leverages generators, iterators and functional composition.
* **Fluent**: Pure functions and abstract classes. Include only what you need.
* **TypeScript & JSDoc**: Supports both TypeScript and latest JS spec. JSDoc for best in class experience.

This library is available as an npm package. To install the package just run:

```
npm install atomic-fns
```

## How to use
```typescript
import { id, reversed, sorted, times, uniqueId } from 'atomic-fns'

reverse([1, 2, 3, 4])
// => [4, 3, 2, 1]

sorted([4, 3, 2, 1])
// => [1, 2, 3, 4]

times(5, id)
// => [0, 1, 2, 3, 4]

times(5, id)
// => [0, 1, 2, 3, 4]

uniqueId('user_')
// => 'user_101225005'
```

## Docs

🛠 Under construction.

💡 See the `src` directory for comments.

## License

[Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0)
