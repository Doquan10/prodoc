interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
}

export default function Button({ variant = 'primary', className = '', children, ...props }: Props) {
  return (
    <button className={`btn btn-${variant}${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </button>
  );
}
