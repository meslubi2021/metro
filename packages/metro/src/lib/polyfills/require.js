/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @polyfill
 * @flow
 * @format
 */

'use strict';

/* eslint-disable no-bitwise */

declare var __DEV__: boolean;

type DependencyMap = Array<ModuleID>;
type Exports = any;
type FactoryFn = (
  global: Object,
  require: RequireFn,
  metroImportDefault: RequireFn,
  metroImportAll: RequireFn,
  moduleObject: {exports: {}},
  exports: {},
  dependencyMap: ?DependencyMap,
) => void;
type HotModuleReloadingCallback = () => void;
type HotModuleReloadingData = {|
  _acceptCallback: ?HotModuleReloadingCallback,
  _disposeCallback: ?HotModuleReloadingCallback,
  _didAccept: boolean,
  accept: (callback?: HotModuleReloadingCallback) => void,
  dispose: (callback?: HotModuleReloadingCallback) => void,
|};
type ModuleID = number;
type Module = {
  id?: ModuleID,
  exports: Exports,
  hot?: HotModuleReloadingData,
};
type ModuleDefinition = {|
  dependencyMap: ?DependencyMap,
  error?: any,
  factory: FactoryFn,
  hasError: boolean,
  hot?: HotModuleReloadingData,
  importedAll: any,
  importedDefault: any,
  isInitialized: boolean,
  path?: string,
  publicModule: Module,
  verboseName?: string,
|};
type ModuleList = {[number]: ?ModuleDefinition, __proto__: null};
type RequireFn = (id: ModuleID | VerboseModuleNameForDev) => Exports;
type VerboseModuleNameForDev = string;

global.__r = metroRequire;
global.__d = define;
global.__c = clear;
global.__registerSegment = registerSegment;

var modules = clear();

// Don't use a Symbol here, it would pull in an extra polyfill with all sorts of
// additional stuff (e.g. Array.from).
const EMPTY = {};
const {hasOwnProperty} = {};

if (__DEV__) {
  var RefreshRegNoop = () => {};
  var RefreshSigNoop = () => type => type;
}

function clear(): ModuleList {
  modules = (Object.create(null): ModuleList);

  // We return modules here so that we can assign an initial value to modules
  // when defining it. Otherwise, we would have to do "let modules = null",
  // which will force us to add "nullthrows" everywhere.
  return modules;
}

if (__DEV__) {
  var verboseNamesToModuleIds: {
    [key: string]: number,
    __proto__: null,
  } = Object.create(null);
  var initializingModuleIds: Array<number> = [];
}

function define(
  factory: FactoryFn,
  moduleId: number,
  dependencyMap?: DependencyMap,
): void {
  if (modules[moduleId] != null) {
    if (__DEV__) {
      // (We take `inverseDependencies` from `arguments` to avoid an unused
      // named parameter in `define` in production.
      const inverseDependencies = arguments[4];

      // If the module has already been defined and the define method has been
      // called with inverseDependencies, we can hot reload it.
      if (inverseDependencies) {
        global.__accept(moduleId, factory, dependencyMap, inverseDependencies);
      }
    }

    // prevent repeated calls to `global.nativeRequire` to overwrite modules
    // that are already loaded
    return;
  }

  const mod: ModuleDefinition = {
    dependencyMap,
    factory,
    hasError: false,
    importedAll: EMPTY,
    importedDefault: EMPTY,
    isInitialized: false,
    publicModule: {exports: {}},
  };

  modules[moduleId] = mod;

  if (__DEV__) {
    // HMR
    mod.hot = createHotReloadingObject();

    // DEBUGGABLE MODULES NAMES
    // we take `verboseName` from `arguments` to avoid an unused named parameter
    // in `define` in production.
    const verboseName: string | void = arguments[3];
    if (verboseName) {
      mod.verboseName = verboseName;
      verboseNamesToModuleIds[verboseName] = moduleId;
    }
  }
}

