import styles from './Button.module.css';

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  children,
  leftIcon,
  rightIcon,
  fullWidth,
  className = '',
  ...rest
}) {
  const cls = [
    styles.btn,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    fullWidth ? styles.fullWidth : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={cls} {...rest}>
      {leftIcon && <span className={styles.icon} aria-hidden>{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className={styles.icon} aria-hidden>{rightIcon}</span>}
    </button>
  );
}
