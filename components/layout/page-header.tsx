type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex min-h-[var(--header-height)] flex-col justify-center gap-4 border-b border-border/60 px-8 py-6 backdrop-blur-sm dark:border-white/6 dark:bg-transparent lg:flex-row lg:items-end lg:justify-between lg:px-10">
      <div className="space-y-1">
        <p className="text-[0.5625rem] font-semibold tracking-[0.14em] text-muted-foreground/60 uppercase">
          Creative OS
        </p>
        <h1 className="text-[1.375rem] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-subtitle max-w-2xl">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
