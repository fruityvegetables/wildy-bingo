import { createContext, useContext } from 'react';

const DemoAuthScopeContext = createContext(undefined);

export function DemoAuthScope({ username, userId, children }) {
  return (
    <DemoAuthScopeContext.Provider value={{ username, userId }}>
      {children}
    </DemoAuthScopeContext.Provider>
  );
}

export function useDemoAuthScope() {
  return useContext(DemoAuthScopeContext);
}
