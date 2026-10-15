export const SITE_URL = 'https://hakoware.xyz';
export const SHARE_IMAGE = `${SITE_URL}/hakoware-social.png`;
export const PUBLIC_PAGES = {
  '/': { title: 'Hakoware, a friendship game for staying in touch', description: 'Play card games with friends, meet new people and grow your Duo through private chats, check-ins and shared seasons on Hakoware.' },
  '/privacy': { title: 'Hakoware Privacy Policy', description: 'How Hakoware handles account information, private messages, voice notes, cosmetic purchases and your privacy choices.' },
  '/terms': { title: 'Hakoware Terms of Use', description: 'The rules for using Hakoware, its friendship contracts, check-ins, social game mechanics and shared content.' },
  '/community': { title: 'Hakoware Community Guidelines', description: 'Keep Hakoware playful. Our community guidelines cover respectful play, privacy, fair competition and reporting abuse.' },
  '/contact': { title: 'Contact Hakoware', description: 'Contact Hakoware for account help, game questions, privacy requests and security or safety reports.' }
};
const privateQueries = ['view', 'join', 'cosmetic_order', 'checkout', 'event', 'contract', 'spark', 'reply', 'invite', 'token'];
export const metadataForLocation = ({ pathname = '/', search = '' } = {}, authenticated = false) => {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = PUBLIC_PAGES[path];
  const query = new URLSearchParams(search);
  const privateView = !page || privateQueries.some(key => query.has(key)) || (authenticated && path === '/');
  return {
    ...(page || { title: 'Your Hakoware space', description: 'Sign in to your Hakoware account to continue your shared story.' }),
    canonical: SITE_URL + (page ? path : '/'),
    robots: privateView ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    public: !privateView
  };
};
export const siteSchema = () => ({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Hakoware', url: SITE_URL, logo: `${SITE_URL}/hakoware-mark-v2.jpg`, email: 'hakoware265@gmail.com' },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Hakoware', url: SITE_URL, inLanguage: 'en', publisher: { '@id': `${SITE_URL}/#organization` } },
    { '@type': 'WebApplication', '@id': `${SITE_URL}/#app`, name: 'Hakoware', url: SITE_URL, description: PUBLIC_PAGES['/'].description, applicationCategory: 'GameApplication', operatingSystem: 'Web', browserRequirements: 'Requires JavaScript and a modern web browser.', publisher: { '@id': `${SITE_URL}/#organization` } }
  ]
});
