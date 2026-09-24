import type {Metadata} from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://folio-web-capture.mahadewa156.chatgpt.site';
const bannerUrl = process.env.NEXT_PUBLIC_OG_IMAGE_URL ?? 'https://YOUR-BANNER-URL/banner.png';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'FOLIO — Tangkap Web. Simpan.',
    template: '%s | FOLIO',
  },
  description:
    'FOLIO menangkap halaman web ke JPG, PNG, WEBP, dan PDF. Atur viewport, capture satu atau banyak URL, lalu unduh hasilnya.',
  applicationName: 'FOLIO',
  keywords: [
    'screenshot website',
    'web capture',
    'capture halaman web',
    'simpan halaman web',
    'screenshot ke JPG PNG PDF',
    'website screenshot tool',
  ],
  authors: [{name: 'FOLIO'}],
  creator: 'FOLIO',
  publisher: 'FOLIO',
  category: 'technology',
  alternates: {canonical: '/'},
  openGraph: {
    title: 'FOLIO — Web Capture Instrument',
    description: 'Screenshot halaman web dalam JPG, PNG, WEBP, atau PDF dengan kontrol viewport dan batch capture.',
    url: siteUrl,
    siteName: 'FOLIO',
    locale: 'id_ID',
    type: 'website',
    images: [
      {
        url: bannerUrl,
        width: 1200,
        height: 630,
        alt: 'FOLIO — Web Capture Instrument',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FOLIO — Web Capture Instrument',
    description: 'Screenshot halaman web dalam JPG, PNG, WEBP, atau PDF.',
    images: [bannerUrl],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {icon: '/favicon.svg', shortcut: '/favicon.svg'},
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="id"><body>{children}</body></html>;
}
