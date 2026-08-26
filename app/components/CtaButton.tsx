import Link from "next/link";
import styles from "./CtaButton.module.css";

type CtaButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

/**
 * Every CTA on the site targets /join (spec §4). Pointer-down feedback,
 * not click — apple-design §1.
 */
export function CtaButton({ href, children, variant = "primary" }: CtaButtonProps) {
  return (
    <Link href={href} className={`${styles.button} ${styles[variant]}`}>
      {children}
    </Link>
  );
}
