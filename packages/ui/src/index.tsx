import { Slot } from '@radix-ui/react-slot';
import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  asChild,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }): ReactNode {
  const Component = asChild ? Slot : 'button';
  return <Component className={clsx('cg-button', className)} {...props} />;
}
