type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex min-h-[var(--header-height)] flex-col justify-center gap-4 border-b border-border/40 px-8 py-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
      <div className="space-y-1.5">
        <h1 className="text-title">{title}</h1>
        {description && <p className="text-subtitle max-w-2xl">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
