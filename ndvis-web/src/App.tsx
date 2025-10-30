import { useEffect } from "react";
import { AppShell } from "@/ui/AppShell";
import { initializeWasmBindings } from "@/state/appState";

const App = () => {
  useEffect(() => {
    // Initialize WASM bindings on app startup
    void initializeWasmBindings();
  }, []);

  return <AppShell />;
};

export default App;