function metroRequire(moduleId: ModuleID | VerboseModuleNameForDev): Exports {
  if (__DEV__ && typeof moduleId === 'string') {
    const verboseName = moduleId;
    moduleId = verboseNamesToModuleIds[verboseName];
    if (moduleId == null) {
      throw new Error(`Unknown named module: "${verboseName}"`);
    } else {
      console.warn(
        `Requiring module "${verboseName}" by name is only supported for ` +
          'debugging purposes and will BREAK IN PRODUCTION!',
      );
    }
  }

  //$FlowFixMe: at this point we know that moduleId is a number
  const moduleIdReallyIsNumber: number = moduleId;

  if (__DEV__) {
    const initializingIndex = initializingModuleIds.indexOf(
      moduleIdReallyIsNumber,
    );
    if (initializingIndex !== -1) {
      const cycle = initializingModuleIds
        .slice(initializingIndex)
        .map((id: number) =>
          modules[id] ? modules[id].verboseName : '[unknown]',
        );
      // We want to show A -> B -> A:
      cycle.push(cycle[0]);
      console.warn(
        `Require cycle: ${cycle.join(' -> ')}\n\n` +
          'Require cycles are allowed, but can result in uninitialized values. ' +
          'Consider refactoring to remove the need for a cycle.',
      );
    }
  }

  const module = modules[moduleIdReallyIsNumber];

  return module && module.isInitialized
    ? module.publicModule.exports
    : guardedLoadModule(moduleIdReallyIsNumber, module);
}

function metroImportDefault(moduleId: ModuleID | VerboseModuleNameForDev) {
  if (__DEV__ && typeof moduleId === 'string') {
    const verboseName = moduleId;
    moduleId = verboseNamesToModuleIds[verboseName];
  }

  //$FlowFixMe: at this point we know that moduleId is a number
  const moduleIdReallyIsNumber: number = moduleId;

  if (
    modules[moduleIdReallyIsNumber] &&
    modules[moduleIdReallyIsNumber].importedDefault !== EMPTY
  ) {
    return modules[moduleIdReallyIsNumber].importedDefault;
  }

  const exports = metroRequire(moduleIdReallyIsNumber);
  const importedDefault =
    exports && exports.__esModule ? exports.default : exports;

  // $FlowFixMe The metroRequire call above will throw if modules[id] is null
  return (modules[moduleIdReallyIsNumber].importedDefault = importedDefault);
}
metroRequire.importDefault = metroImportDefault;

function metroImportAll(moduleId: ModuleID | VerboseModuleNameForDev | number) {
  if (__DEV__ && typeof moduleId === 'string') {
    const verboseName = moduleId;
    moduleId = verboseNamesToModuleIds[verboseName];
  }

  //$FlowFixMe: at this point we know that moduleId is a number
  const moduleIdReallyIsNumber: number = moduleId;

  if (
    modules[moduleIdReallyIsNumber] &&
    modules[moduleIdReallyIsNumber].importedAll !== EMPTY
  ) {
    return modules[moduleIdReallyIsNumber].importedAll;
  }

  const exports = metroRequire(moduleIdReallyIsNumber);
  let importedAll;

  if (exports && exports.__esModule) {
    importedAll = exports;
  } else {
    importedAll = {};

    // Refrain from using Object.assign, it has to work in ES3 environments.
    if (exports) {
      for (const key in exports) {
        if (hasOwnProperty.call(exports, key)) {
          importedAll[key] = exports[key];
        }
      }
    }

    importedAll.default = exports;
  }

  // $FlowFixMe The metroRequire call above will throw if modules[id] is null
  return (modules[moduleIdReallyIsNumber].importedAll = importedAll);
}
metroRequire.importAll = metroImportAll;

let inGuard = false;
function guardedLoadModule(
  moduleId: ModuleID,
  module: ?ModuleDefinition,
): Exports {
  if (!inGuard && global.ErrorUtils) {
    inGuard = true;
    let returnValue;
    try {
      returnValue = loadModuleImplementation(moduleId, module);
    } catch (e) {
      global.ErrorUtils.reportFatalError(e);
    }
    inGuard = false;
    return returnValue;
  } else {
    return loadModuleImplementation(moduleId, module);
  }
}

const ID_MASK_SHIFT = 16;
const LOCAL_ID_MASK = ~0 >>> ID_MASK_SHIFT;

function unpackModuleId(
  moduleId: ModuleID,
): {localId: number, segmentId: number} {
  const segmentId = moduleId >>> ID_MASK_SHIFT;
  const localId = moduleId & LOCAL_ID_MASK;
  return {segmentId, localId};
}
metroRequire.unpackModuleId = unpackModuleId;

