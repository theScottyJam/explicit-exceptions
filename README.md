# Introduction

Explicit-exceptions is a lightweight package that provides predictability and stability to the exception system of your program. It provides the same power that one might find in a functional language's exception system (like Rust or Haskell), but in a format that integrates well within the Javascript language. The concept is simple: require a caller to explicitly name each exception they expect a particular function to provide. Here's what this looks like in practice:

```javascript
const { Exception, wrap, unwrap } = require('explicit-exceptions')

const data = new Map()

const getEntry = wrap(id => {
  if (!data.has(id)) {
    // Throws our custom Exception instance, with the intention that
    // our caller would be able to catch and handle this.
    throw new Exception('NotFound')
  }
  return data.get(id)
})

const getEntryOrDefault = (id, defaultValue=null) => {
  try {
    // This line showcases the most important feature of this package.
    // unwrap() self-documents the fact that getEntity() can provide the "NotFound" exception.
    // Runtime checks will ensure no other exceptions leak through that aren't explicitly named here.
    return unwrap(getEntry(id), ['NotFound'])
  } catch (ex) {
    if (!(ex instanceof Exception)) throw ex // Not an exception, don't handle it
    console.assert(ex.code === 'NotFound')
    return defaultValue
  }
}
```

Note how it's easy to tell by looking at each function definition what kinds of exceptions you can expect it to throw? When you use getEntry(), you can expect the possibility of it throwing a NotFound exception. getEntryOrDefault explicitly propagated NotFound, but caught and handled it before it reached the caller, resulting in getEntryOrDefault() not throwing any explicit exceptions.

# Next steps

Get a better feel for how this package operates by [understanding the big picture](https://thescottyjam.gitbook.io/explicit-exceptions/), then head on over to the [API reference](https://thescottyjam.gitbook.io/explicit-exceptions/api-reference) to learn the finer details of each function.

When you're ready to start using it, install it with `npm i explicit-exceptions`, or check out the [light version](https://gist.github.com/theScottyJam/fee1a93db153d87fbbf3d45fc0241c49), which provides a simplified variation of this project, intended for those who would prefer maintaining around 100 lines of code themself instead of adding a new dependency to their project.

<br/>
<br/>
<br/>

## License

This project is under the [MIT](https://opensource.org/licenses/MIT) license.

## Bug Reports/Feature Requests

This project's github repository can be found [here](https://github.com/theScottyJam/explicit-exceptions). Bug reports and feature requests are welcome and can be submitted on github.
