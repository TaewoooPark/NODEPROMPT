import { Scene } from './components/Scene';
import { ContextMenu } from './components/ContextMenu';
import { PromptInput } from './components/PromptInput';
import { ResponsePanel } from './components/ResponsePanel';
import { Toolbar } from './components/Toolbar';
import { Legend } from './components/Legend';
import { NodeInfoPanel } from './components/NodeInfoPanel';
import { NodeEditPanel } from './components/NodeEditPanel';
import { HandGestureOverlay } from './components/HandGestureOverlay';
import { HelpOverlay } from './components/HelpOverlay';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  useKeyboardShortcuts();

  return (
    <>
      <Scene />
      <Toolbar />
      <PromptInput />
      <ResponsePanel />
      <ContextMenu />
      <NodeInfoPanel />
      <NodeEditPanel />
      <Legend />
      <HandGestureOverlay />
      <HelpOverlay />
    </>
  );
}
