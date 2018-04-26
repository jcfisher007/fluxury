/* xander - Copyright 2015-2018 FormBucket.com */
"use strict";

// Based on Facebook's Flux dispatcher class.

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.subscribe = subscribe;
exports.promiseAction = promiseAction;
exports.replaceState = replaceState;
exports.getState = getState;
exports.getStores = getStores;
exports.createStore = createStore;
function Dispatcher() {
  var lastId = 1;
  var prefix = "ID_";
  var callbacks = {};
  var isPending = {};
  var isHandled = {};
  var isDispatching = false;
  var pendingPayload = null;

  function invokeCallback(id) {
    isPending[id] = true;
    callbacks[id](pendingPayload);
    isHandled[id] = true;
  }

  this.register = function (callback) {
    var id = prefix + lastId++;
    callbacks[id] = callback;
    return id;
  };

  this.unregister = function (id) {
    if (!callbacks.hasOwnProperty(id)) return new Error("Cannot unregister unknown ID!");
    delete callbacks[id];
    return id;
  };

  this.waitFor = function (ids) {
    for (var i = 0; i < ids.length; i++) {
      var id = ids[id];
      if (isPending[id]) {
        return new Error("Circular dependency waiting for " + id);
      }

      if (!callbacks[id]) {
        return new Error("waitFor: " + id + " is not a registered callback.");
      }

      invokeCallback(id);
    }

    return undefined;
  };

  this.dispatch = function (payload) {
    if (isDispatching) return new Error("Cannot dispatch while dispatching.");

    // start
    for (var id in callbacks) {
      isPending[id] = false;
      isHandled[id] = false;
    }

    pendingPayload = payload;
    isDispatching = true;

    // run each callback.
    try {
      for (var id in callbacks) {
        if (isPending[id]) continue;
        invokeCallback(id);
      }
    } finally {
      pendingPayload = null;
      isDispatching = false;
    }

    return payload;
  };
}

var rootState = Object.freeze({}),
    stores = {},
    dispatcher = new Dispatcher(),
    waitFor = dispatcher.waitFor.bind(dispatcher),
    rootListeners = [],
    rootNextListeners = [];

function copyIfSame(current, next) {
  if (current === next) return current.slice();
  return next;
}

function updateRootState(name, newState) {
  var changes = {};
  changes[name] = (typeof newState === "undefined" ? "undefined" : _typeof(newState)) === "object" ? Object.freeze(newState) : newState;
  rootState = Object.assign({}, rootState, changes);
}

function rootNotify(action) {
  // notify root listeners
  var listeners = rootListeners = rootNextListeners;
  for (var i = 0; i < listeners.length; i++) {
    var listener = listeners[i];
    listener(rootState, action);
  }
}

function subscribe(cb) {
  if (typeof cb !== "function") {
    throw "Listener must be a function";
  }

  // avoid mutating list that could be iterating during dispatch
  var subscribed = true;
  rootNextListeners = copyIfSame(rootListeners, rootNextListeners);

  rootNextListeners.push(cb);

  return function () {
    if (!subscribed) return;
    subscribed = false;

    rootNextListeners = copyIfSame(rootListeners, rootNextListeners);

    var index = rootNextListeners.indexOf(cb);
    rootNextListeners.splice(index, 1);
  };
}

function promiseAction(type, data) {
  return Promise.resolve({ type: type, data: data });
}

function replaceState(newState) {
  rootState = newState;
}

function _dispatch(action, data) {
  try {
    if ((typeof action === "undefined" ? "undefined" : _typeof(action)) === "object" && typeof action.then === "function") {
      return action.then(function (result) {
        _dispatch(result);
        return Promise.resolve(result);
      });
    } else if ((typeof action === "undefined" ? "undefined" : _typeof(action)) === "object") {} else if (typeof action === "string") {
      action = { type: action, data: data };
    } else {
      return Promise.reject("Invalid action!");
    }

    // keep a reference to current rootState
    var currentState = rootState;

    // dispatch the action to the core dispatcher.
    dispatcher.dispatch(action);

    // notify if root state changes!
    if (currentState !== rootState) {
      rootNotify(action);
    }

    // Return a promise that resolves to the action.
    return Promise.resolve(action);
  } catch (e) {
    return Promise.reject(e);
  }
}

