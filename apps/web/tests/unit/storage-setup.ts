// Node 25+ ships its own global `localStorage`/`sessionStorage` accessors that
// shadow the jsdom ones (and are undefined without --localstorage-file).
// Re-install the jsdom Storage objects so results do not depend on the Node version.
type StorageName = "localStorage" | "sessionStorage";

const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;

for (const name of ["localStorage", "sessionStorage"] as StorageName[]) {
  const storage = jsdomWindow?.[name];
  if (storage) {
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
  }
}
