'use strict'

const { wrap, wrapAsync, unwrap, Exception } = require('./index')

function runGc() {
  if (!globalThis.gc) {
    throw new Error('The node flag --expose-gc needs to be set for these tests to run.')
  }
  globalThis.gc()
}

describe('unwrap()', () => {
  test('throws expected exceptions (the exception type is found in the types list)', () => {
    const notFoundEx = wrap(() => { throw new Exception('NotFound', null, 'data') })()

    let err
    try {
      unwrap(notFoundEx, ['NotFound'])
    } catch (err_) {
      err = err_
    }

    expect(err).toBeInstanceOf(Exception)
    expect(err.code).toBe('NotFound')
    expect(err.data).toBe('data')
  })

  test('escalates unexpected exceptions (the exception type is not found in the types list)', () => {
    const notFoundEx = wrap(() => { throw new Exception('NotFound', 'My Error', 'data') })()

    let err
    try {
      unwrap(notFoundEx, ['SomeOtherException'])
    } catch (err_) {
      err = err_
    }

    expect(err).not.toBeInstanceOf(Exception)
    expect(err.message).toStrictEqual(expect.stringContaining('NotFound'))
    expect(err.message).toStrictEqual(expect.stringContaining('My Error'))
  })

  test('returns the content of an OK instance', () => {
    const okValue = wrap(() => 42)()
    expect(unwrap(okValue)).toBe(42)
  })
})

describe('wrap()', () => {
  test('catches thrown exceptions using default expected exception list', () => {
    const wrappedFn = wrap(() => { throw new Exception('NotFound') })
    let maybeValue
    expect(() => maybeValue = wrappedFn()).not.toThrow()

    // clean up (to make FinalizationRegistry happy)
    expect(() => unwrap(maybeValue)).toThrow('NotFound')
  })

  test('catches thrown exceptions using explicit expected exception list', () => {
    const wrappedFn = wrap(() => { throw new Exception('NotFound') }, ['NotFound'])
    let maybeValue
    expect(() => maybeValue = wrappedFn()).not.toThrow()

    // clean up (to make FinalizationRegistry happy)
    expect(() => unwrap(maybeValue)).toThrow('NotFound')
  })

  test('escalates exceptions not found in expected exception list', () => {
    const wrappedFn = wrap(() => { throw new Exception('NotFound') }, ['SomeOtherException'])
    expect(wrappedFn).toThrow('NotFound')
  })

  test('does not touch normal errors (non-exceptions)', () => {
    const wrappedFn = wrap(() => { throw new Error('Oh no!') })
    expect(wrappedFn).toThrow('Oh no!')
  })

  // NOTE: This test is fragile - if it takes the garbage collected too long to run, then it will fail
  test('warns if a wrapped value is never unwrapped', async () => {
    jest.spyOn(console, 'warn')
    console.warn.mockImplementation(() => {})
    try {
      wrap(() => 42)() // Return value is not handled

      // Force run the garbage collecter, triggering FinalizationRegistry callbacks
      runGc()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(console.warn).toHaveBeenCalledTimes(1)
    } finally {
      console.warn.mockRestore()
    }
  })

  // NOTE: This test is fragile - if it takes the garbage collected too long to run, then it could return a false positive
  test('does not warn if all wrapped values get unwrapped', async () => {
    jest.spyOn(console, 'warn')
    console.warn.mockImplementation(() => {})
    try {
      unwrap(wrap(() => 42)())

      // Force run the garbage collecter, triggering FinalizationRegistry callbacks
      runGc()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(console.warn).not.toHaveBeenCalled()
    } finally {
      console.warn.mockRestore()
    }
  })

  test('does not allow async functions to be wrapped', () => {
    expect(() => {
      wrap(async () => { throw new Error('Oh no!') })
    }).toThrow('Use wrapAsync() instead')
  })
})

describe('wrapAsync()', () => {
  test('catches thrown exceptions using default expected exception list', async () => {
    const wrappedFn = wrapAsync(async () => { throw new Exception('NotFound') })
    const promisedMaybeValue = wrappedFn()
    await expect(promisedMaybeValue).resolves.toBeTruthy()

    // clean up (to make FinalizationRegistry happy)
    await expect(async () => unwrap(await promisedMaybeValue)).rejects.toThrow('NotFound')
  })

  test('catches thrown exceptions using explicit expected exception list', async () => {
    const wrappedFn = wrapAsync(async () => { throw new Exception('NotFound') }, ['NotFound'])
    const promisedMaybeValue = wrappedFn()
    await expect(promisedMaybeValue).resolves.toBeTruthy()

    // clean up (to make FinalizationRegistry happy)
    await expect(async () => unwrap(await promisedMaybeValue)).rejects.toThrow('NotFound')
  })

  test('escalates exceptions not found in expected exception list', async () => {
    const wrappedFn = wrapAsync(async () => { throw new Exception('NotFound') }, ['SomeOtherException'])
    await expect(wrappedFn()).rejects.toThrow('NotFound')
  })

  test('does not touch normal errors (non-exceptions)', async () => {
    const wrappedFn = wrapAsync(async () => { throw new Error('Oh no!') })
    await expect(wrappedFn()).rejects.toThrow('Oh no!')
  })

  // NOTE: This test is fragile - if it takes the garbage collected too long to run, then it will fail
  test('warns if a wrapped value is never unwrapped', async () => {
    jest.spyOn(console, 'warn')
    console.warn.mockImplementation(() => {})
    try {
      await wrapAsync(async () => 42)() // Return value is not handled
      await new Promise(resolve => setImmediate(resolve)) // Seems to be needed to let the resource get cleaned up by the garbage collector

      // Force run the garbage collecter, triggering FinalizationRegistry callbacks
      runGc()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(console.warn).toHaveBeenCalledTimes(1)
    } finally {
      console.warn.mockRestore()
    }
  })

  // NOTE: This test is fragile - if it takes the garbage collected too long to run, then it could return a false positive
  test('does not warn if all wrapped values get unwrapped', async () => {
    jest.spyOn(console, 'warn')
    console.warn.mockImplementation(() => {})
    try {
      unwrap(await wrapAsync(async () => 42)())
      await new Promise(resolve => setImmediate(resolve))

      // Force run the garbage collecter, triggering FinalizationRegistry callbacks
      runGc()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(console.warn).not.toHaveBeenCalled()
    } finally {
      console.warn.mockRestore()
    }
  })
})
