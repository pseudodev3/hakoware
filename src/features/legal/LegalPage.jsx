import React from 'react';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

const EFFECTIVE_DATE = 'September 18, 2026';
const SUPPORT_EMAIL = 'hakoware265@gmail.com';

const privacySections = [
  ['What Hakoware collects', (
    <>
      <p>Hakoware processes information you provide or create while using the game, including:</p>
      <ul>
        <li>account information such as your display name and email address;</li>
        <li>contract and game activity such as friendships, check-ins, Duo XP, Aura, debt, seasons, bounties, Claims, Grudges, recaps and notifications;</li>
        <li>voice notes and other content you choose to upload;</li>
        <li>email addresses used to send contract invitations; and</li>
        <li>basic technical and security information needed to run the service. Our hosting providers may also process request metadata such as IP address, browser or device information in their logs.</li>
      </ul>
    </>
  )],
  ['How we use information', (
    <p>We use this information to operate contracts and game mechanics, authenticate accounts, deliver invitations and transactional messages, store voice notes, show recaps and social game state, prevent abuse, troubleshoot problems, secure the service and improve reliability.</p>
  )],
  ['Browser storage', (
    <p>Hakoware uses browser storage for things such as your signed-in session and interface preferences. We do not currently run advertising trackers or third-party behavioral analytics on the site.</p>
  )],
  ['When information is shared', (
    <>
      <p>We do not sell your personal information. Information may be processed by service providers that help us run Hakoware, including hosting, database, file-storage and transactional-email providers.</p>
      <p>We may also disclose information when reasonably necessary to comply with law, protect users or the service, investigate abuse or security issues, or as part of a legitimate business transfer.</p>
    </>
  )],
  ['Public and social game information', (
    <p>Hakoware includes social mechanics. Depending on the feature and your settings, information such as display names, contract status, bounties, Grudges, Wanted state, leaderboard or Shame Board information may be visible to other users. Do not put sensitive personal information into content you expect to be social or shareable.</p>
  )],
  ['Retention and deletion', (
    <p>We keep account and game information for as long as reasonably needed to operate Hakoware, maintain game history, secure the service and meet legal obligations. Provider logs and backups may remain for limited periods after deletion. To request account or personal-data deletion, email us from the address connected to your account.</p>
  )],
  ['Your choices', (
    <p>You can choose what content to submit, avoid uploading voice notes, and use available privacy or visibility controls inside Hakoware. You can also contact us to request access, correction or deletion of personal information, subject to applicable law and reasonable verification.</p>
  )],
  ['Security', (
    <p>We use reasonable technical and organizational safeguards, but no internet service can guarantee absolute security. Keep your login credentials and authentication links private and contact us if you believe your account has been compromised.</p>
  )],
  ['Children', (
    <p>Hakoware is not intended for children under 13. If local law requires a higher age or parental consent to use an online service, those requirements also apply.</p>
  )],
  ['International processing', (
    <p>Hakoware relies on cloud service providers, so information may be processed in countries other than the one where you live. Those providers process information under their own infrastructure and contractual safeguards.</p>
  )],
  ['Changes to this policy', (
    <p>We may update this policy as Hakoware changes. If a change is material, we will make the updated policy available here and update the effective date.</p>
  )]
];

const termsSections = [
  ['Using Hakoware', (
    <p>Hakoware is a social game built around recurring contracts, check-ins, seasons and playful social pressure. By using Hakoware, you agree to these Terms and to follow the Community Guidelines.</p>
  )],
  ['Accounts', (
    <p>You are responsible for the activity on your account and for keeping your login credentials secure. Information you provide should be accurate enough for us to operate and protect your account.</p>
  )],
  ['Social mechanics and consent', (
    <p>Features such as bounties, Claims, Grudges, Shame Board entries, Wanted status and Chaos events are game mechanics. Use them as playful in-app pressure, not as a tool for harassment, threats, coercion or real-world punishment. Participation in a contract does not give either person permission to violate the other person's privacy or boundaries.</p>
  )],
  ['Aura and virtual items', (
    <p>Aura, bounty amounts, bonds, cards, ranks and other in-app values are virtual game items. Unless Hakoware explicitly says otherwise in a future feature, they have no cash value, are not cryptocurrency, are not redeemable for money and do not create a financial claim against Hakoware or another user.</p>
  )],
  ['Your content', (
    <p>You keep ownership of content you create. You give Hakoware a limited license to host, store, reproduce and process that content only as needed to operate, secure and improve the service and to deliver the social features you choose to use.</p>
  )],
  ['Acceptable use', (
    <p>Do not misuse Hakoware, interfere with the service, scrape or automate it without permission, impersonate people, exploit bugs, attempt unauthorized access, upload unlawful material or use the game to harass, threaten, stalk or expose private information about another person.</p>
  )],
  ['Moderation and enforcement', (
    <p>We may remove content, restrict features or suspend accounts when reasonably necessary to protect users, investigate abuse, maintain service integrity or enforce these Terms and the Community Guidelines.</p>
  )],
  ['Availability and changes', (
    <p>Hakoware is actively developed. Features, game balance, Aura economics, seasons, limits and availability may change. We may modify, pause or discontinue parts of the service, and we do not promise uninterrupted or error-free operation.</p>
  )],
  ['No professional advice', (
    <p>Hakoware is entertainment software. It is not a substitute for medical, mental-health, legal, financial or relationship counseling.</p>
  )],
  ['Disclaimers and liability', (
    <p>To the extent permitted by applicable law, Hakoware is provided on an “as is” and “as available” basis. We are not responsible for indirect or consequential losses caused by use of the service, user behavior, service interruptions or loss of virtual game progress where the law allows such limitations.</p>
  )],
  ['Ending use of Hakoware', (
    <p>You may stop using Hakoware at any time. You may request deletion of your account by contacting us. We may suspend or terminate access for serious or repeated violations, fraud, abuse or security reasons.</p>
  )],
  ['Changes to these Terms', (
    <p>We may update these Terms as the product changes. Continued use after updated Terms take effect means you accept the revised Terms, subject to any rights you have under applicable law.</p>
  )]
];

