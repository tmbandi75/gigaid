import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  actions?: {
    label: string;
    onClick: (item: T) => void;
    variant?: "default" | "destructive";
  }[];
  getRowId: (item: T) => string | number;
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 bg-muted rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = "No data found",
  onRowClick,
  actions,
  getRowId,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <TableSkeleton columns={columns.length} />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 ${column.width || ""}`}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && (
                      <button className="ml-1 hover:text-foreground">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className="text-right px-4 py-3 w-12"></th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={getRowId(item)}
                className={`border-b last:border-b-0 transition-colors hover:bg-muted/30 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                onClick={() => onRowClick?.(item)}
                data-testid={`table-row-${getRowId(item)}`}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-sm">
                    {column.render
                      ? column.render(item)
                      : String((item as Record<string, unknown>)[column.key] ?? "")}
                  </td>
                ))}
                {actions && actions.length > 0 && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.map((action) => (
                          <DropdownMenuItem
                            key={action.label}
                            onClick={() => action.onClick(item)}
                            className={action.variant === "destructive" ? "text-destructive" : ""}
                          >
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon, trend, className }: StatCardProps) {
  return (
    <Card className={`border shadow-sm ${className || ""}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                trend.isPositive ? "text-emerald-600" : "text-red-600"
              }`}>
                {trend.isPositive ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {Math.abs(trend.value)}%
              </div>
            )}
          </div>
          {icon && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
