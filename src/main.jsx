import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "../style.css";
import "../dashboard.css";
import "../feature-pages.css";
import "../currency-conversion.css";

// Shows runtime errors on screen instead of failing with a blank page during development.
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "24px", fontFamily: "sans-serif" }}>
          <h1>React Render Error</h1>
          <p>{String(this.state.error.message || this.state.error)}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </RootErrorBoundary>
  </React.StrictMode>
);
