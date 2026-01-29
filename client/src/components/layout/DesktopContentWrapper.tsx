interface DesktopContentWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function DesktopContentWrapper({ children, className = "" }: DesktopContentWrapperProps) {
  return (
    <div className={`hidden md:block max-w-7xl mx-auto px-6 lg:px-8 py-6 ${className}`}>
      {children}
    </div>
  );
}
