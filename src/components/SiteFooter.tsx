import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";

type SocialIconName = "telegram" | "instagram" | "facebook" | "twitter" | "linkedin" | "youtube" | "aparat";

const socialLinks: Array<{ href: string; label: string; icon: SocialIconName }> = [
  { href: "https://telegram.me/ddcpersia", label: "تلگرام", icon: "telegram" },
  { href: "https://www.instagram.com/accounts/login/?next=/persiasystem/", label: "اینستاگرام", icon: "instagram" },
  { href: "https://www.facebook.com/persiasystem-1341386802692930/", label: "فیسبوک", icon: "facebook" },
  { href: "https://twitter.com/SystemPersia", label: "توییتر", icon: "twitter" },
  { href: "https://www.linkedin.com/company/10004212/admin/", label: "لینکدین", icon: "linkedin" },
  { href: "https://www.youtube.com/channel/UCc5rtHPtSBne6DFLg3KvmDA?view_as=subscriber", label: "یوتیوب", icon: "youtube" },
  { href: "https://www.aparat.com/ddcpersia", label: "آپارات", icon: "aparat" }
];

function SocialIcon({ name }: { name: SocialIconName }) {
  if (name === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="4" />
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="16.5" cy="7.5" r="1" />
      </svg>
    );
  }

  if (name === "telegram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.6 20 5.4 17.6 19 12.8 15.2 10.2 17.8 10.8 13.9 17 8.2 9.1 12.6 4 11.6Z" />
      </svg>
    );
  }

  if (name === "youtube") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="7" width="16" height="10" rx="3" />
        <path d="m11 10 4 2-4 2v-4Z" />
      </svg>
    );
  }

  if (name === "aparat") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" />
        <circle cx="9" cy="8.5" r="1.4" />
        <circle cx="15.5" cy="10" r="1.4" />
        <circle cx="13.8" cy="16" r="1.4" />
        <circle cx="8" cy="14" r="1.4" />
      </svg>
    );
  }

  const marks: Record<Exclude<SocialIconName, "instagram" | "telegram" | "youtube" | "aparat">, string> = {
    facebook: "f",
    twitter: "X",
    linkedin: "in"
  };

  return <span aria-hidden="true">{marks[name]}</span>;
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-contact-card">
          <div className="footer-brand">
            <Image src="/assets/New-Project-13.jpg" alt="لوگوی پرشیا سیستم" width={132} height={52} />
            <div>
              <strong>پرشیا سیستم</strong>
              <span>اطلاعات تماس پرشیا سیستم</span>
            </div>
          </div>

          <address className="footer-contact">
            <p>
              <MapPin size={18} aria-hidden="true" />
              <span>تهران، میدان آرژانتین، خیابان وزرا یا خالد اسلامبولی، خیابان بهزاد شفق (۱۷ ام)، پلاک ۱۸</span>
            </p>
            <p>
              <Phone size={18} aria-hidden="true" />
              <a href="tel:02154871200">02154871200</a>
            </p>
            <p>
              <Phone size={18} aria-hidden="true" />
              <span>تلفن پشتیبانی:</span>
              <a href="tel:02154871300">02154871300</a>
            </p>
            <p>
              <Mail size={18} aria-hidden="true" />
              <a href="mailto:info@ddcpersia.com">info@ddcpersia.com</a>
            </p>
          </address>
        </div>

        <div className="footer-socials" aria-label="شبکه‌های اجتماعی پرشیا سیستم">
          {socialLinks.map((item) => (
            <a key={item.href} href={item.href} aria-label={item.label} target="_blank" rel="noreferrer">
              <SocialIcon name={item.icon} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