function packModuleId(value: {localId: number, segmentId: number}): ModuleID {
  return (value.segmentId << ID_MASK_SHIFT) + value.localId;
}
metroRequire.packModuleId = packModuleId;

const moduleDefinersBySegmentID = [];

function registerSegment(segmentID, moduleDefiner): void {
  moduleDefinersBySegmentID[segmentID] = moduleDefiner;
}

function loadModuleImplementation(
  moduleId: ModuleID,
  module: ?ModuleDefinition,
): Exports {
  if (!module && moduleDefinersBySegmentID.length > 0) {
    const {segmentId, localId} = unpackModuleId(moduleId);
    const definer = moduleDefinersBySegmentID[segmentId];
    if (definer != null) {
      definer(localId);
      module = modules[moduleId];
    }
  }

  const nativeRequire = global.nativeRequire;
  if (!module && nativeRequire) {
    const {segmentId, localId} = unpackModuleId(moduleId);
    nativeRequire(localId, segmentId);
    module = modules[moduleId];
  }

  if (!module) {
    throw unknownModuleError(moduleId);
  }

  if (module.hasError) {
    throw moduleThrewError(moduleId, module.error);
  }

  // `metroRequire` calls into the require polyfill itself are not analyzed and
  // replaced so that they use numeric module IDs.
  // The systrace module will expose itself on the metroRequire function so that
  // it can be used here.
  // TODO(t9759686) Scan polyfills for dependencies, too
  if (__DEV__) {
    var {Systrace, Refresh} = metroRequire;
  }

  // We must optimistically mark module as initialized before running the
  // factory to keep any require cycles inside the factory from causing an
  // infinite require loop.
  module.isInitialized = true;

  const {factory, dependencyMap} = module;
  if (__DEV__) {
    initializingModuleIds.push(moduleId);
  }
  try {
    if (__DEV__) {
      // $FlowFixMe: we know that __DEV__ is const and `Systrace` exists
      Systrace.beginEvent('JS_require_' + (module.verboseName || moduleId));
    }

    const moduleObject: Module = module.publicModule;

    if (__DEV__) {
      moduleObject.hot = module.hot;

      if (Refresh != null) {
        const RefreshRuntime = Refresh;
        global.$RefreshReg$ = (type, id) => {
          RefreshRuntime.register(type, moduleId + ' ' + id);
        };
        global.$RefreshSig$ =
          RefreshRuntime.createSignatureFunctionForTransform;
      } else {
        global.$RefreshReg$ = RefreshRegNoop;
        global.$RefreshSig$ = RefreshSigNoop;
      }
    }
    moduleObject.id = moduleId;

    // keep args in sync with with defineModuleCode in
    // metro/src/Resolver/index.js
    // and metro/src/ModuleGraph/worker.js
    factory(
      global,
      metroRequire,
      metroImportDefault,
      metroImportAll,
      moduleObject,
      moduleObject.exports,
      dependencyMap,
    );

    // avoid removing factory in DEV mode as it breaks HMR
    if (!__DEV__) {
      // $FlowFixMe: This is only sound because we never access `factory` again
      module.factory = undefined;
      module.dependencyMap = undefined;
    }

    if (__DEV__) {
      // $FlowFixMe: we know that __DEV__ is const and `Systrace` exists
      Systrace.endEvent();

      const hot = module.hot;
      if (hot == null) {
        throw new Error(
          '[Refresh] Expected module.hot to always exist in DEV.',
        );
      }

      global.$RefreshReg$ = RefreshRegNoop;
      global.$RefreshSig$ = RefreshSigNoop;
      if (Refresh != null) {
        const isRefreshBoundary = registerExportsForReactRefresh(
          Refresh,
          moduleObject.exports,
          moduleId,
        );
        if (isRefreshBoundary) {
          hot.accept();
        }
        // Otherwise, the update will propagate to parent modules
        // which will go through the same kind of test. If an update
        // bubbles up to the root, we'll force a hard reload.
      }
    }

    return moduleObject.exports;
  } catch (e) {
    module.hasError = true;
    module.error = e;
    module.isInitialized = false;
    module.publicModule.exports = undefined;
    throw e;
  } finally {
    if (__DEV__) {
      if (initializingModuleIds.pop() !== moduleId) {
        throw new Error(
          'initializingModuleIds is corrupt; something is terribly wrong',
        );
      }
    }
  }
}

