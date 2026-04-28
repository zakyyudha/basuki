import React from 'react'

export class BootstrapBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error, info) {
    this.props.onError?.({
      phase: 'render',
      error,
      info,
    })
  }

  render() {
    if (this.state.hasError) {
      return this.props.renderFallback?.({
        error: this.state.error,
      })
    }

    return this.props.children
  }
}
