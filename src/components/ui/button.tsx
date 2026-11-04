import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[transform,background-color,border-color,box-shadow] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white shadow-xs hover:bg-blue-700 active:bg-blue-800',
        navy: 'bg-navy-900 text-white shadow-xs hover:bg-navy-800 active:bg-slate-950',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
        outline: 'border border-slate-200 bg-white text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-300',
        ghost: 'text-slate-700 hover:bg-slate-100 active:bg-slate-200',
        destructive: 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800',
        success: 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800',
      },
      size: {
        sm: 'h-9 px-3 text-xs min-h-[36px]',
        md: 'h-11 px-4 py-2 min-h-[44px] min-w-[44px]',
        lg: 'h-12 px-6 text-base min-h-[48px]',
        icon: 'h-11 w-11 min-h-[44px] min-w-[44px] p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
