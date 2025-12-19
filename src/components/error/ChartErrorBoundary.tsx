/**
 * Error Boundary for Chart Component
 * 
 * Catches JavaScript errors in the chart rendering tree and displays
 * a fallback UI instead of crashing the entire application.
 */

'use client';

import { Component, type ReactNode } from 'react';

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ChartErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Chart crashed
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="flex items-center justify-center bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900 p-8 min-h-[400px]">
					<div className="text-center max-w-md">
						<div className="text-6xl mb-4">📊💥</div>
						<h3 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
							Chart Crashed
						</h3>
						<p className="text-red-700 dark:text-red-300 text-sm mb-4">
							{this.state.error?.message || 'An unexpected error occurred while rendering the chart.'}
						</p>
						<div className="space-y-2">
							<button
								onClick={this.handleReset}
								className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
							>
								Try Again
							</button>
							<button
								onClick={() => window.location.reload()}
								className="ml-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-md text-sm font-medium transition-colors"
							>
								Reload Page
							</button>
						</div>
						{process.env.NODE_ENV === 'development' && this.state.error && (
							<details className="mt-4 text-left">
								<summary className="cursor-pointer text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
									Error Details (Dev Only)
								</summary>
								<pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-40">
									{this.state.error.stack}
								</pre>
							</details>
						)}
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
