import cn from 'clsx'

const Container = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return <div className={cn(className, 'space-y-3 px-4')}>{children}</div>
}

export { Container }
