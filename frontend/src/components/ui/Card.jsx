import styles from './Card.module.css';

export default function Card({ children, className = '', as: Tag = 'div', padding = 'md', ...rest }) {
  const cls = [styles.card, styles[`pad_${padding}`], className].filter(Boolean).join(' ');
  return <Tag className={cls} {...rest}>{children}</Tag>;
}
