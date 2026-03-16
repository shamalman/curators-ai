'use client'

import React from "react";
import { T, F } from "@/lib/constants";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 24, textAlign: "center", color: T.ink2, fontFamily: F,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: 120, gap: 8,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>Something went wrong — try refreshing</div>
          <div style={{ fontSize: 11, color: T.ink3, maxWidth: 300, wordBreak: "break-word" }}>
            {this.state.error?.message || "Unknown error"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8, padding: "6px 16px", borderRadius: 8, border: "1px solid " + T.bdr,
              background: T.s, color: T.ink, fontSize: 12, fontFamily: F, cursor: "pointer",
            }}
          >Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
