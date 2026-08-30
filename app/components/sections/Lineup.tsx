import Image from "next/image";
import styles from "./Lineup.module.css";

type Member = {
  name: string;
  photo: string;
  role?: string;
};

/**
 * Spec §5.4 (revised) — replaces the single composite cutout (uneven,
 * unnamed) with the real per-candidate names + photos published on the
 * movement's own /team page. Subheading line is theirs too.
 */
const MEMBERS: Member[] = [
  { name: "עופר וינטר", photo: "/team-ofer.jpg", role: "מוביל הרשימה" },
  { name: "יוסף חדאד", photo: "/team-yoseph.jpg" },
  { name: "נטעלי שם טוב", photo: "/team-netaly.jpg" },
  { name: "ללי דרעי", photo: "/team-lali.jpg" },
  { name: "דוידי בן ציון", photo: "/team-davidi.jpg" },
  { name: "ערן בן ארי", photo: "/team-eran.jpg" },
  { name: "פלר חסן נחום", photo: "/team-fleur.jpg" },
  { name: "סיגל קראוניק", photo: "/team-sigal.jpg" },
  { name: "אלי ג׳ינו", photo: "/team-eli.jpg" },
  { name: "אביב עזרא", photo: "/team-aviv.jpg" },
  { name: "רונן בודנרו", photo: "/team-ronen.jpg" },
];

export function Lineup() {
  return (
    <section id="lineup" className={styles.section}>
      <div className={styles.inner}>
        <h2 className="text-heading">הנבחרת</h2>
        <p className={`text-subheading ${styles.subheading}`}>
          ממטולה שבצפון ועד באר שבע, מנצרת ועד ירושלים — הרשימה שלנו מגיעה מכל קצוות הארץ.
        </p>
        <div className={styles.grid}>
          {MEMBERS.map((member) => (
            <div key={member.name} className={styles.card}>
              <Image
                src={member.photo}
                // Decorative relative to the adjacent visible caption below,
                // which already names this person — a non-empty alt here
                // would make screen readers announce the name twice.
                alt=""
                width={320}
                height={368}
                className={styles.photo}
              />
              <div className={styles.caption}>
                {member.role && (
                  <span className={`text-caption ${styles.role}`}>{member.role}</span>
                )}
                <span className={`text-label ${styles.name}`}>{member.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
