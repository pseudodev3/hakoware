import { Component, Suspense } from 'react';

class ViewErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="deferred-view-state" role="alert"><p>This page could not load.</p><button type="button" onClick={() => window.location.reload()}>Reload the page</button></div>;
    return this.props.children;
  }
}

export const DeferredView = ({ children }) => <ViewErrorBoundary><Suspense fallback={<div className="deferred-view-state" role="status">Opening your space…</div>}>{children}</Suspense></ViewErrorBoundary>;
