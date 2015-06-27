# The Problem

Callbacks in JavaScript execute in a new stack, so errors in callbacks only contain the immediate stack, not the original outer stack.

For example:

```javascript
asyncLoadData('{"name": "company 1"}', onCompanyData);
asyncLoadData('{"name": "company 2"}', onCompanyData);
asyncLoadData('{"name": "company 3}', onCompanyData);

function asyncLoadData(json, callback) {
  setTimeout(function() {
    try {
      callback(null, JSON.parse(json));
    }
    catch(err) {
      callback(err);
    }
  }, 1);
}

function onCompanyData(err, company) {
  // err.stack does not include the call to asyncParse()
  // so there's no way to know which one failed
  if (err)
    console.log(err.stack);

  // ...
}
```

In this scenario, it is impossible to tell from the stack which call to asyncParse() triggered the error. With this trivial example, you can look at the three calls and easily spot the one with invalid JSON, but in a production application this it is much more difficult to pinpoint the cause of an error without the complete stack.

This sort of thing happens frequently, only instead of `setTimeout()` it's typically a filesystem or DB call in Node.js and an HTML5 persistence call or an AJAX call in the browser.

# Previous Solutions

https://github.com/mattinsler/longjohn addresses this problem in a transparent way by hooking into lower-level node.js code, collecting a lot of data and automatically appending it to the stack property of errors. However, this approach is not performant enough to be used in production, which is the environment where detailed error stacks are the most valuable:

> it is not recommended to use longjohn in production. The data collection puts a lot of strain on V8's garbage collector and can greatly slow down heavily-loaded applications.

https://github.com/CrabDude/trycatch addresses this problem in a similar (though perhaps more performant?) manner, shimming all native I/O calls. Because of this, it must be required and configured before any other modules.

Neither of these solutions work in the browser and both of them monkeypatch node.js builtins, which is dangerous because it could break with newer versions of node.js or it could be incompatible with other code that monkeypatches builtins.

# A More Explicit Approach

async-stacktrace takes a more explicit, less invasive approach. Instead of shimming all I/O calls to automatically append stack traces to errors, you explicitly call it in your error handling. This can also be more performant, since in many cases `trace()` isn't called unless there is an error. Here is how the above code would look with async-stacktrace:

```javascript
var trace = require('async-stacktrace'); // in the browser: var trace = asyncStacktrace;

asyncLoadData('{"name": "company 1"}', trace(onCompanyData));
asyncLoadData('{"name": "company 2"}', trace(onCompanyData));
asyncLoadData('{"name": "company 3}', trace(onCompanyData));

function asyncLoadData(json, callback) {
  setTimeout(function() {
    try {
      callback(null, JSON.parse(json));
    }
    catch(err) {
      callback(err);
    }
  }, 1);
}

function onCompanyData(err, company) {
  // err.stack *will* include the call to asyncParse()
  // b/c trace() appended it
  if (err)
    console.log(err.stack);

  // ...
}
```

The downside is that you have to wrap callback functions and errors passed to callback functions with `trace()`. However, in many cases, this is a small price to pay for performant, non-invasive long stack traces.

# How It Works

## `trace(err)`

If it is passed an error object, the `trace()` function decorates that error with the current stacktrace. As you pass the error back up the chain, from callback to callback, these stacks get appended to the error object. If this is called only when an error occurs (i.e. `if (err) return callback(trace(err));`), this can have a minimal effect on performance, as it is never called unless there is an error.

## `trace(callback)`

If it is passed a callback function, the `trace()` function caches the current stacktrace and wraps the callback in a function that checks for an error and decorates it with the cached stacktrace before passing it along.

If you run into performance problems with this API because it is called in a hot codepath, you can convert it to the other form by wrapping the callback in a function, for example:

```javascript
asyncLoadData('{"name": "company 1"}', function(err, data) {
  if (err) return onCompanyData(trace(err));
  onCompanyData(null, data);
});
```