// construct a reducer method with a spec
exports.dispatch = _dispatch;
function makeReducer(spec) {
  return function (state, action) {
    // Check if action has definition and run it if available.
    if (action && typeof action.type === "string" && spec.hasOwnProperty(action.type)) {
      return spec[action.type](state, action.data, waitFor);
    }

    // Return current state when action has no handler.
    return state;
  };
}

function bindSelectors(name, selectors) {
  return Object.keys(selectors).reduce(function (a, b, i) {
    var newFunc = {};
    newFunc[b] = function () {
      for (var _len = arguments.length, params = Array(_len), _key = 0; _key < _len; _key++) {
        params[_key] = arguments[_key];
      }

      return selectors[b].apply(selectors, [rootState[name]].concat(params));
    };
    return Object.assign(a, newFunc);
  }, {});
}

function getState() {
  return rootState;
}

function getStores() {
  return stores;
}

function createStore(name, reducerOrSpec) {
  var selectors = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  if (typeof name !== "string") throw "Expect name to be string.";
  if (typeof reducerOrSpec !== "function" && (typeof reducerOrSpec === "undefined" ? "undefined" : _typeof(reducerOrSpec)) !== "object") throw "Expect reducer to be function or object spec.";
  if ((typeof selectors === "undefined" ? "undefined" : _typeof(selectors)) !== "object") throw "Expect selectors to be object.";

  var isSpec = (typeof reducerOrSpec === "undefined" ? "undefined" : _typeof(reducerOrSpec)) === "object",
      reducer = isSpec ? makeReducer(reducerOrSpec) : reducerOrSpec,
      actions = {},
      currentListeners = [],
      nextListeners = [];

  updateRootState(name, isSpec ? reducerOrSpec.getInitialState ? reducerOrSpec.getInitialState() : undefined : reducer(undefined, {}, function () {}));

  rootNotify(undefined);

  var dispatchToken = dispatcher.register(function (action) {
    var newState = reducer(rootState[name], action, waitFor);
    if (rootState[name] !== newState) {
      updateRootState(name, newState);

      // avoid looping over potentially mutating list
      var listeners = currentListeners = nextListeners;
      for (var i = 0; i < listeners.length; i++) {
        var listener = listeners[i];
        listener(newState, action);
      }
    }
  });

  function subscribe(cb) {
    if (typeof cb !== "function") {
      throw "Listener must be a function";
    }

    // avoid mutating list that could be iterating during dispatch
    var subscribed = true;
    nextListeners = copyIfSame(currentListeners, nextListeners);

    nextListeners.push(cb);

    return function () {
      if (!subscribed) return;
      subscribed = false;

      nextListeners = copyIfSame(currentListeners, nextListeners);

      var index = nextListeners.indexOf(cb);
      nextListeners.splice(index, 1);
    };
  }

  if (isSpec) {
    // create helpful action methods
    actions = Object.keys(reducerOrSpec).reduce(function (a, b) {
      if (b === "getInitialState") return a;
      a[b] = function (data) {
        return _dispatch({
          type: b,
          data: data
        });
      };
      return a;
    }, {});
  }

  var store = Object.assign({}, actions, bindSelectors(name, selectors), {
    name: name,
    dispatch: function dispatch() {
      return _dispatch.apply(undefined, arguments);
    },
    dispatchToken: dispatchToken,
    subscribe: subscribe,
    replaceReducer: function replaceReducer(newReducer) {
      return reducer = newReducer;
    },
    setState: function setState(state) {
      updateRootState(name, state);
    },
    getReducer: function getReducer() {
      return reducer;
    },
    getState: function getState() {
      return rootState[name];
    }
  });

  if (name[0] !== "_") stores[name] = store;

  return store;
}

var rootStore = {
  dispatch: _dispatch,
  replaceState: replaceState,
  subscribe: subscribe,
  getState: getState
};

exports.default = rootStore;