'use strict'

const internals = Symbol('explicit-exceptions-internals')

/**
 * An exception that's intended to be thrown (or rethrown)
 * within a function decorated with wrap(). Do not throw it anywhere else.
 */
class Exception extends Error {
  /**
   * @param {string} code - An exception code to distinguish it from other exceptions. (e.g. NotFound)
   * @param {string} [message] - Optional exception reason, to help with debugging. It's especially useful when the exception is escalated into a fatal error.
   * @param {any} data - arbitrary data that you wish to attach to the exception object.
   */
  constructor(code, message = null, data = null) {
    super(message ? `${code}: ${message}` : code)
    if (code === 'ok') throw new Error(`The exception code "${code}" is reserved.`)

    this.name = 'Exception'
    this.code = code
    this.data = data
    Object.freeze(this)
  }
}

class Ok {
  constructor(data) {
    this.data = data
  }
}

class Maybe {
  constructor(okOrEx, stack) {
    Maybe._finalizationRegistry.register(this, this._finalizationErrorMsg(stack), this)

    this[internals] = {
      // Has the side-effect that this instance will be removed from the FinalizationRegistry
      extractValue: () => {
        Maybe._finalizationRegistry.unregister(this)
        return okOrEx
      },
    }

    Object.freeze(this)
  }

  _finalizationErrorMsg(stack) {
    return (
      'A maybe type was created, never handled, and garbage collected. ' +
      'Please follow this stack trace and make sure your wrapped() function get unwrapped. ' +
      "(Don't expect this error to show up consistently, as it relies " +
      'on inconsistent garbage collecting behavior).\n' +
      stack +
      '\n'
    )
  }
}

Maybe._finalizationRegistry = new globalThis.FinalizationRegistry(error => {
  console.warn(error)
})

/**
 * Unwraps a maybe type. If the maybe type contained an exception,
 * it will be rethrown. If it contained a value, it will be returned.
 * @param {Maybe} maybeValue
 * @param {string[]} [allowedExceptionTypes=[]] An exception will only be rethrown if it's exception-code is found in this list. Otherwise, it'll be escalated to a fatal error.
 */
function unwrap(maybeValue, allowedExceptionTypes = []) {
  if (!(maybeValue instanceof Maybe)) {
    throw new Error('unwrap() expected the first parameter to be of a maybe type.')
  }

  const errOrOk = maybeValue[internals].extractValue()
  if (errOrOk instanceof Ok) {
    return errOrOk.data
  } else if (errOrOk instanceof Exception) {
    if (exceptionInTypeList(errOrOk, allowedExceptionTypes)) throw errOrOk
    throw escalatedException(errOrOk)
  } else {
    throw new Error('UNREACHABLE')
  }
}

/**
 * Decorates the provided wrappedFn, such that the wrapper will always return a maybe type,
 * whether or not the wrapped function threw an exception or returned a value.
 * It is intended that the users of this wrapped functions use unwrap() to retrieve the
 * original returned value (in fact, it's considered a bug if the maybe value is never unwrapped,
 * and it will attempt to warn you if that happens)
 * @param {function} fnToWrap
 * @param {string[]} [allowedExceptionTypes] Optional list of exceptions this function may propagate. Defaults to allowing all.
 * @returns {Maybe} A maybe type, intended to be unwrapped with unwrap()
 */
function wrap(fnToWrap, allowedExceptionTypes = null) {
  if (isAsyncFn(fnToWrap)) {
    throw new Error('Attempted to call wrap() on an async function. Use wrapAsync() instead.')
  }

  return function wrapped(...args) {
    const stack = new Error().stack // Create this stack value as close to userland code as possible
    try {
      return new Maybe(new Ok(fnToWrap(...args)), stack)
    } catch (ex) {
      return handleWrappedFnEx(ex, { allowedExceptionTypes, stack })
    }
  }
}

/**
 * Same as wrap(), except that it will correctly wrap an async function.
 * @returns {Promise} A promise resolving in a maybe type
 */
function wrapAsync(fnToWrap, allowedExceptionTypes = null) {
  return async function wrapped(...args) {
    const stack = new Error().stack // Create this stack value as close to userland code as possible
    try {
      return new Maybe(new Ok(await fnToWrap(...args)), stack)
    } catch (ex) {
      return handleWrappedFnEx(ex, { allowedExceptionTypes, stack })
    }
  }
}

function handleWrappedFnEx(ex, { allowedExceptionTypes, stack }) {
  if (!(ex instanceof Exception)) throw ex
  if (allowedExceptionTypes == null || exceptionInTypeList(ex, allowedExceptionTypes)) {
    return new Maybe(ex, stack)
  }
  throw escalatedException(ex)
}

// Does not return true for transpiles async functions or functions that just return promimes
const isAsyncFn = fn => fn instanceof (async () => {}).constructor

const exceptionInTypeList = (ex, types) => types.find(type => ex.code === type)

const escalatedException = ex => new Error(ex.message)

module.exports = { Exception, unwrap, wrap, wrapAsync }
