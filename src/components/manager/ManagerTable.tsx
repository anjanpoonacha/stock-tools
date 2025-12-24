'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render: (item: T) => ReactNode;
}

interface ManagerTableProps<T> {
  title: string;
  description: string;
  items: T[];
  columns: Column<T>[];
  actions?: (item: T) => ReactNode;
  loading?: boolean;
  emptyState?: ReactNode;
}

export function ManagerTable<T extends { id: string | number }>({
  title,
  description,
  items,
  columns,
  actions,
  loading,
  emptyState,
}: ManagerTableProps<T>) {
  if (loading) {
    return (
      <Card className='h-full flex items-center justify-center'>
        <p className='text-muted-foreground'>Loading...</p>
      </Card>
    );
  }

  if (items.length === 0) {
    return emptyState || (
      <Card>
        <CardHeader>
          <CardTitle>No Items Found</CardTitle>
          <CardDescription>Get started by creating a new item</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className='h-full flex flex-col'>
      <CardHeader className='flex-shrink-0'>
        <CardTitle>{title} ({items.length})</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className='flex-1 min-h-0 p-0'>
        <div className='h-full overflow-auto mx-6 mb-6'>
          <div className='rounded-md border'>
            <table className='w-full caption-bottom text-sm'>
              <thead className='[&_tr]:border-b sticky top-0 z-10 bg-background'>
                <tr className='border-b-2 bg-background'>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`h-10 px-2 text-left align-middle font-medium text-muted-foreground bg-background ${col.className || ''}`}
                    >
                      {col.label}
                    </th>
                  ))}
                  {actions && (
                    <th className='h-10 px-2 text-right align-middle font-medium text-muted-foreground bg-background'>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className='[&_tr:last-child]:border-0'>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className='border-b transition-colors hover:bg-muted/50'
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`p-2 align-middle ${col.className || ''}`}
                      >
                        {col.render(item)}
                      </td>
                    ))}
                    {actions && (
                      <td className='p-2 align-middle text-right'>
                        {actions(item)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
