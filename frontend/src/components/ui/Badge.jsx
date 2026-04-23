import styles from './Badge.module.css';

export default function Badge({ children, variant = 'neutral', size = 'md', className = '', ...rest }) {
  const cls = [styles.badge, styles[`variant_${variant}`], styles[`size_${size}`], className].filter(Boolean).join(' ');
  return <span className={cls} {...rest}>{children}</span>;
}