const communitySections = [
  ['Keep the pressure playful', (
    <p>Hakoware is allowed to be petty, dramatic and competitive. It is not a license to threaten, intimidate, stalk or repeatedly target someone who has made it clear they want the interaction to stop.</p>
  )],
  ['Respect privacy', (
    <p>Do not dox people, publish private contact details, share private voice notes outside their intended context without permission, or use information learned through a contract to harm or embarrass someone in real life.</p>
  )],
  ['No hate, exploitation or sexual abuse', (
    <p>Do not use Hakoware to promote hateful abuse, sexual exploitation, non-consensual sexual content, child sexual abuse material, or credible threats of violence.</p>
  )],
  ['Do not impersonate or deceive', (
    <p>Do not pretend to be another person, create accounts to evade enforcement, or deliberately misrepresent identity in a way that harms or deceives other users.</p>
  )],
  ['Play fair', (
    <p>Do not exploit bugs, automate check-ins or game outcomes, manipulate Aura or bounties, interfere with other users' accounts, or attack Hakoware infrastructure.</p>
  )],
  ['Report serious problems', (
    <p>If something moves beyond playful game behavior into harassment, threats, privacy abuse or account compromise, stop engaging and contact us. Include enough context for us to investigate, but never send your password or authentication token.</p>
  )]
];

const contactSections = [
  ['Support', (
    <p>For account help, bugs, game questions or general support, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
  )],
  ['Privacy requests', (
    <p>For access, correction or deletion requests, email us from the address connected to your Hakoware account and put “Privacy request” in the subject line.</p>
  )],
  ['Abuse and safety', (
    <p>For harassment, threats, impersonation, privacy abuse or other serious misuse, put “Safety report” in the subject line and include the relevant account or contract information. Do not send passwords, reset links or authentication tokens.</p>
  )],
  ['Security reports', (
    <p>If you believe you found a security vulnerability, email us with clear reproduction steps and give us a reasonable opportunity to investigate before publicly disclosing it.</p>
  )]
];

const pages = {
  privacy: {
    eyebrow: 'LEGAL',
    title: 'Privacy Policy',
    intro: 'What Hakoware collects, why we use it, and the choices you have.',
    sections: privacySections
  },
  terms: {
    eyebrow: 'LEGAL',
    title: 'Terms of Use',
    intro: 'The basic rules for using Hakoware and its social game mechanics.',
    sections: termsSections
  },
  community: {
    eyebrow: 'TRUST + SAFETY',
    title: 'Community Guidelines',
    intro: 'Social pressure is part of the game. Real-world harm is not.',
    sections: communitySections
  },
  contact: {
    eyebrow: 'SUPPORT',
    title: 'Contact Hakoware',
    intro: 'Where to send support, privacy, safety and security requests.',
    sections: contactSections
  }
};

export const LegalPage = ({ type = 'privacy' }) => {
  const page = pages[type] || pages.privacy;

  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-header">
          <Link className="legal-back" to="/"><ArrowLeft size={16} /> Back to Hakoware</Link>
          <img src="/hakoware-mark-v2.png" alt="Hakoware" />
        </header>

        <section className="legal-hero">
          <div className="legal-eyebrow"><ShieldCheck size={14} /> {page.eyebrow}</div>
          <h1>{page.title}</h1>
          <p>{page.intro}</p>
          <span>Effective {EFFECTIVE_DATE}</span>
        </section>

        <div className="legal-content">
          {page.sections.map(([title, body]) => (
            <section className="legal-section" key={title}>
              <h2>{title}</h2>
              <div>{body}</div>
            </section>
          ))}
        </div>

        <footer className="legal-footer">
          <div>
            <Mail size={15} />
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </div>
          <nav aria-label="Legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/community">Community</Link>
            <Link to="/contact">Contact</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
};
