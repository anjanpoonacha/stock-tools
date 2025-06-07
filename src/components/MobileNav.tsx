'use client';

import React from 'react';
import Link from 'next/link';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Menu as MenuIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export function MobileNav() {
	return (
		<nav className='md:hidden w-full border-b bg-card z-50'>
			<div className='flex items-center justify-between px-4 py-3'>
				<Link href='/' className='font-bold text-lg'>
					Stock Tools
				</Link>
				<div className='flex items-center gap-2'>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant='ghost' size='icon' aria-label='Open menu'>
								<MenuIcon className='w-6 h-6' />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end' className='w-48'>
							<DropdownMenuItem asChild>
								<Link href='/'>Stock Converter</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href='/csv-watchlist'>CSV Watchlist</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href='/regroup-watchlist'>Regroup TV Watchlist</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{/* Theme toggle for mobile */}
					<ThemeToggle />
				</div>
			</div>
		</nav>
	);
}
