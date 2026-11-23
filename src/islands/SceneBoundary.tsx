// Contains any failure inside a lazy 3D scene (GPU loss, a library error during commit)
// so the island falls back to its static SVG twin instead of breaking.
import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; onFail: (message: string) => void };
export default class SceneBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { this.props.onFail(error instanceof Error ? error.message : String(error)); }
  render() { return this.state.failed ? null : this.props.children; }
}
