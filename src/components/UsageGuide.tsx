'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface UsageGuideProps {
	title: string;
	steps: string[];
	tips?: string[];
	className?: string;
	defaultExpanded?: boolean;
}

export function UsageGuide({ 
	title, 
	steps, 
	tips = [], 
	className = '', 
	defaultExpanded = false 
}: UsageGuideProps) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	return (
		<div className={`bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
			<Button
				variant="ghost"
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full justify-between p-0 h-auto font-medium text-blue-700 dark:text-blue-300 hover:bg-transparent"
			>
				<div className="flex items-center gap-2">
					<HelpCircle className="h-4 w-4" />
					<span>{title}</span>
				</div>
				{isExpanded ? (
					<ChevronUp className="h-4 w-4" />
				) : (
					<ChevronDown className="h-4 w-4" />
				)}
			</Button>
			
			{isExpanded && (
				<div className="mt-3 space-y-3">
					<div>
						<h4 className="font-medium text-sm text-blue-800 dark:text-blue-200 mb-2">How to use:</h4>
						<ol className="list-decimal list-inside space-y-1 text-sm text-blue-700 dark:text-blue-300">
							{steps.map((step, index) => (
								<li key={index}>{step}</li>
							))}
						</ol>
					</div>
					
					{tips.length > 0 && (
						<div>
							<h4 className="font-medium text-sm text-blue-800 dark:text-blue-200 mb-2">Tips:</h4>
							<ul className="list-disc list-inside space-y-1 text-sm text-blue-600 dark:text-blue-400">
								{tips.map((tip, index) => (
									<li key={index}>{tip}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</div>
	);
}