function unknownModuleError(id: ModuleID): Error {
  let message = 'Requiring unknown module "' + id + '".';
  if (__DEV__) {
    message +=
      ' If you are sure the module exists, try restarting Metro. ' +
      'You may also want to run `yarn` or `npm install`.';
  }
  return Error(message);
}

function moduleThrewError(id: ModuleID, error: any): Error {
  const displayName = (__DEV__ && modules[id] && modules[id].verboseName) || id;
  return Error(
    'Requiring module "' +
      displayName +
      '", which threw an exception: ' +
      error,
  );
}

if (__DEV__) {
  metroRequire.Systrace = {
    beginEvent: (): void => {},
    endEvent: (): void => {},
  };

  metroRequire.getModules = (): ModuleList => {
    return modules;
  };

  // HOT MODULE RELOADING
  var createHotReloadingObject = function() {
    const hot: HotModuleReloadingData = {
      _acceptCallback: null,
      _disposeCallback: null,
      _didAccept: false,
      accept: (callback?: HotModuleReloadingCallback): void => {
        hot._didAccept = true;
        hot._acceptCallback = callback;
      },
      dispose: (callback?: HotModuleReloadingCallback): void => {
        hot._disposeCallback = callback;
      },
    };
    return hot;
  };

  let reactRefreshTimeout = null;

  const metroHotUpdateModule = function(
    id: ModuleID,
    factory?: FactoryFn,
    dependencyMap?: DependencyMap,
    inverseDependencies: {[key: ModuleID]: Array<ModuleID>},
  ) {
    const mod = modules[id];
    if (!mod) {
      if (factory) {
        // New modules are going to be handled by the define() method.
        return;
      }
      throw unknownModuleError(id);
    }

    const {hot} = mod;
    if (!hot) {
      throw new Error('[Refresh] Expected module.hot to always exist in DEV.');
    }

    // Run just the edited module first. We want to do it now because
    // we want to know whether its latest version has self-accepted or not.
    // However, we'll be more cautious before running the parent modules below.
    const didError = runUpdatedModule(id, factory, dependencyMap);
    if (didError) {
      // The user was shown a redbox about module initialization.
      // There's nothing for us to do here until it's fixed.
      return;
    }

    const pendingModuleIDs = [id];
    const updatedModuleIDs = [];
    const seenModuleIDs = new Set();

    // In this loop, we will traverse the dependency tree upwards from the
    // changed module. Updates "bubble" up to the closest accepted parent.
    //
    // If we reach the module root and nothing along the way accepted the update,
    // we know hot reload is going to fail. In that case we return false.
    //
    // The main purpose of this loop is to figure out whether it's safe to apply
    // a hot update. It is only safe when the update was accepted somewhere
    // along the way upwards for each of its parent dependency module chains.
    //
    // If we didn't have this check, we'd risk re-evaluating modules that
    // have side effects and lead to confusing and meaningless crashes.

    while (pendingModuleIDs.length > 0) {
      const pendingID = pendingModuleIDs.pop();
      // Don't process twice if we have a cycle.
      if (seenModuleIDs.has(pendingID)) {
        continue;
      }
      seenModuleIDs.add(pendingID);

      // If the module accepts itself, no need to bubble.
      // We can stop worrying about this module chain and pick the next one.
      const pendingModule = modules[pendingID];
      if (pendingModule != null) {
        const pendingHot = pendingModule.hot;
        if (pendingHot == null) {
          throw new Error(
            '[Refresh] Expected module.hot to always exist in DEV.',
          );
        }
        if (pendingHot._didAccept) {
          updatedModuleIDs.push(pendingID);
          continue;
        }
      }

      // If we bubble through the roof, there is no way to do a hot update.
      // Bail out altogether. This is the failure case.
      const parentIDs = inverseDependencies[pendingID];
      if (parentIDs.length === 0) {
        // Reload the app because the hot reload can't succeed.
        // This should work both on web and React Native.
        performFullRefresh();
        return;
      }

      // This module didn't accept but maybe all its parents did?
      // Put them all in the queue to run the same set of checks.
      updatedModuleIDs.push(pendingID);
      parentIDs.forEach(parentID => pendingModuleIDs.push(parentID));
    }

    // If we reached here, it is likely that hot reload will be successful.
    // Run the actual factories. Skip the edited module because it already ran.
    for (let i = 0; i < updatedModuleIDs.length; i++) {
      const updatedID = updatedModuleIDs[i];
      if (updatedID !== id) {
        const didError = runUpdatedModule(updatedID);
        if (didError) {
          // The user was shown a redbox about module initialization.
          // There's nothing for us to do here until it's fixed.
          return;
        }
      }
    }

    const {Refresh} = metroRequire;
    if (Refresh != null) {
      // Debounce a little in case there's multiple updates queued up.
      // This is also useful because __accept may be called multiple times.
      if (reactRefreshTimeout == null) {
        reactRefreshTimeout = setTimeout(() => {
          reactRefreshTimeout = null;
          // Update React components.
          Refresh.performReactRefresh();
        }, 30);
      }
    }
  };

  const runUpdatedModule = function(
    id: ModuleID,
    factory?: FactoryFn,
    dependencyMap?: DependencyMap,
  ): boolean {
    const mod = modules[id];
    if (mod == null) {
      throw new Error('[Refresh] Expected to find the module.');
    }

    const {hot} = mod;
    if (!hot) {
      throw new Error('[Refresh] Expected module.hot to always exist in DEV.');
    }

    if (hot._disposeCallback) {
      try {
        hot._disposeCallback();
      } catch (error) {
        console.error(
          `Error while calling dispose handler for module ${id}: `,
          error,
        );
      }
    }

    if (factory) {
      mod.factory = factory;
    }
    if (dependencyMap) {
      mod.dependencyMap = dependencyMap;
    }
    mod.hasError = false;
    mod.error = undefined;
    mod.importedAll = EMPTY;
    mod.importedDefault = EMPTY;
    mod.isInitialized = false;
    const prevExports = mod.publicModule.exports;
    mod.publicModule.exports = {};
    hot._didAccept = false;
    hot._acceptCallback = null;
    hot._disposeCallback = null;
    metroRequire(id);

    if (mod.hasError) {
      // This error has already been reported via a redbox.
      // We know it's likely a typo or some mistake that was just introduced.
      // Our goal now is to keep the rest of the application working so that by
      // the time user fixes the error, the app isn't completely destroyed
      // underneath the redbox. So we'll revert the module object to the last
      // successful export and stop propagating this update.
      mod.hasError = false;
      mod.isInitialized = true;
      mod.error = null;
      mod.publicModule.exports = prevExports;
      // We errored. Stop the update.
      return true;
    }

    if (hot._acceptCallback) {
      try {
        hot._acceptCallback();
      } catch (error) {
        console.error(
          `Error while calling accept handler for module ${id}: `,
          error,
        );
      }
    }
    // No error.
    return false;
  };

  const performFullRefresh = () => {
    /* global window */
    if (
      typeof window !== 'undefined' &&
      window.location != null &&
      typeof window.location.reload === 'function'
    ) {
      window.location.reload();
    } else {
      // This is attached in setUpDeveloperTools.
      const {Refresh} = metroRequire;
      if (Refresh != null) {
        Refresh.performFullRefresh();
      } else {
        console.warn('Could not reload the application after an edit.');
      }
    }
  };

  var registerExportsForReactRefresh = (
    Refresh,
    moduleExports,
    moduleID,
  ): boolean => {
    Refresh.register(moduleExports, moduleID + ' %exports%');
    if (Refresh.isLikelyComponentType(moduleExports)) {
      return true;
    }

    if (moduleExports == null || typeof moduleExports !== 'object') {
      return false;
    }

    let hasExports = false;
    let areAllExportsComponents = true;
    for (const key in moduleExports) {
      const desc = Object.getOwnPropertyDescriptor(moduleExports, key);
      if (desc && desc.get) {
        // Don't invoke getters as they may have side effects.
        continue;
      }
      hasExports = true;

      const exportValue = moduleExports[key];
      const typeID = moduleID + ' %exports% ' + key;
      Refresh.register(exportValue, typeID);
      if (!Refresh.isLikelyComponentType(exportValue)) {
        areAllExportsComponents = false;
      }
    }
    // We only "stop" updates at modules that export components.
    // If you export something else, we might need to propagate it to
    // a component above in the import tree that uses it.
    const isRefreshBoundary = hasExports && areAllExportsComponents;
    return isRefreshBoundary;
  };

  global.__accept = metroHotUpdateModule;
}
