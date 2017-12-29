# fluxury

[![Circle CI](https://circleci.com/gh/formula/fluxury/tree/master.svg?style=svg)](https://circleci.com/gh/formula/fluxury/tree/master)

## Overview

State management library, works like redux but with side effects (e.g. waitFor).

This library includes:

  - createStore(name, reducerOrSpec, actionsOrSelectors)
  - dispatch(action)
  - getStores()
  - getReducer()
  - getState()
  - promiseAction(type, data)
  - replaceState(state)
  - subscribe(cb)

## Quick start

```sh
npm install --save fluxury
```

```js
import rootStore, {
  createStore,
  dispatch,
  getStores,
  getState,
  promiseAction,
  replaceState,
  subscribe
}
from 'fluxury'

// creates a key="A" in the root store, connected to a reducer function.
let storeA = createStore('a', (state=0, action) => 
                      action.type === 'setA' ? 
                      action.data : state )

let storeB = createStore('b', (state=0, action) => 
                      action.type === 'setA' ? 
                      action.data : state )

// Store with dependencies on state in storeA and storeB.
let storeC = createStore('c', (state=1, action, waitFor) => {
  // Ensure storeA and storeB reducers run prior to continuing.
  waitFor([storeA.dispatchToken, storeB.dispatchToken]);
  
  // Exit unless 'set' is part of the action's type.
  if (action.type.indexOf('set') === -1) return state;
  
  // Side effect! Get state from other stores.
  return storeA.getState() + storeB.getState();
}

rootStore.dispatch('setA', 2)
rootStore.dispatch('setB', 2)
rootStore.getState()  // -> { a: 2, b: 2, c: 4 }
```

## Polyfills

This library depends on a modern JavaScript runtime. Load a polyfill like in [core-js](https://github.com/zloirock/core-js#commonjs) or [babel-polyfill](http://babeljs.io/docs/usage/polyfill/) to support old browsers.

Install required polyfills with [core-js](https://github.com/zloirock/core-js):

```js
require('core-js/fn/promise');
require('core-js/fn/object/assign');
require('core-js/fn/object/freeze');
require('core-js/fn/object/keys');
```

## API

### dispatch( action )

Dispatch action, return promise.

```js
var { dispatch } = require( 'fluxury' )

// With an object
dispatch( { type: 'openPath', '/user/new' } )
.then( action => console.log('Going', action.data) )

// With a Promise
dispatch( Promise.resolve({ type: 'get', mode: 'off the juice' }) )

// With type and data
dispatch( 'loadSettings', { a: 1, b: 2 } )

```

### createStore( name, reducerOrSpec, actionsOrSelectors )

A store responds to actions by returning the next state.

```js
const inc = 'inc'
import {createStore} from 'fluxury';

// a simple counting store
var store = createStore( "CountStoreWithReducer", (state=0, action) => {
  switch (action.type)
  case inc:
    return state + 1;
  case incN:
    return state + action.data;
  default:
    return state;
}, {
  inc: (state) => dispatch('inc'),
  incN: (state, count) => dispatch('incN', count),
})

// the store includes a reference to dispatch
store.dispatch('inc')

// optionally, define action creators into the store.
store.inc()
```

Optionally, you may define a store with a specification.

```js
const inc = 'inc'
import { createStore } from 'fluxury';

// a simple counting store
var countStore = createStore( "CountStoreWithSpec", {
  getInitialState: () => 0,
  inc: (state) => state+1,
  incN: (state, n) => state+n,
})

// object spec makes action creators automatically...
countStore.inc()
countStore.incN(10)
```

The specification includes the life-cycle method `getInitialState` which is invoked once when the store is created.

Additional functions are invoked when the `action.type` matches the key in the spec.

_Do not try to mutate the state object. It is frozen._

#### Store Properties

| name | comment |
|---------|------|
| name | The name of the store |
| dispatch | Access to dispatch function |
| dispatchToken | A number used to identity the store |
| subscribe | A function to tegister a listener |
| getState | A function to access state |
| setState | Replace the store's state |
| replaceReducer | Replace the store's reducer |

### getStores( )

Returns an object with the name as key and store as value.

### replaceState( state )

Rehydrate the root state.

```js
replaceState({
  'MyCountStore': 1
})
```

### subscribe( listener )

Listen to changes to all stores. This will trigger once each time createStore or dispatch is invoked.

_Please note that action will be undefined when createStore is invoked._

```
var unsubscribe = subscribe( (state, action) => {
  // got change
})

// stop listening
unsubscribe()
```
### getReducer( )

Return the reducer function, use with Redux.

## Final thought

If you got this far then I hope you enjoy this library and build something amazing.

If you do please let me know!
